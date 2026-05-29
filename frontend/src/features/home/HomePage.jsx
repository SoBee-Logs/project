import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDragScroll } from '../../common/hooks/useDragScroll'
import StatusBar from '../../common/components/StatusBar'
import { jwtDecode } from 'jwt-decode'
import cameraHalo from '../../assets/camera_3d_halo.png'
import receiptHalo from '../../assets/receipt_3d_halo.png'

const BANKS = [
  { code: "0002", name: "산업은행" }, { code: "0003", name: "기업은행" },
  { code: "0004", name: "국민은행" }, { code: "0007", name: "수협은행" },
  { code: "0011", name: "농협은행" }, { code: "0020", name: "우리은행" },
  { code: "0023", name: "SC은행" },  { code: "0027", name: "씨티은행" },
  { code: "0031", name: "대구은행" }, { code: "0032", name: "부산은행" },
  { code: "0034", name: "광주은행" }, { code: "0035", name: "제주은행" },
  { code: "0037", name: "전북은행" }, { code: "0039", name: "경남은행" },
  { code: "0045", name: "새마을금고" }, { code: "0048", name: "신협은행" },
  { code: "0071", name: "우체국" },  { code: "0081", name: "KEB하나은행" },
  { code: "0088", name: "신한은행" }, { code: "0089", name: "K뱅크" },
]

