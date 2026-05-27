import { useEffect, useState } from 'react'
import RoomTabs from '../../common/components/RoomTabs'
import StatusBar from '../../common/components/StatusBar'

const CURRENT_USER = {
  nickname: '사용자',
  avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&q=80',
}

const mapDiaryToPost = (item) => ({
  id: item.diaryId,
  title: item.title || '무제',
  diaryLines: item.diaryLines?.length > 0
    ? item.diaryLines
    : [item.subtitle].filter(Boolean),
  date: item.date || '',
  authorNickname: item.authorName || '익명',
  avatarUrl: CURRENT_USER.avatarUrl,
  personaTitle: item.roomLabel || '',
  imageUrls: item.imageUrls?.length > 0 ? item.imageUrls : [item.imageUrl].filter(Boolean),
  liked: false,
  likes: item.likes ?? 0,
  roomId: `room_${item.roomId}`,
  // 매핑 배지용 — 슬라이드 인덱스와 1:1 대응
  photoIds: item.photoIds || [],
  matchedPhotoIds: item.matchedPhotoIds || [],
})

function FeedPost({ post, onToggleLike }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const images = post.imageUrls || []

  return (
    <article className="bg-white mb-3 rounded-2xl overflow-hidden shadow-sm mx-4">
      <header className="flex items-center gap-3 px-4 py-3">
        <img
          src={post.avatarUrl}
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

        {/* 현재 슬라이드 사진의 결제 매핑 여부 배지 */}
        {post.photoIds?.[currentIndex] != null && (
          post.matchedPhotoIds?.includes(post.photoIds[currentIndex]) ? (
            <span className="absolute top-2 left-2 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
              💳 매핑됨
            </span>
          ) : (
            <span className="absolute top-2 left-2 flex items-center gap-1 bg-gray-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
              🔍 미매핑
            </span>
          )
        )}

        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow text-lg"
            >
              ‹
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow text-lg"
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
          className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white/95 shadow flex items-center justify-center"
          aria-label="좋아요"
        >
          <svg
            width="22"
            height="22"
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
          <time className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">{post.date}</time>
        </div>
        {post.diaryLines.map((line, i) => (
          <p key={i} className="text-sm text-gray-700 leading-relaxed m-0 mb-1">
            {line}
          </p>
        ))}
        <p className="text-xs text-gray-400 mt-2 m-0">좋아요 {post.likes}개</p>
      </section>
    </article>
  )
}

export default function Feed() {
  const [activeRoom, setActiveRoom] = useState(null)
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(false)

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
                <FeedPost key={post.id} post={post} onToggleLike={handleToggleLike} />
              ))}
            </div>
          ))
        )}
      </section>
    </main>
  )
}