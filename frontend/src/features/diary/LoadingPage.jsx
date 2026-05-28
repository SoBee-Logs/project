import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CURRENT_USER } from '../../common/utils/rooms'

const LOADING_MESSAGES = [
  'VLM이 사진을 분석하고 있어요...',
  '결제 내역을 매핑하고 있어요...',
  'LLM이 일기를 쓰는 중입니다!',
]

export default function LoadingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [messageIndex, setMessageIndex] = useState(0)
  const [userPhotos, setUserPhotos] = useState([])
  const [personaImage, setPersonaImage] = useState(CURRENT_USER.personaImage)

  const imageUrl = location.state?.imageUrl ?? null
  const selectedRooms =
    location.state?.selectedRooms?.length > 0
      ? location.state.selectedRooms
      : []
  const imageFile = location.state?.imageFile ?? null
  const photoId   = location.state?.photoId   ?? null
  const mood      = location.state?.mood       ?? null

  useEffect(() => {
    const fetchUserPhotos = async () => {
      try {
        const token = localStorage.getItem('token')
        const today = new Date().toISOString().slice(0, 10)

        // 페르소나 이미지 가져오기
        try {
          const decoded = JSON.parse(atob(token.split('.')[1]))
          const userId = decoded.sub
          const avatarRes = await fetch(`/api/avatar/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (avatarRes.ok) {
            const avatarData = await avatarRes.json()
            if (avatarData.avatarImgUrl) setPersonaImage(avatarData.avatarImgUrl)
          }
        } catch {
          // 실패 시 기본 이미지 유지
        }

        const res = await fetch(`/api/photos?date=${today}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        const photoList = data.photos ?? data
        const urls = photoList.map((p) => p.imageUrl ?? p.url).filter(Boolean)
        if (urls.length > 0) setUserPhotos(urls)
      } catch {
        // 실패해도 fallback으로 진행
      }
    }
    fetchUserPhotos()
  }, [])

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 1000)

    const runPipeline = async () => {
      const token = localStorage.getItem('token')
      const today = new Date().toISOString().slice(0, 10)

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
        } catch {
          // 실패 시 빈 배열로 진행
        }
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

      const diaries = []
      for (const roomId of roomIds) {
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
            diaries.push({
              title:           data.title,
              diaryLines:      data.diaryLines,
              tags:            data.tags,
              roomId:          data.roomId ?? roomId,
              roomLabel:       data.roomLabel,          // roomMap 제거, data에서만
              imageUrls:       data.imageUrls ?? [],
              imageUrl:        data.imageUrls?.[0] ?? imageUrl,
              photoIds:        data.photoIds ?? [],
              matchedPhotoIds: data.matchedPhotoIds ?? [],
            })
          }
        } catch {
          // 특정 방 일기 생성 실패 시 해당 방만 skip
        }
      }

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
    ? [...userPhotos, ...userPhotos]
    : imageUrl
      ? [imageUrl, imageUrl, imageUrl, imageUrl]
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
          {[CURRENT_USER.personaEmoji, '🌃', '🍜', '✨', CURRENT_USER.personaEmoji, '🌃'].map(
            (emoji, i) => (
              <span
                key={i}
                className="text-4xl shrink-0 w-14 h-14 flex items-center justify-center bg-white rounded-full shadow-lg overflow-hidden"
              >
                {i % 2 === 0 ? (
                  <img
                    src={personaImage}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  emoji
                )}
              </span>
            ),
          )}
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