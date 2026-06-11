import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDragScroll } from '../../common/hooks/useDragScroll'
import SettingsDrawer from './SettingsDrawer'
import { jwtDecode } from 'jwt-decode'
import cameraHalo from '../../assets/camera.png'
import receiptHalo from '../../assets/log.png'
import productBag from '../../assets/recommend.png'
import beeImage from '../../assets/image 61.png'

const CATEGORY_MESSAGES = {
  '식비': [
    '밥심으로 사는 중 ㅋㅋ 🥢',
    '오늘도 든든하게 🍚',
    '먹는 게 남는 거죠 😋',
    '식비 탕진 중 ㅠㅠ',
    '맛있으면 0칼로리 ✨',
  ],
  '카페간식': [
    '카페인 없인 못 살아 ☕',
    '아아 한 잔이면 충분 🧊',
    '카페 단골 등극 중 ㅋㅋ',
    '커피값은 아깝지 않아 💙',
    '오늘도 스벅 가셨군요 😏',
  ],
  '패션쇼핑': [
    '입을 옷이 없어서요 ㅋㅋ 👗',
    '지갑 털렸지만 스타일 살았다 💅',
    '패션피플 등극 중 ✨',
    '새 옷 사면 기분 업 🛍️',
    '옷장이 또 터질 것 같아요 😅',
  ],
  '교통': [
    '오늘도 열심히 이동 중 🚇',
    '대중교통 만세 ✊',
    '교통비도 소비예요 ㅋㅋ 🚌',
    '어디까지 가셨어요? 🗺️',
    '이동하는 것도 기록이 돼요 📍',
  ],
  '여행숙박': [
    '여행 중이신가요? 부럽다 ✈️',
    '여행은 돈으로 사는 행복 🏖️',
    '지갑 얇아지는 여행길 ㅠㅠ',
    '저도 데려가요 🧳',
    '여행 사진 보여주세요 📸',
  ],
  '문화여가': [
    '문화생활 즐기는 중 🎬',
    '취미에 투자하는 건 필수 🎮',
    '힐링 타임 ✨',
    '여가시간도 소중한 소비 🎵',
    '재미있었나요? 🎭',
  ],
  '술유흥': [
    '오늘 한잔 하셨군요 🍺',
    '술자리도 추억이죠 🥂',
    '적당히 마셔요 ㅋㅋ 💛',
    '내일 숙취 없길 바라요 ㅠㅠ',
    '함께한 사람이 중요하죠 🍻',
  ],
  '의료건강': [
    '건강이 최고예요 💊',
    '몸 챙기는 현명한 소비 💙',
    '빨리 나으세요 🤒',
    '건강 투자 응원해요 💪',
    '몸 챙기는 거 잊지 마요 🏥',
  ],
  '뷰티미용': [
    '아름다움에 투자 중 💄',
    '예뻐지는 건 아깝지 않아요 💅',
    '뷰티 지출은 자기 투자 🪞',
    '예쁘면 다 용서돼요 ㅋㅋ 💕',
    '오늘도 꾸미기 성공 ✨',
  ],
  '교육학습': [
    '배움에 투자하는 당신 멋져요 📚',
    '열공 중이군요 ✏️',
    '미래를 위한 투자 중 🌱',
    '지식도 소비예요 📖',
    '공부하는 당신 응원해요 💪',
  ],
  '금융': [
    '재테크 중이군요 💰',
    '돈이 돈을 버는 중 📈',
    '현명한 금융 소비 👍',
    '투자는 신중하게 ⚠️',
    '미래 준비하는 당신 멋져요 💼',
  ],
  '경조선물': [
    '마음을 전했군요 🎁',
    '선물하는 사람이 더 행복하죠 💝',
    '정성이 담긴 소비예요 💛',
    '받는 사람이 좋아하겠어요 🥰',
    '소중한 사람에게 선물 중 🌸',
  ],
  '생활': [
    '살림 잘 하시는군요 ✨',
    '집이 편안해지는 소비 🛋️',
    '생활의 달인 등극 중 ㅋㅋ',
    '소소하지만 필요한 소비 💙',
    '생활용품도 소비예요 🏠',
  ],
  '온라인쇼핑': [
    '택배 올 생각에 설레죠? 📦',
    '새벽 장바구니 결제 맞죠? 😏',
    '언박싱 기대 중 ✨',
    '클릭 한 번에 지갑이 🛒',
    '택배 기다리는 중 ㅋㅋ',
  ],
  '주거통신': [
    '생활 인프라 유지 중 📱',
    '통신비도 고정지출이죠 💸',
    '월세 납부 완료 ✅',
    '꼬박꼬박 잘 내고 있어요 👍',
    '안정적인 생활을 위한 소비 🏡',
  ],
  '기타': [
    '다양한 소비를 하셨군요 🌈',
    '소비도 삶의 일부예요 💙',
    '오늘 하루도 수고했어요 🌟',
    '어떤 소비였나요? ✨',
    '모든 소비엔 이유가 있죠 😊',
  ],
}

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
  const [userName, setUserName] = useState(null)
  const [feedPreviews, setFeedPreviews] = useState([])
  const [currentTime, setCurrentTime] = useState('')
  const [diaryCount, setDiaryCount] = useState(0)
  const [categoryMessage, setCategoryMessage] = useState('')

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

    const fetchAll = async () => {
      try {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]

        const [personaRes, groupsRes, aiSummaryRes] = await Promise.all([
          fetch(`/api/users/${userId}/persona`),
          fetch('/api/groups', { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/photos/ai-summary?date=${yesterdayStr}`, { headers: { Authorization: `Bearer ${token}` } }),
        ])

        if (personaRes.ok) {
          const data = await personaRes.json()
          if (data) { setPersona(data); if (data.name) setUserName(data.name) }
        }

        if (aiSummaryRes.ok) {
          const data = await aiSummaryRes.json()
          const raw = data.summary || ''
          setCategoryMessage([...raw].slice(0, 15).join(''))
        }

        if (groupsRes.ok) {
          const groups = await groupsRes.json()
          setFeedPreviews(groups.map(g => ({ groupId: g.groupId, groupName: g.groupName, imageUrl: null })))

          const previewResults = await Promise.all(
            groups.map(g =>
              fetch(`/api/diary/preview?groupId=${g.groupId}`, { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.ok ? r.json() : { count: 0, myCount: 0, imageUrl: null })
                .catch(() => ({ count: 0, myCount: 0, imageUrl: null }))
            )
          )

          const previews = groups.map((g, i) => ({
            groupId: g.groupId,
            groupName: g.groupName,
            imageUrl: previewResults[i].imageUrl ?? null,
          }))

          const myCount = previewResults.length > 0 ? (previewResults[0].myCount ?? 0) : 0
          setDiaryCount(myCount)
          setFeedPreviews(previews)
        }
      } catch (err) {
        console.error('홈 화면 로딩 실패', err)
      }
    }

    fetchAll()
  }, [userId])

  return (
    <main className="min-h-full text-left pb-2 home-no-scrollbar" style={{ background: '#FFFFFF' }}>
      <section style={{ background: '#FFFFFF' }}>
        <figure className="relative w-full m-0 p-0" style={{ marginTop: '-1px' }}>
          {persona?.avatarImgUrl ? (
            <>
              <img
                src={persona.avatarImgUrl}
                alt="페르소나 꿀벌 아바타"
                className="w-full block"
                style={{ objectFit: 'contain', objectPosition: 'center top' }}
              />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: '60px',
                background: 'linear-gradient(to bottom, transparent, #FFFFFF)',
              }} />
              <div className="absolute top-3 left-0 right-0 z-20 px-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/search')}
                  className="flex-1 flex items-center gap-2 rounded-2xl px-4 py-1 text-left cursor-pointer"
                  style={{ background: 'rgba(240,246,255,0.85)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21BCEA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span className="text-[11px] flex-1" style={{ color: '#0073BC' }}>궁금한 걸 자유롭게 물어보세요!</span>
                </button>
                <button type="button" onClick={() => setSettingsOpen(true)} className="w-7.5 h-7.5 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer border-0" style={{ background: 'rgba(240,246,255,0.85)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0073BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="w-full min-h-[240px] rounded-2xl bg-white flex flex-col items-center justify-center gap-1">
              <img src={beeImage} alt="아바타" style={{ width: '60%', maxWidth: 200, objectFit: 'contain' }} />
              <p className="text-sm font-medium text-gray-400">아직 아바타가 생성되지 않았습니다</p>
              <p className="text-xs text-gray-300">소비 사진을 찍으면 분석을 시작해요!</p>
            </div>
          )}
        </figure>

        {/* 페르소나 카드 */}
        {persona?.avatarImgUrl && (
          <div className="px-3 -mt-3 relative z-10">
            <button
              type="button"
              onClick={() => navigate('/report')}
              className="w-full border-0 cursor-pointer text-left"
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                <p style={{ margin: '0 0 1px', fontSize: '12px', fontWeight: 700, color: '#9AA6B2' }}>
                  {userName ? `${userName}님의 소비 페르소나` : '나의 소비 페르소나'}
                </p>
                <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                  {persona.avatarName}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); navigate('/my-diary') }}
                    onKeyDown={(e) => e.key === 'Enter' && navigate('/my-diary')}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                      background: '#EBF5FF', borderRadius: '10px', padding: '4px 0',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: '10px', color: '#9AA6B2', fontWeight: 600, marginBottom: '-5px' }}>📸 이번 주 기록</span>
                    <strong style={{ fontSize: '12px', color: '#111827', fontWeight: 800 }}>{diaryCount}</strong>
                  </div>
                  <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    background: '#EBF5FF', borderRadius: '10px', padding: '1px 0',
                  }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#9AA6B2', fontWeight: 600, marginBottom: '2px' }}>
                      💳 어제 소비 요약
                    </span>
                    <span style={{ fontSize: '11px', color: '#0073BC', fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
                      {categoryMessage || '오늘도 소비 기록 중 ✨'}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        )}
      </section>

      {/* 기능 카드 */}
      <section className="px-3 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/camera', { state: { myGroups: feedPreviews } })}
            className="rounded-[18px] flex flex-col cursor-pointer border-0 text-left relative"
            style={{
              background: '#2F7DF6',
              border: 'none',
              boxShadow: '0 8px 18px rgba(47,125,246,0.18)',
              minHeight: '72px',
              overflow: 'visible',
            }}
          >
            <div className="px-4 pt-4">
              <span className="block text-[15px] font-bold leading-tight" style={{ color: '#FFFFFF' }}>카메라</span>
              <span className="block text-[11px] font-bold leading-tight mt-2" style={{ color: '#FFFFFF' }}>소비 사진을 찍어주세요!</span>
            </div>
            <div className="flex-1 flex items-end justify-end">
              <img
                src={cameraHalo}
                alt="camera"
                className="object-contain block"
                style={{ width: '82px', height: '82px', marginBottom: '-5px', marginRight: '8px' }}
              />
            </div>
          </button>

          <div className="grid grid-rows-2 gap-3">
            <button
              type="button"
              onClick={() => {
                const roomIds = feedPreviews.map(f => f.groupId)
                navigate('/consumption-log', { state: { selectedRooms: roomIds, myGroups: feedPreviews } })
              }}
              className="rounded-[18px] flex items-end justify-between cursor-pointer border-0 text-left relative"
              style={{
                background: '#EBF5FF',
                border: 'none',
                boxShadow: 'none',
                minHeight: '34px',
                padding: '5px 12px',
                overflow: 'visible',
              }}
            >
              <span className="block text-[13px] font-bold leading-tight self-start pt-2" style={{ color: '#003B72' }}>
                소비 로그
              </span>
              <img
                src={receiptHalo}
                alt="receipt"
                className="object-contain block"
                style={{ width: '56px', height: '56px', marginBottom: '-10px', marginRight: '-6px' }}
              />
            </button>

            <button
              type="button"
              onClick={() => {
                const now = new Date()
                navigate('/report/monthly', { state: { scrollTo: 'aiRecommend', year: now.getFullYear(), month: now.getMonth() + 1 } })
              }}
              className="rounded-[18px] flex items-end justify-between cursor-pointer border-0 text-left relative"
              style={{
                background: '#EBF5FF',
                border: 'none',
                boxShadow: 'none',
                minHeight: '34px',
                padding: '5px 12px',
                overflow: 'visible',
              }}
            >
              <span className="block text-[13px] font-bold leading-tight self-start pt-2" style={{ color: '#003B72' }}>
                상품 추천
              </span>
              <img
                src={productBag}
                alt="product recommendation"
                className="object-contain block"
                style={{ width: '62px', height: '62px', marginBottom: '-10px', marginRight: '-6px' }}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 피드 */}
      <section className="px-3 pt-3 pb-4">
        <h2 className="text-[14px] font-bold mb-0.5" style={{ color: '#003B72', paddingLeft: '2px' }}>피드 하이라이트</h2>
        {feedPreviews.length === 0 ? (
          <p className="text-[13px] text-gray-400 text-center py-6">아직 모임방이 없어요. 모임을 만들어보세요!</p>
        ) : (
          <div
            ref={feedRef}
            className={`flex gap-3 overflow-x-auto scrollbar-hide ${feedDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
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
                className="shrink-0 text-left p-0 border-0 bg-transparent cursor-pointer"
                style={{ width: 'calc(50% - 6px)' }}
              >
                <figure className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 m-0 shadow-sm">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#F3F4F6]">
                      <span className="text-3xl">📷</span>
                      <span className="text-[10px] text-gray-400">사진이 없어요</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 px-2 pb-0">
                    <p
                      className="text-[9px] font-bold text-white m-0 truncate inline-block max-w-full px-1.5 py-px rounded-full"
                      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
                    >
                      {item.groupName}
                    </p>
                  </div>
                </figure>
              </button>
            ))}
          </div>
        )}
      </section>

      <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  )
}