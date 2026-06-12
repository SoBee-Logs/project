import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import beeImage from '../../assets/so-bee.png'
import calendarIcon from '../../assets/calendar_icon.png'

const mapDiaryToPost = (item) => ({
  id: item.diaryId,
  title: item.title || '무제',
  diaryLines: item.diaryLines?.length > 0
    ? item.diaryLines
    : [item.subtitle].filter(Boolean),
  date: item.date || '',
  time: item.time || '',
  authorNickname: item.authorNickname || item.authorName || '익명',
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

function FeedPost({ post, onToggleLike, personaImage }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const images = post.imageUrls || []
  const touchStartX = useRef(null)

  const goPrev = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  const goNext = () => setCurrentIndex((prev) => (prev + 1) % images.length)

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) diff > 0 ? goNext() : goPrev()
    touchStartX.current = null
  }

  return (
    <article className="bg-white mb-3 rounded-2xl overflow-hidden shadow-sm mx-4">
      <header className="flex items-center gap-3 px-4 py-3">
        <img
          src={personaImage ?? beeImage}
          alt={post.authorNickname}
          className="w-9 h-9 rounded-full object-cover bg-white overflow-hidden"
        />
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-sm font-bold text-gray-900">{post.authorNickname}</span>
          <span className="block text-xs text-gray-500 truncate">{post.personaTitle}</span>
        </span>
      </header>

      <figure className="m-0 w-full aspect-square bg-gray-100 relative group overflow-hidden"
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {images.length > 0 && (
          <img src={images[currentIndex]} alt="" className="w-full h-full object-cover" />
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 flex items-center justify-center shadow text-gray-600 opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 transition-opacity duration-200 z-10"
              aria-label="이전 이미지"
            >
              <span className="text-[24px] leading-none -translate-y-[3px]">‹</span>
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 flex items-center justify-center shadow text-gray-600 opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 transition-opacity duration-200 z-10"
              aria-label="다음 이미지"
            >
              <span className="text-[24px] leading-none -translate-y-[3px]">›</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onToggleLike(post.id)}
          className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/95 shadow flex items-center justify-center"
          aria-label="좋아요"
        >
          <svg width="14" height="14" viewBox="0 0 24 24"
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
              className={`rounded-full transition-all ${i === currentIndex ? 'w-4 h-1.5' : 'w-1.5 h-1.5'}`}
              style={{ background: i === currentIndex ? '#2F7DF6' : '#DCEBFF' }}
            />
          ))}
        </div>
      )}

      <section className="px-4 py-3 text-left">
        <h3 className="text-base font-bold text-gray-900 m-0 mb-2">{post.title}</h3>
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

export default function MyDiary() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [personaImage, setPersonaImage] = useState(null)
  const [activeRoom, setActiveRoom] = useState('전체')

  useEffect(() => {
    const fetchMyDiaries = async () => {
      setIsLoading(true)
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/diary/my-list', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        const mapped = data.map(mapDiaryToPost)
        setPosts(mapped)

        if (mapped.length > 0 && mapped[0].authorId) {
          const avatarRes = await fetch(`/api/avatar/${mapped[0].authorId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (avatarRes.ok) {
            const avatarData = await avatarRes.json()
            if (avatarData?.avatarImgUrl) setPersonaImage(avatarData.avatarImgUrl)
          }
        }
      } catch (err) {
        console.error('내 일기 목록 조회 실패', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMyDiaries()
  }, [])

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
        return { ...post, liked, likes: liked ? post.likes + 1 : Math.max(0, post.likes - 1) }
      })
    )
  }

  const roomLabels = ['전체', ...new Set(posts.map(p => p.personaTitle).filter(Boolean))]

  const filteredPosts = activeRoom === '전체'
    ? posts
    : posts.filter(p => p.personaTitle === activeRoom)

  const groupedPosts = filteredPosts.reduce((acc, post) => {
    const date = post.date || '날짜 없음'
    if (!acc[date]) acc[date] = []
    acc[date].push(post)
    return acc
  }, {})

  return (
    <main className="min-h-full bg-[#F5F7FB]">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="px-4 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center text-gray-700"
            aria-label="뒤로가기"
          >
            <span className="text-[22px] leading-none">‹</span>
          </button>
          <h1 className="text-[16px] font-bold text-gray-900 m-0">나의 일기</h1>
        </div>

        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {roomLabels.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setActiveRoom(label)}
              className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold border-0"
              style={{
                background: activeRoom === label ? '#2F7DF6' : '#EBF5FF',
                color: activeRoom === label ? '#FFFFFF' : '#0073BC',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="py-1 pb-4">
        {isLoading ? (
          <p className="text-center text-sm text-gray-400 py-12">불러오는 중...</p>
        ) : filteredPosts.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">아직 작성한 일기가 없어요</p>
        ) : (
          Object.entries(groupedPosts).map(([date, datePosts]) => (
            <div key={date}>
              <div className="flex items-center gap-3 px-4 py-1.5">
                <div className="flex-1 h-px" style={{ background: '#DCEBFF' }} />
                <div
                  className="flex items-center rounded-full border shrink-0"
                  style={{ padding: '5px 12px 5px 8px', gap: '7px', background: '#F3F8FF', borderColor: '#DCEBFF', boxShadow: '0 3px 10px rgba(31, 122, 224, 0.05)' }}
                >
                  <img src={calendarIcon} alt="" className="w-[20px] h-[20px] object-contain shrink-0" />
                  <span className="text-[11px] font-bold" style={{ color: '#1F5FAE', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
                    {formatFeedDate(date)}
                  </span>
                </div>
                <div className="flex-1 h-px" style={{ background: '#DCEBFF' }} />
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