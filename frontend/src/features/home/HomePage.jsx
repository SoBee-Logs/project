import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDragScroll } from '../../common/hooks/useDragScroll'
import StatusBar from '../../common/components/StatusBar'
import SettingsDrawer from './SettingsDrawer'
import { jwtDecode } from 'jwt-decode'
import cameraHalo from '../../assets/camera_3d_halo.png'
import receiptHalo from '../../assets/receipt_3d_halo.png'


export default function Home() {
  const navigate = useNavigate()

  const token = localStorage.getItem("token")
  let userId = null
  try {
    if (token) {
      const decoded = jwtDecode(token)
      userId = decoded.sub
    }
  } catch (e) {
    console.error("토큰 디코딩 실패", e)
  }

  const { ref: feedRef, dragging: feedDragging, onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onClickCapture } = useDragScroll()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [persona, setPersona] = useState(null)
  const [feedPreviews, setFeedPreviews] = useState([])
  const [currentTime, setCurrentTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }))
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])


  const fetchPersona = () => {
    if (!userId) return
    fetch(`/api/users/${userId}/persona`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPersona(data) })
      .catch(() => {})
  }

  useEffect(() => {
    fetchPersona()
  }, [userId])

  useEffect(() => {
    const fetchFeedPreviews = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const groupsRes = await fetch('/api/groups', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!groupsRes.ok) return
        const groups = await groupsRes.json()
  
        // 그룹 먼저 세팅 (이미지 없이)
        setFeedPreviews(groups.map(g => ({
          groupId: g.groupId,
          groupName: g.groupName,
          imageUrl: null,  // 일단 null
        })))
  
        // 이미지는 비동기로 하나씩 채우기
        groups.forEach(async (g) => {
          try {
            const diaryRes = await fetch(`/api/diary/list?groupId=${g.groupId}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            const diaries = await diaryRes.json()
            const latestImage = diaries?.[0]?.imageUrls?.[0] ?? diaries?.[0]?.imageUrl ?? null
            setFeedPreviews(prev => prev.map(f =>
              f.groupId === g.groupId ? { ...f, imageUrl: latestImage } : f
            ))
          } catch {}
        })
      } catch (err) {
        console.error('피드 미리보기 로딩 실패', err)
      }
    }
    fetchFeedPreviews()
  }, [])


  return (
    <main className="min-h-full text-left pb-2" style={{ background: '#FFFFFF' }}>


      <section style={{ background: '#FFFFFF' }}>
        <StatusBar />

        {/* 검색바 */}
        <header className="px-3 pt-1 pb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="flex-1 flex items-center gap-2 rounded-2xl px-4 py-1.5 text-left cursor-pointer"
            style={{ background: '#F0F6FF' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21BCEA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="text-[11px] flex-1" style={{ color: '#0073BC' }}>궁금한 걸 자유롭게 물어보세요!</span>
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)} className="w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer border-0" style={{ background: '#F0F6FF' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0073BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </header>

        {/* 페르소나 이미지 */}
        <figure className="relative w-full mt-1 mb-0 m-0 px-3 min-h-[240px]">
          {persona?.avatarImgUrl ? (
            <>
              <img
                src={persona.avatarImgUrl}
                alt="페르소나 꿀벌 아바타"
                className="w-full h-auto block rounded-2xl"
              />
              <div className="absolute bottom-0 left-3 right-3 h-20 bg-gradient-to-t from-black/40 to-transparent rounded-b-2xl" />
              <div className="absolute bottom-3 left-6 text-white">
                <span className="block text-[10px] font-extrabold opacity-80">나의 소비 페르소나</span>
                <span className="block text-[16px] font-extrabold leading-tight">{persona.avatarName}</span>
              </div>
            </>
          ) : (
            <div className="w-full min-h-[240px] rounded-2xl bg-gray-100 flex flex-col items-center justify-center gap-2">
              <span className="text-3xl">🐝</span>
              <p className="text-sm font-medium text-gray-400">아직 아바타가 생성되지 않았습니다</p>
              <p className="text-xs text-gray-300">소비 사진을 찍으면 분석을 시작해요!</p>
            </div>
          )}
        </figure>

        {/* 금융상품 추천 버튼 */}
        <div className="px-3">
          <button
            type="button"
            onClick={() => navigate('/report', { state: { scrollTo: 'aiRecommend' } })}
            style={{
              width: '100%',
              height: '48px',
              margin: '10px 0 12px',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              border: 'none',
              borderRadius: '14px',
              background: '#0073BC',
              color: '#ffffff',
              boxShadow: '0 8px 18px rgba(0,115,188,0.24)',
              cursor: 'pointer',
            }}
          >
            <span style={{
              width: '28px', height: '28px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%', background: 'rgba(255,255,255,0.18)', fontSize: '15px',
            }}>💰</span>
            <span style={{
              fontSize: '12px', fontWeight: 700,
              letterSpacing: '-0.3px', textAlign: 'left', whiteSpace: 'nowrap',
            }}>페르소나 기반 금융 상품 추천 바로가기</span>
          </button>
        </div>
      </section>

      {/* 기능 카드 */}
      <section className="px-3 mt-1">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/camera', { 
              state: { myGroups: feedPreviews } //groups 재호출 하지 않도록
          })}
            className="rounded-2xl overflow-hidden flex flex-col cursor-pointer border-0 text-left"
            style={{
              background: '#EBF5FF',
              borderRadius: '14px',
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div className="w-full flex items-center justify-center pt-1 pb-0">
              <img src={cameraHalo} alt="camera" className="w-16 h-16 object-contain block" />
            </div>
            <div className="px-2 pb-2 -mt-3">
              <span className="block text-[9px] mb-0.5" style={{ color: '#21BCEA' }}>{currentTime}</span>
              <span className="block text-[12px] font-bold leading-tight" style={{ color: '#003B72' }}>소비가 있다면 찍어주세요!</span>
            </div>
          </button>

          <button
            type="button" //consumption-log로 이동할 때 selectedRooms와 myGroups 상태를 함께 전달
            onClick={() => {
              const roomIds = feedPreviews.map(f => f.groupId)
              navigate('/consumption-log', { 
                  state: { 
                      selectedRooms: roomIds,
                      myGroups: feedPreviews
                  } 
              })
          }}
            className="rounded-2xl overflow-hidden flex flex-col cursor-pointer border-0 text-left"
            style={{
              background: '#EBF5FF',
              borderRadius: '14px',
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div className="w-full flex items-center justify-center pt-1 pb-0">
              <img src={receiptHalo} alt="receipt" className="w-16 h-16 object-contain block" />
            </div>
            <div className="px-2 pb-2 -mt-3">
              <span className="block text-[9px] mb-0.5" style={{ color: '#21BCEA' }}>오늘의 소비 사진을 확인해보세요</span>
              <span className="block text-[12px] font-bold leading-tight" style={{ color: '#003B72' }}>나의 소비 로그</span>
            </div>
          </button>
        </div>
      </section>

      {/* 피드 */}
      <section className="px-3 pt-5 pb-24">
        <h2 className="text-[17px] font-bold mb-3" style={{ color: '#003B72' }}>피드</h2>
        {feedPreviews.length === 0 ? (
          <p className="text-[13px] text-gray-400 text-center py-6">
            아직 모임방이 없어요. 모임을 만들어보세요!
          </p>
        ) : (
          <div
            ref={feedRef}
            className={`flex gap-3 overflow-x-auto pb-2 scrollbar-hide ${feedDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onClickCapture={onClickCapture}
          >
            {feedPreviews.map((item) => (
              <button
                key={item.groupId}
                type="button"
                onClick={() => navigate('/feed', { state: { roomId: item.groupId } })}
                className="shrink-0 w-[150px] text-left p-0 border-0 bg-transparent cursor-pointer"
              >
                <figure className="relative w-[150px] h-[150px] rounded-2xl overflow-hidden bg-gray-100 m-0 mb-1.5 shadow-sm">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#F3F4F6]">
                      <span className="text-3xl">📷</span>
                      <span className="text-[10px] text-gray-400">사진이 없어요</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 pb-2 pt-4">
                    <p className="text-[11px] font-bold text-white m-0 truncate">{item.groupName}</p>
                  </div>
                </figure>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 설정 드로어 */}
      <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  )
}