const CARDS = [
  { code: "0301", name: "KB카드" },    { code: "0302", name: "현대카드" },
  { code: "0303", name: "삼성카드" },  { code: "0304", name: "NH카드" },
  { code: "0305", name: "BC카드" },    { code: "0306", name: "신한카드" },
  { code: "0307", name: "씨티카드" },  { code: "0309", name: "우리카드" },
  { code: "0311", name: "롯데카드" },  { code: "0313", name: "하나카드" },
  { code: "0315", name: "전북카드" },  { code: "0316", name: "광주카드" },
  { code: "0320", name: "수협카드" },  { code: "0321", name: "제주카드" },
]

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

  const { ref: feedRef, dragging: feedDragging, onMouseDown, onMouseMove, onMouseUp, onMouseLeave } = useDragScroll()

  const [showPopup, setShowPopup] = useState(() => {
    return localStorage.getItem(`mydataConnected_${userId}`) !== "true"
  })
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState([])
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

  useEffect(() => {
    if (!userId) return
    fetch(`/api/users/${userId}/persona`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPersona(data) })
      .catch(() => {})
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
       const previews = await Promise.all(
        groups.map(async (g) => {
          try {
            const diaryRes = await fetch(`/api/diary/list?groupId=${g.groupId}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            const diaries = await diaryRes.json()
            // 가장 최신 일기의 첫 번째 이미지
            const latestImage = diaries?.[0]?.imageUrls?.[0] ?? diaries?.[0]?.imageUrl ?? null
            return {
              groupId: g.groupId,
              groupName: g.groupName,
              imageUrl: latestImage,
            }
          } catch {
            return { groupId: g.groupId, groupName: g.groupName, imageUrl: null }
          }
        })
      )
        setFeedPreviews(previews)
      } catch (err) {
        console.error('피드 미리보기 로딩 실패', err)
      }
    }
    fetchFeedPreviews()
  }, [])

  const toggleSelect = (code) => {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const handleConnect = () => {
    if (selected.length === 0) return alert("최소 1개 이상 선택해주세요!")
    setLoading(true)
    setTimeout(() => {
      localStorage.setItem(`mydataConnected_${userId}`, "true")
      setLoading(false)
      setShowPopup(false)
    }, 2000)
  }

  return (
    <main className="min-h-full text-left pb-2" style={{ background: '#FFFFFF' }}>

      {showPopup && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "white", borderRadius: "20px", padding: "24px",
            width: "90%", maxWidth: "340px", maxHeight: "85vh", overflowY: "auto",
          }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ color: "#0073BC", fontWeight: "bold", fontSize: "16px", marginBottom: "8px" }}>마이데이터 연동 중</p>
                <p style={{ color: "#888", fontSize: "13px", marginBottom: "24px" }}>금융 데이터를 불러오고 있어요</p>
                <div style={{
                  margin: "0 auto", width: "36px", height: "36px",
                  border: "4px solid #0073BC", borderTop: "4px solid transparent",
                  borderRadius: "50%", animation: "spin 1s linear infinite",
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <>
                <h3 style={{ color: "#0073BC", fontWeight: "bold", fontSize: "17px", marginBottom: "4px" }}>마이데이터 연동</h3>
                <p style={{ color: "#888", fontSize: "12px", marginBottom: "20px" }}>연동할 기관을 선택해주세요</p>
                <p style={{ fontSize: "13px", fontWeight: "bold", color: "#333", marginBottom: "10px" }}>은행</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "16px" }}>
                  {BANKS.map((bank) => (
                    <button key={bank.code} onClick={() => toggleSelect(bank.code)} style={{
                      padding: "8px 6px", borderRadius: "8px",
                      border: selected.includes(bank.code) ? "2px solid #0073BC" : "1.5px solid #eee",
                      backgroundColor: selected.includes(bank.code) ? "#E8F4FD" : "white",
                      color: selected.includes(bank.code) ? "#0073BC" : "#555",
                      fontWeight: selected.includes(bank.code) ? "bold" : "normal",
                      fontSize: "11px", cursor: "pointer",
                    }}>{bank.name}</button>
                  ))}
                </div>
                <p style={{ fontSize: "13px", fontWeight: "bold", color: "#333", marginBottom: "10px" }}>카드사</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "20px" }}>
                  {CARDS.map((card) => (
                    <button key={card.code} onClick={() => toggleSelect(card.code)} style={{
                      padding: "8px 6px", borderRadius: "8px",
                      border: selected.includes(card.code) ? "2px solid #0073BC" : "1.5px solid #eee",
                      backgroundColor: selected.includes(card.code) ? "#E8F4FD" : "white",
                      color: selected.includes(card.code) ? "#0073BC" : "#555",
                      fontWeight: selected.includes(card.code) ? "bold" : "normal",
                      fontSize: "11px", cursor: "pointer",
                    }}>{card.name}</button>
                  ))}
                </div>
                <button onClick={handleConnect} style={{
                  width: "100%", padding: "14px", backgroundColor: "#0073BC", color: "white",
                  border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "bold",
                  cursor: "pointer", marginBottom: "8px",
                }}>연동하기 ({selected.length}개 선택)</button>
                <button onClick={() => setShowPopup(false)} style={{
                  width: "100%", padding: "12px", backgroundColor: "white", color: "#aaa",
                  border: "1px solid #eee", borderRadius: "10px", fontSize: "13px", cursor: "pointer",
                }}>나중에 하기</button>
              </>
            )}
          </div>
        </div>
      )}

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
          <button type="button" className="w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer border-0" style={{ background: '#F0F6FF' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0073BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </header>

        {/* 페르소나 이미지 */}
        <figure className="relative w-full mt-1 mb-0 m-0 px-3">
          <img
            src={persona?.avatarImgUrl ?? '/persona-bee.png'}
            alt="페르소나 꿀벌 아바타"
            className="w-full h-auto block rounded-2xl"
          />
          <div className="absolute bottom-0 left-3 right-3 h-20 bg-gradient-to-t from-black/40 to-transparent rounded-b-2xl" />
          <div className="absolute bottom-3 left-6 text-white">
            <span className="block text-[10px] font-light opacity-80">나의 소비 페르소나</span>
            <span className="block text-[16px] font-extrabold leading-tight">{persona?.avatarName ?? '분석 중...'}</span>
          </div>
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
            onClick={() => navigate('/camera')}
            className="rounded-2xl overflow-hidden flex flex-col cursor-pointer border-0 text-left"
            style={{
              background: 'radial-gradient(circle at 50% 48%, rgba(33,188,234,0.12) 0%, rgba(33,188,234,0.08) 42%, rgba(255,255,255,0) 68%), linear-gradient(180deg, #F4FAFF 0%, #EEF7FF 100%)',
              boxShadow: '0 18px 35px rgba(0,32,80,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
              border: '1px solid rgba(0,72,145,0.08)'
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
            type="button"
            onClick={async () => {
              const token = localStorage.getItem("token")
              const res = await fetch('/api/groups', {
                headers: { Authorization: `Bearer ${token}` },
              })
              const groups = await res.json()
              const roomIds = groups.map(g => g.groupId)
              navigate('/consumption-log', { state: { selectedRooms: roomIds } })
            }}
            className="rounded-2xl overflow-hidden flex flex-col cursor-pointer border-0 text-left"
            style={{
              background: 'radial-gradient(circle at 50% 48%, rgba(33,188,234,0.12) 0%, rgba(33,188,234,0.08) 42%, rgba(255,255,255,0) 68%), linear-gradient(180deg, #F4FAFF 0%, #EEF7FF 100%)',
              boxShadow: '0 18px 35px rgba(0,32,80,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
              border: '1px solid rgba(0,72,145,0.08)'
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
    </main>
  )
}