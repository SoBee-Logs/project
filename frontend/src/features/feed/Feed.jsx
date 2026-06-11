import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import RoomTabs from '../../common/components/RoomTabs'
import beeImage from '../../assets/image 61.png'
import calendarIcon from '../../assets/calendar_icon.png'

const mapDiaryToPost = (item) => ({
  id: item.diaryId,
  title: item.title || '무제',
  diaryLines: item.diaryLines?.length > 0
    ? item.diaryLines
    : [item.subtitle].filter(Boolean),
  date: item.date || '',
  time: item.time || '',
  authorNickname: item.authorName || '익명',
  // 작성자 userId — 타 사용자 페르소나 이미지 조회에 사용
  authorId: item.authorId ?? null,
  personaTitle: item.roomLabel || '',
  imageUrls: item.imageUrls?.length > 0 ? item.imageUrls : [item.imageUrl].filter(Boolean),
  liked: false,
  likes: item.likes ?? 0,
  roomId: `room_${item.roomId}`,
  photoIds: item.photoIds || [],
  matchedPhotoIds: item.matchedPhotoIds || [],
})

const formatFeedDate = (dateStr) => {
  if (!dateStr || dateStr === '날짜 없음') return dateStr

  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return dateStr

  return `${year}년 ${month}월 ${day}일`
}

function FeedPost({ post, onToggleLike, personaImage, personaName, onProfileClick }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const images = post.imageUrls || []

  return (
    <article className="bg-white mb-3 rounded-2xl overflow-hidden shadow-sm mx-4">
      <header className="flex items-center gap-3 px-4 py-3">
        <img
          src={personaImage ?? beeImage}
          alt={post.authorNickname}
          className="w-9 h-9 rounded-full object-cover bg-white overflow-hidden cursor-pointer"
          onClick={() => onProfileClick({ image: personaImage ?? beeImage, nickname: personaName ?? null })}
        />
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-sm font-bold text-gray-900">{post.authorNickname}</span>
          <span className="block text-xs text-gray-500 truncate">{personaName}</span>
        </span>
      </header>

      <figure className="m-0 w-full aspect-square bg-gray-100 relative group overflow-hidden">
        {images.length > 0 && (
          <img
            src={images[currentIndex]}
            alt=""
            className="w-full h-full object-cover"
          />
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
              }
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 flex items-center justify-center shadow text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
              aria-label="이전 이미지"
            >
              <span className="text-[24px] leading-none -translate-y-[3px]">
                ‹
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setCurrentIndex((prev) => (prev + 1) % images.length)
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 flex items-center justify-center shadow text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
              aria-label="다음 이미지"
            >
              <span className="text-[24px] leading-none -translate-y-[3px]">
                ›
              </span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onToggleLike(post.id)}
          className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/95 shadow flex items-center justify-center"
          aria-label="좋아요"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={post.liked ? '#ef4444' : 'none'}
            stroke={post.liked ? '#ef4444' : '#374151'}
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </figure>

      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2">
          {images.map((_, i) => (
            <span
              key={i}
              className={`rounded-full transition-all ${
                i === currentIndex 
                  ? 'w-4 h-1.5' 
                  : 'w-1.5 h-1.5'
              }`}
              style={{
                background: i === currentIndex ? '#2F7DF6' : '#DCEBFF'
              }}
            />
          ))}
        </div>
      )}

      <section className="px-4 py-3 text-left">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base font-bold text-gray-900 m-0">{post.title}</h3>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed m-0">
          {post.diaryLines.join(' ')}
        </p>

        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-400 m-0">좋아요 {post.likes}개</p>
          <time className="text-[10px] text-gray-400 whitespace-nowrap">{post.date} {post.time}</time>
        </div>
      </section>
    </article>
  )
}

