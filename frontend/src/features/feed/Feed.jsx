import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import RoomTabs from '../../common/components/RoomTabs'
import StatusBar from '../../common/components/StatusBar'

const mapDiaryToPost = (item) => ({
  id: item.diaryId,
  title: item.title || '무제',
  diaryLines: item.diaryLines?.length > 0
    ? item.diaryLines
    : [item.subtitle].filter(Boolean),
  date: item.date || '',
  time: item.time || '',
  authorNickname: item.authorName || '익명',
  personaTitle: item.roomLabel || '',
  imageUrls: item.imageUrls?.length > 0 ? item.imageUrls : [item.imageUrl].filter(Boolean),
  liked: false,
  likes: item.likes ?? 0,
  roomId: `room_${item.roomId}`,
  photoIds: item.photoIds || [],
  matchedPhotoIds: item.matchedPhotoIds || [],
})

function FeedPost({ post, onToggleLike, personaImage }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const images = post.imageUrls || []

  return (
    <article className="bg-white mb-3 rounded-2xl overflow-hidden shadow-sm mx-4">
      <header className="flex items-center gap-3 px-4 py-3">
        <img
          src={personaImage ?? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&q=80'}
          alt={post.authorNickname}
          className="w-9 h-9 rounded-full object-cover"
        />
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-sm font-bold text-gray-900">{post.authorNickname}</span>
          <span className="block text-xs text-gray-500 truncate">{post.personaTitle}</span>
        </span>
      </header>

      <figure className="m-0 w-full aspect-square bg-gray-100 relative overflow-hidden">
        {images.length > 0 && (
          <img src={images[currentIndex]} alt="" className="w-full h-full object-cover" />
        )}

        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 flex items-center justify-center shadow text-base"
            >
              ‹
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 flex items-center justify-center shadow text-base"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${i === currentIndex ? 'bg-white' : 'bg-white/50'}`}
                />
              ))}
            </div>
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

      <section className="px-4 py-3 text-left">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base font-bold text-gray-900 m-0">{post.title}</h3>
        </div>
        {post.diaryLines.map((line, i) => (
          <p key={i} className="text-sm text-gray-700 leading-relaxed m-0 mb-1">
            {line}
          </p>
        ))}
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
  const [personaImage, setPersonaImage] = useState(null)

  useEffect(() => {
    const fetchPersona = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const decoded = JSON.parse(atob(token.split('.')[1]))
        const userId = decoded.sub
        const res = await fetch(`/api/avatar/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.avatarImgUrl) setPersonaImage(data.avatarImgUrl)
        }
      } catch {
        // 실패 시 기본 이미지 유지
      }
    }
    fetchPersona()
  }, [])

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
        setPosts(data.map(mapDiaryToPost))
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
    <main className="min-h-full bg-[#F3F4F6]">
      <StatusBar />
      <RoomTabs activeRoom={activeRoom} onChange={setActiveRoom} showAdd />

      <section className="py-3 pb-4">
        {isLoading ? (
          <p className="text-center text-sm text-gray-400 py-12">불러오는 중...</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">
            이 모임방에 아직 일기가 없어요
          </p>
        ) : (
          Object.entries(groupedPosts).map(([date, datePosts]) => (
            <div key={date}>
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="flex-1 h-px bg-gray-300" />
                <span className="text-[11px] text-gray-400 font-medium shrink-0">📅 {date}</span>
                <div className="flex-1 h-px bg-gray-300" />
              </div>
              {datePosts.map((post) => (
                <FeedPost
                  key={post.id}
                  post={post}
                  onToggleLike={handleToggleLike}
                  personaImage={personaImage}
                />
              ))}
            </div>
          ))
        )}
      </section>
    </main>
  )
}