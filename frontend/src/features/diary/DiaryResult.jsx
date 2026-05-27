import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import StatusBar from '../../common/components/StatusBar'
import { ROOMS, SKY_BLUE } from '../../common/utils/rooms'

export default function DiaryResult() {
  const navigate = useNavigate()
  const location = useLocation()

  // diaries 기준으로 selectedRooms 재구성 — 스킵된 방 제외
  const diariesFromState = location.state?.diaries ?? []
  const selectedRooms = diariesFromState.map((d) => d.roomId)

  const [roomIndex, setRoomIndex] = useState(0)
  const [diaries, setDiaries] = useState(diariesFromState)
  const [imageSlide, setImageSlide] = useState(0)
  const [includedRoomIds, setIncludedRoomIds] = useState([])
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const diary = diaries[roomIndex]
  const bodyText = diary
    ? [diary.subtitle, ...(diary.diaryLines ?? [])].filter(Boolean).join('\n\n')
    : ''

  const handleRegenerate = async () => {
    if (isRegenerating) return
    setIsRegenerating(true)
    const token = localStorage.getItem('token')
    const today = new Date().toISOString().split('T')[0]

    try {
      const res = await fetch('/api/diary/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId: diary.roomId,
          date: today,
        }),
      })
      if (!res.ok) throw new Error('서버 오류')
      const newDiary = await res.json()

      setDiaries((prev) =>
        prev.map((d, i) => (i === roomIndex ? newDiary : d))
      )
      setImageSlide(0)
    } catch (err) {
      alert('일기 재생성에 실패했어요. 다시 시도해주세요.')
      console.error('재생성 실패', err)
    } finally {
      setIsRegenerating(false)
    }
  }

  const finishRoom = (include) => {
    const roomId = selectedRooms[roomIndex]
    const nextIncluded = include ? [...includedRoomIds, roomId] : includedRoomIds

    if (roomIndex < selectedRooms.length - 1) {
      setIncludedRoomIds(nextIncluded)
      setRoomIndex((i) => i + 1)
      setImageSlide(0)
    } else {
      setIncludedRoomIds(nextIncluded)
      setShowConfirmModal(true)
    }
  }

  const selectedRoomLabels = includedRoomIds
    .map((id) => diaries.find((d) => d.roomId === id)?.roomLabel ?? null)
    .filter(Boolean)

  const modalMessage =
    selectedRoomLabels.length > 0
      ? `선택한 ${selectedRoomLabels.join(', ')}의 일기를 올리시겠습니까?`
      : '선택한 모임방이 없습니다. 피드로 이동하시겠습니까?'

  const handleConfirmUpload = async () => {
    const toUpload = diaries.filter((d) => includedRoomIds.includes(d.roomId))
    setShowConfirmModal(false)

    const token = localStorage.getItem('token')
    for (const d of toUpload) {
      try {
        const diaryContent = JSON.stringify({
          title:    d.title,
          subtitle: d.subtitle,
          lines:    d.diaryLines,
        })
        await fetch('/api/diary/save', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupId:      d.roomId,
            diaryContent: diaryContent,
            photoIds:     d.photoIds ?? [],
          }),
        })
      } catch {
        // 저장 실패해도 피드 이동은 계속 진행
      }
    }

    navigate('/feed', { state: { newDiaries: toUpload } })
  }

  // early return — diaries 빈 배열이면 실패 화면
  if (diaries.length === 0) {
    return (
      <main className="flex flex-col items-center justify-center min-h-full bg-[#FAFAFA] gap-6 px-6">
        <StatusBar />
        <span className="text-5xl">😢</span>
        <h2 className="text-[18px] font-bold text-gray-800 text-center m-0">일기 생성에 실패했어요</h2>
        <p className="text-[13px] text-gray-500 text-center leading-relaxed m-0">
          서버가 응답하지 않거나<br />오늘 사진이 없을 수 있어요.
        </p>
        <button
          type="button"
          onClick={() => navigate('/camera', { replace: true })}
          className="px-8 py-3.5 rounded-2xl text-white text-[14px] font-bold"
          style={{ backgroundColor: '#38BDF8' }}
        >
          다시 시도하기
        </button>
      </main>
    )
  }

  const slides = diary.imageUrls?.length > 0
    ? diary.imageUrls
    : diary.imageUrl
      ? [diary.imageUrl]
      : []

  const hasPhotos = slides.length > 0

  return (
    <main className="flex flex-col min-h-full bg-[#FAFAFA] relative">
      <StatusBar />

      <nav className="flex justify-center gap-6 px-5 py-4 border-b border-gray-200 bg-white shrink-0">
        {selectedRooms.map((roomId, i) => {
          const active = i === roomIndex
          const label = diaries[i]?.roomLabel ?? ROOMS.find((r) => r.id === roomId)?.label ?? `방${i + 1}`
          const done = i < roomIndex
          const included = includedRoomIds.includes(roomId)

          return (
            <button
              key={roomId}
              type="button"
              onClick={() => {
                if (!showConfirmModal && i <= roomIndex) {
                  setRoomIndex(i)
                  setImageSlide(0)
                }
              }}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className={`w-12 h-12 rounded-full border-[3px] flex items-center justify-center text-[11px] font-bold ${
                  active
                    ? 'border-[#38BDF8] text-[#38BDF8] bg-sky-50'
                    : done
                      ? included
                        ? 'border-green-400 text-green-500 bg-green-50'
                        : 'border-red-400 text-red-400 bg-red-50'
                      : 'border-gray-200 text-gray-400 bg-gray-50'
                }`}
              >
                {label.slice(0, 2)}
              </span>
              <span
                className={`text-[12px] font-medium ${
                  active ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </button>
          )
        })}
      </nav>

      <section className="flex-1 overflow-y-auto px-5 py-4 pb-28">
        <p className="text-[14px] font-bold m-0 mb-3" style={{ color: SKY_BLUE }}>
          나의 소비 일기
        </p>

        <figure
          className="relative m-0 mb-4 rounded-2xl overflow-hidden border-[5px] bg-white"
          style={{ borderColor: SKY_BLUE }}
        >
          {hasPhotos ? (
            <>
              <img src={slides[imageSlide]} alt="" className="w-full aspect-[4/3] object-cover" />

          {/* 현재 슬라이드 사진 결제 매핑 여부 배지 — 매핑됨/미매핑 구분 표시 */}
          {diary.photoIds?.[imageSlide] != null && (
            diary.matchedPhotoIds?.includes(diary.photoIds[imageSlide]) ? (
              <span className="absolute top-2 left-2 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                💳 매핑됨
              </span>
            ) : (
              <span className="absolute top-2 left-2 flex items-center gap-1 bg-gray-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                🔍 미매핑
              </span>
            )
          )}

              <button
                type="button"
                onClick={() => setImageSlide((s) => Math.max(0, s - 1))}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-gray-600 shadow"
                aria-label="이전"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setImageSlide((s) => Math.min(slides.length - 1, s + 1))}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-gray-600 shadow"
                aria-label="다음"
              >
                ›
              </button>
              <span className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {slides.map((_, i) => (
                  <span
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i === imageSlide ? 'bg-gray-900' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </span>
            </>
          ) : (
            <div className="w-full aspect-[4/3] flex flex-col items-center justify-center bg-gray-50 gap-3">
              <span className="text-4xl">📷</span>
              <p className="text-[13px] text-gray-400 m-0">이 모임방에 등록된 사진이 없어요</p>
            </div>
          )}
        </figure>

        <article className="bg-white rounded-2xl p-5 shadow-md text-left">
          <header className="flex items-start justify-between gap-2 mb-3">
            <h2 className="text-[17px] font-bold text-gray-900 m-0">{diary.title}</h2>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="w-8 h-8 shrink-0 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-40"
              aria-label="재생성"
            >
              <svg
                width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
                className={isRegenerating ? 'animate-spin' : ''}
              >
                <path d="M1 4v6h6M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
            </button>
          </header>
          <p className="text-[13px] text-gray-500 m-0 whitespace-pre-line leading-relaxed">
            {bodyText}
          </p>
        </article>

        {selectedRooms.length > 1 && (
          <p className="text-center text-[12px] text-gray-400 mt-4">
            {roomIndex + 1} / {selectedRooms.length}번째 모임방
          </p>
        )}
      </section>

      <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[375px] px-5 py-4 bg-[#FAFAFA] flex gap-3 z-10">
        <button
          type="button"
          onClick={() => finishRoom(false)}
          className="flex-1 py-3.5 rounded-full bg-[#9CA3AF] text-white text-[14px] font-bold"
        >
          일기 제외하기
        </button>
        <button
          type="button"
          onClick={() => finishRoom(true)}
          className="flex-1 py-3.5 rounded-full text-white text-[14px] font-bold"
          style={{ backgroundColor: SKY_BLUE }}
        >
          선택하기
        </button>
      </footer>

      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-8"
          role="dialog"
          aria-modal="true"
        >
          <article className="w-full max-w-[300px] bg-white rounded-2xl p-6 shadow-xl text-center">
            <p className="text-[15px] font-semibold text-gray-900 leading-relaxed m-0 mb-6">
              {modalMessage}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 text-[14px] font-semibold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmUpload}
                className="flex-1 py-3 rounded-xl text-white text-[14px] font-semibold"
                style={{ backgroundColor: SKY_BLUE }}
              >
                확인
              </button>
            </div>
          </article>
        </div>
      )}
    </main>
  )
}