export default function Feed() {
  const location = useLocation()
  const initialRoomId = location.state?.roomId
    ? `room_${location.state.roomId}`
    : null

  const [activeRoom, setActiveRoom] = useState(initialRoomId)
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  // 작성자 userId → 아바타 이미지 URL 캐시 (타 사용자 페르소나 버그 수정)
  const [personaImages, setPersonaImages] = useState({})
  const [personaNames, setPersonaNames] = useState({})
  const [selectedProfile, setSelectedProfile] = useState(null)

  useEffect(() => {
    if (!activeRoom || !activeRoom.startsWith('room_')) return

    const groupId = activeRoom.replace('room_', '')

    const fetchDiaries = async () => {
      setIsLoading(true)
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/diary/list?groupId=${groupId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        const mapped = data.map(mapDiaryToPost)
        setPosts(mapped)

        const uniqueAuthorIds = [...new Set(mapped.map(p => p.authorId).filter(Boolean))]
        const avatarResults = await Promise.all(
          uniqueAuthorIds.map(authorId =>
            fetch(`/api/avatar/${authorId}`, { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          )
        )
        const images = {}
        const names = {}
        uniqueAuthorIds.forEach((authorId, i) => {
          if (avatarResults[i]?.avatarImgUrl) images[authorId] = avatarResults[i].avatarImgUrl
          if (avatarResults[i]?.avatarName) names[authorId] = avatarResults[i].avatarName
        })
        setPersonaImages(images)
        setPersonaNames(names)
      } catch (err) {
        console.error('일기 목록 조회 실패', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDiaries()
  }, [activeRoom])

  const handleToggleLike = async (id) => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/diary/${id}/like`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (err) {
      console.error('좋아요 실패', err)
    }
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== id) return post
        const liked = !post.liked
        return {
          ...post,
          liked,
          likes: liked ? post.likes + 1 : Math.max(0, post.likes - 1),
        }
      }),
    )
  }

  const groupedPosts = posts.reduce((acc, post) => {
    const date = post.date || '날짜 없음'
    if (!acc[date]) acc[date] = []
    acc[date].push(post)
    return acc
  }, {})

  return (
    <main className="min-h-full bg-[#F5F7FB]">
      <div className="sticky top-0 z-20 bg-white">
        <RoomTabs activeRoom={activeRoom} onChange={setActiveRoom} showAdd />
      </div>

      <section className="py-1 pb-4">
        {isLoading ? (
          <p className="text-center text-sm text-gray-400 py-12">불러오는 중...</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">
            이 모임방에 아직 일기가 없어요
          </p>
        ) : (
          Object.entries(groupedPosts).map(([date, datePosts]) => (
            <div key={date}>
              <div className="flex items-center gap-3 px-4 py-1.5">
                <div
                  className="flex-1 h-px"
                  style={{ background: '#DCEBFF' }}
                />

                <div
                  className="flex items-center rounded-full border shrink-0"
                  style={{
                    padding: '5px 12px 5px 8px',
                    gap: '7px',
                    background: '#F3F8FF',
                    borderColor: '#DCEBFF',
                    boxShadow: '0 3px 10px rgba(31, 122, 224, 0.05)',
                  }}
                >
                  <img
                    src={calendarIcon}
                    alt=""
                    className="w-[20px] h-[20px] object-contain shrink-0"
                  />

                  <span
                    className="text-[11px] font-bold"
                    style={{
                      color: '#1F5FAE',
                      letterSpacing: '-0.2px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatFeedDate(date)}
                  </span>
                </div>

                <div
                  className="flex-1 h-px"
                  style={{ background: '#DCEBFF' }}
                />
              </div>

              {datePosts.map((post) => (
                <FeedPost
                  key={post.id}
                  post={post}
                  onToggleLike={handleToggleLike}
                  personaImage={personaImages[post.authorId] ?? null}
                  personaName={personaNames[post.authorId] ?? null}
                  onProfileClick={setSelectedProfile}
                />
              ))}
            </div>
          ))
        )}
      </section>

      {selectedProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedProfile(null)}
        >
          <div className="flex flex-col items-center gap-3">
            <img
              src={selectedProfile.image}
              alt={selectedProfile.nickname}
              className="w-64 h-64 rounded-2xl object-cover shadow-2xl"
            />
            {selectedProfile.nickname && (
              <p className="text-white font-bold text-base drop-shadow">{selectedProfile.nickname}</p>
            )}
          </div>
        </div>
      )}
    </main>
  )
}