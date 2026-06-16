import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CURRENT_USER } from '../../common/utils/rooms'

const LOADING_MESSAGES = [
  'VLM이 사진을 분석하고 있어요...',
  '결제 내역을 매핑하고 있어요...',
  'LLM이 일기를 쓰는 중입니다!',
]

// UTC → KST 변환 유틸
const getTodayKST = () =>
  new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

export default function LoadingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const imageUrl = location.state?.imageUrl ?? null
  const selectedRooms =
    location.state?.selectedRooms?.length > 0
      ? location.state.selectedRooms
      : []
  const imageFile = location.state?.imageFile ?? null
  const photoId   = location.state?.photoId   ?? null
  const mood      = location.state?.mood       ?? null

  const [messageIndex, setMessageIndex] = useState(0)
  const [userPhotos, setUserPhotos] = useState(imageUrl ? [imageUrl] : [])
  const [userEmojis, setUserEmojis] = useState(mood ? [mood] : [])
  const [personaImage, setPersonaImage] = useState(CURRENT_USER.personaImage)
  const hasRun = useRef(false) // 추가: StrictMode 중복 실행 방지

  useEffect(() => {
    const fetchUserPhotos = async () => {
      try {
        const token = localStorage.getItem('token')
        const today = getTodayKST()
        const decoded = JSON.parse(atob(token.split('.')[1]))
        const userId = decoded.sub

        const [avatarRes, photosRes] = await Promise.all([
          fetch(`/api/avatar/${userId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/photos?date=${today}`, { headers: { Authorization: `Bearer ${token}` } }),
        ])

        if (avatarRes.ok) {
          const avatarData = await avatarRes.json()
          if (avatarData.avatarImgUrl) setPersonaImage(avatarData.avatarImgUrl)
        }

        if (photosRes.ok) {
          const data = await photosRes.json()
          const photoList = data.photos ?? data
          const urls = photoList.map((p) => p.imageUrl ?? p.url).filter(Boolean)
          if (urls.length > 0) setUserPhotos(urls)
          const emojis = photoList.map((p) => p.emoji).filter(Boolean)
          if (emojis.length > 0) setUserEmojis(emojis)
        }
      } catch {
        // 실패해도 fallback으로 진행
      }
    }
    fetchUserPhotos()
  }, [])

  useEffect(() => {
    // 추가: StrictMode 두 번째 실행 막기
    if (hasRun.current) return
    hasRun.current = true

    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 1000)

    const runPipeline = async () => {
      const token = localStorage.getItem('token')
      const today = getTodayKST()
    
      let roomIds = selectedRooms
      let roomMap = {}
    
      if (roomIds.length === 0) {
        try {
          const res = await fetch('/api/groups', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const groups = await res.json()
            roomIds = groups.map((g) => g.groupId)
            groups.forEach((g) => { roomMap[g.groupId] = g.groupName })
          }
        } catch {}
      } else {
        try {
          const res = await fetch('/api/groups', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const groups = await res.json()
            groups.forEach((g) => { roomMap[g.groupId] = g.groupName })
          }
        } catch {}
      }
    
      // 오늘 사진이 있는 그룹만 필터링
      let photoList = []
      try {
        const photosRes = await fetch(`/api/photos?date=${today}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (photosRes.ok) {
          const photosData = await photosRes.json()
          photoList = photosData.photos ?? photosData
          console.log('photoList:', photoList)
          console.log('unmappedPhotos:', photoList.filter((p) => !p.mapped))
          const photoGroups = new Set(photoList.flatMap((p) => p.group ?? []))
          roomIds = roomIds.filter((id) => photoGroups.has(Number(id)))
        }
      } catch {}
    
      // 1. sync — 최신 결제 내역 업데이트
      try {
        await fetch('/api/diary/sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {
        // sync 실패해도 계속 진행
      }
    
      // 2. mapping — 미매핑 사진 매핑
      // 일기는 하루 1회만 생성되므로, 오늘 날짜로만 필터링하면 그 이후 올라온 사진이나
      // 어제 매핑을 못 받은 사진이 영영 매핑 기회를 못 얻음 → 날짜 무관 미매핑 사진 전체를 대상으로 매핑
      try {
        const unmappedRes = await fetch('/api/photos/unmapped', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const unmappedData = unmappedRes.ok ? await unmappedRes.json() : null
        const unmappedPhotos = unmappedData?.photos ?? unmappedData ?? []
        await Promise.all(
          unmappedPhotos.map((p) =>
            fetch(`/api/photos/${p.id}/mapping`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => {})
          )
        )
      } catch {}
    
      // 3. generate — 일기 생성 (병렬)
      const diaries = (await Promise.all(
        roomIds.map(async (roomId) => {
          try {
            const res = await fetch('/api/diary/generate', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                groupId: roomId,
                date:    today,
                mood:    mood,
              }),
            })
            if (res.ok) {
              const data = await res.json()
              return {
                title:           data.title,
                diaryLines:      data.diaryLines,
                tags:            data.tags,
                roomId:          data.roomId ?? roomId,
                roomLabel:       data.roomLabel,
                imageUrls:       data.imageUrls ?? [],
                imageUrl:        data.imageUrls?.[0] ?? imageUrl,
                photoIds:        data.photoIds ?? [],
                matchedPhotoIds: data.matchedPhotoIds ?? [],
              }
            }
          } catch {}
          return null
        })
      )).filter(Boolean)
    
      clearInterval(messageTimer)
      navigate('/diary-result', {
        replace: true,
        state: { diaries, selectedRooms: roomIds, roomIndex: 0 },
      })
    }

    runPipeline()

    return () => clearInterval(messageTimer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const marqueePhotos = userPhotos.length > 0
    ? [...userPhotos, ...userPhotos, ...userPhotos]
    : []

  return (
    <main className="relative flex flex-col items-center justify-center min-h-full bg-gradient-to-b from-indigo-50 via-white to-indigo-50 overflow-hidden px-6">
      {marqueePhotos.length > 0 && (
        <div className="absolute inset-x-0 top-[18%] h-24 overflow-hidden opacity-40 pointer-events-none">
          <div className="flex gap-4 animate-marquee whitespace-nowrap">
            {marqueePhotos.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className="w-20 h-20 rounded-2xl object-cover shadow-md shrink-0"
              />
            ))}
          </div>
        </div>
      )}

      <div className="absolute bottom-[22%] left-0 right-0 h-16 overflow-hidden pointer-events-none">
        <div className="flex items-center gap-6 animate-avatar-drift">
          {(() => {
            const base = userEmojis.length > 0 ? userEmojis : ['🌃', '🍜', '✨']
            const slots = [0, 1, 2].map(i => base[i % base.length])
            const single = [null, slots[0], null, slots[1], null, slots[2]]
            return [...single, ...single].map((item, i) => (
              <span
                key={i}
                className="text-4xl shrink-0 w-14 h-14 flex items-center justify-center bg-white rounded-full shadow-lg overflow-hidden"
              >
                {i % 2 === 0 ? (
                  <img src={personaImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  item
                )}
              </span>
            ))
          })()}
        </div>
      </div>

      <section className="relative z-10 flex flex-col items-center gap-6">
        <span className="relative w-20 h-20">
          <span className="absolute inset-0 rounded-full border-4 border-indigo-100" />
          <span className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
          <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
            <img
              src={personaImage}
              alt=""
              className="w-12 h-12 object-cover"
            />
          </span>
        </span>

        <section className="text-center space-y-2">
          <h2 className="text-lg font-bold text-gray-800">일기 생성 중</h2>
          <p
            key={messageIndex}
            className="text-sm text-indigo-600 font-medium animate-fade-in min-h-5"
          >
            {LOADING_MESSAGES[messageIndex]}
          </p>
        </section>

        <span className="flex gap-1.5 mt-2">
          {LOADING_MESSAGES.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                i === messageIndex ? 'bg-indigo-500' : 'bg-indigo-200'
              }`}
            />
          ))}
        </span>
      </section>
    </main>
  )
}