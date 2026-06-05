import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserId } from '../../common/hooks/useAuth'

function getFirstWeekday(year, month) {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7
}

function getWeekLabel(dateStr, firstWeekday) {
  const d = new Date(dateStr)
  return `${Math.floor((d.getDate() - 1 + firstWeekday) / 7) + 1}주`
}

function safeJsonParse(value, fallback = null) {
  if (!value) return fallback
  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function extractEmoji(text) {
  if (!text) return null
  const matched = String(text).match(/\p{Emoji}/u)
  return matched?.[0] ?? null
}

const TIME_ICONS = {
  새벽: '🌙',
  아침: '🌅',
  점심: '☀️',
  저녁: '🍽️',
  심야: '🌃'
}

function getTimeEmojiFromReason(timeReason) {
  const text = `${timeReason?.header ?? ''} ${timeReason?.context ?? ''}`

  if (text.includes('새벽')) return TIME_ICONS.새벽
  if (text.includes('아침')) return TIME_ICONS.아침
  if (text.includes('점심')) return TIME_ICONS.점심
  if (text.includes('저녁')) return TIME_ICONS.저녁
  if (text.includes('심야') || text.includes('밤')) return TIME_ICONS.심야

  return '⏰'
}

function getWeekDateRange(year, month, weekLabel) {
  const w = parseInt(weekLabel)
  if (isNaN(w)) return ''
  const adjustedFirst = getFirstWeekday(year, month)
  const startDate = new Date(year, month - 1, (w - 1) * 7 - adjustedFirst + 1)
  const endDate   = new Date(year, month - 1, w * 7 - adjustedFirst)
  const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`
  return `${fmt(startDate)}~${fmt(endDate)}`
}

function EmptyMonthModal({ year, month, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-gray-800">{year}년 {month}월</p>
          <p className="text-sm text-gray-500">마이데이터 연동 이전 기간으로,</p>
          <p className="text-sm text-gray-500">불러온 결제 데이터가 없어요.</p>
        </div>
        <button
          onClick={onClose}
          className="py-3 rounded-xl bg-[#1e73be] text-white font-bold text-sm active:opacity-80"
        >
          확인
        </button>
      </div>
    </div>
  )
}

export default function AvaterRoom() {
  const navigate = useNavigate()
  const USER_ID = getUserId() ?? 1
  const today = new Date()

  const [isExpanded, setIsExpanded] = useState(true)

  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)
  const [selectedWeek, setSelectedWeek] = useState('1주')

  const [persona, setPersona] = useState(null)
  const [txData, setTxData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isEmptyMonth, setIsEmptyMonth] = useState(false)

  const prevYearRef = useRef(selectedYear)
  const prevMonthRef = useRef(selectedMonth)
  const navDirectionRef = useRef('none')

  const isCurrentMonth =
    selectedYear === today.getFullYear() &&
    selectedMonth === today.getMonth() + 1

  const goPrev = (e) => {
    e.stopPropagation()
    prevYearRef.current = selectedYear
    prevMonthRef.current = selectedMonth
    navDirectionRef.current = 'prev'
    setSelectedYear((prev) => (selectedMonth === 1 ? prev - 1 : prev))
    setSelectedMonth((prev) => (prev === 1 ? 12 : prev - 1))
    setIsExpanded(true)
  }

  const goNext = (e) => {
    e.stopPropagation()

    if (isCurrentMonth) return

    navDirectionRef.current = 'next'
    setSelectedYear((prev) => (selectedMonth === 12 ? prev + 1 : prev))
    setSelectedMonth((prev) => (prev === 12 ? 1 : prev + 1))
    setIsExpanded(true)
  }

  useEffect(() => {
    setLoading(true)
    setTxData(null)

    Promise.allSettled([
      fetch(`/api/users/${USER_ID}/persona`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(
        `/api/report/mydata/transaction?user_id=${USER_ID}&year=${selectedYear}&month=${selectedMonth}`
      ).then((r) => r.json()),
    ])
      .then(([personaRes, txRes]) => {
        if (personaRes.status === 'fulfilled' && personaRes.value) {
          setPersona(personaRes.value)
        }

        if (txRes.status === 'fulfilled') {
          const tx = txRes.value
          const isEmpty = !isCurrentMonth &&
            (tx.payment_total_num ?? 0) === 0 &&
            (tx.payment_out ?? 0) === 0 &&
            Object.keys(tx.category_transactions ?? {}).length === 0

          if (isEmpty) {
            setIsEmptyMonth(true)
          } else {
            setTxData(tx)

            const fw = getFirstWeekday(selectedYear, selectedMonth)
            const ws = new Set()

            Object.values(tx.category_transactions ?? {}).forEach((records) => {
              records.forEach((r) => {
                ws.add(getWeekLabel(r.payment_date, fw))
              })
            })

            const sorted = Array.from(ws).sort(
              (a, b) => parseInt(a) - parseInt(b)
            )

            const defaultWeek = navDirectionRef.current === 'prev'
              ? (sorted[sorted.length - 1] ?? '1주')
              : (sorted[0] ?? '1주')
            navDirectionRef.current = 'none'
            setSelectedWeek(defaultWeek)
          }
        }
      })
      .finally(() => {
        setLoading(false)
      })
  }, [USER_ID, selectedYear, selectedMonth])

  const weeks = (() => {
    if (!txData) return []

    const fw = getFirstWeekday(selectedYear, selectedMonth)
    const ws = new Set()

    Object.values(txData.category_transactions ?? {}).forEach((records) => {
      records.forEach((r) => {
        ws.add(getWeekLabel(r.payment_date, fw))
      })
    })

    return Array.from(ws).sort((a, b) => parseInt(a) - parseInt(b))
  })()

  const weekAvatar = txData?.weekly_avatar?.[selectedWeek] ?? null
  const avatarImgUrl = weekAvatar?.avatar_img_url ?? null
  const avatarName = weekAvatar?.avatar_name ?? (persona?.avatarName ?? '내 페르소나')
  const avatarExplain = weekAvatar?.avatar_explain ?? persona?.avatarExplain ?? ''
  const hasWeekAvatar = !!avatarImgUrl

  const changeReason = safeJsonParse(weekAvatar?.avatar_change_reason ?? txData?.avatar_change_reason, {})

  const descText =
    avatarExplain ||
    changeReason?.background?.header ||
    changeReason?.background?.context ||
    '이번 주 소비 패턴을 바탕으로 완성된 아바타예요.'

  const getTopCategoryByWeek = () => {
    const weekCategory = txData?.weekly_category_price?.[selectedWeek] ?? {}
    const entries = Object.entries(weekCategory)

    if (entries.length === 0) return null

    const [category, amount] = entries.sort((a, b) => b[1] - a[1])[0]

    return {
      category,
      amount,
    }
  }

  const getPeakTimeByWeek = () => {
    const weekTime = txData?.weekly_timepattern_price?.[selectedWeek] ?? {}
    const entries = Object.entries(weekTime)

    if (entries.length === 0) return null

    const [time, amount] = entries.sort((a, b) => b[1] - a[1])[0]

    return {
      time,
      amount,
    }
  }

  const getTopEmotionByWeek = () => {
    const emotion = txData?.weekly_top_emotion?.[selectedWeek]

    if (!emotion) return null

    return {
      emoji: emotion?.emoji ?? emotion,
      topCount: emotion?.top_count ?? null,
      totalCount: emotion?.total_count ?? null,
    }
  }

  const detailsData = (() => {
    const hasChangeReason =
      changeReason?.emoji ||
      changeReason?.background ||
      changeReason?.time ||
      changeReason?.item

    // DB의 avatar_change_reason이 있으면 그 값을 그대로 우선 반영
    if (hasChangeReason) {
      return [
        {
          emoji:
            getTopEmotionByWeek()?.emoji ??
            extractEmoji(changeReason?.emoji?.header) ??
            '🙂',
          title:
            changeReason?.emoji?.header?.replace(/^\p{Emoji}\uFE0F?\s*/u, '') ??
            '감정이 담긴 표정',
          desc:
            changeReason?.emoji?.context ??
            '소비할 때 선택한 감정이 아바타 표정에 반영됐어요.',
        },
        {
          emoji: '🖼️',
          title: changeReason?.background?.header ?? '소비 무드 반영',
          desc:
            changeReason?.background?.context ??
            '주요 소비 카테고리가 아바타의 배경과 분위기에 반영됐어요.',
        },
        {
          emoji: '⏰',
          title: changeReason?.time?.header ?? '시간대별 소비 패턴',
          desc:
            changeReason?.time?.context ??
            '자주 소비한 시간대가 아바타의 장면 분위기를 만들었어요.',
        },
        {
          emoji: '🛍️',
          title: changeReason?.item?.header ?? '대표 소비 아이템',
          desc:
            changeReason?.item?.context ??
            '소비 사진에서 자주 보인 아이템이 아바타 오브젝트로 표현됐어요.',
        },
      ]
    }

    // avatar_change_reason이 없을 때만 기존 주차별 데이터로 카드 생성
    const items = []

    const topEmotion = getTopEmotionByWeek()
    const topCategory = getTopCategoryByWeek()
    const peakTime = getPeakTimeByWeek()

    if (topEmotion?.emoji) {
      items.push({
        emoji: topEmotion.emoji,
        title: `${selectedWeek} 소비 감정`,
        desc:
          topEmotion.totalCount && topEmotion.topCount
            ? `소비 사진 ${topEmotion.totalCount}건 중 ${topEmotion.topCount}건에서 두드러진 감정이에요.`
            : '이번 주 소비에서 가장 많이 나타난 감정이에요.',
      })
    }

    if (topCategory?.category) {
      items.push({
        emoji: '🏷️',
        title: `${topCategory.category} 집중 소비`,
        desc: `${selectedWeek}에 가장 많이 지출한 카테고리예요. 총 ${Number(
          topCategory.amount
        ).toLocaleString()}원을 사용했어요.`,
      })
    }

    if (peakTime?.time) {
      items.push({
        emoji: TIME_ICONS[peakTime.time] ?? '⏰',
        title: `${peakTime.time} 소비 집중`,
        desc: `${selectedWeek}에는 ${peakTime.time} 시간대 소비 금액이 가장 높았어요.`,
      })
    }

    const topItems = txData?.persona_vlm_scene?.top_items ?? []

    if (topItems.length > 0) {
      items.push({
        emoji: '📸',
        title: topItems.slice(0, 2).join(' & '),
        desc: '소비 사진에서 포착된 대표 아이템이 아바타 분위기에 반영됐어요.',
      })
    }

    while (items.length < 4) {
      items.push({
        emoji: '💡',
        title: '소비 인사이트',
        desc: '이번 주 소비 패턴을 바탕으로 만들어진 분석이에요.',
      })
    }

    return items.slice(0, 4)
  })()

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-white">
      {isEmptyMonth && (
        <EmptyMonthModal
          year={selectedYear}
          month={selectedMonth}
          onClose={() => {
            setIsEmptyMonth(false)
            setSelectedYear(prevYearRef.current)
            setSelectedMonth(prevMonthRef.current)
          }}
        />
      )}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
        {/* 아바타 이미지 영역 */}
        <section
          onClick={() => hasWeekAvatar && setIsExpanded((prev) => !prev)}
          className={`relative z-30 w-full transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] shrink-0 ${hasWeekAvatar ? 'cursor-pointer' : 'cursor-default'}`}
          style={{
            height: isExpanded ? '100%' : '235px',
            padding: isExpanded ? '0px' : '12px 16px 0',
            position: isExpanded ? 'absolute' : 'relative',
            inset: isExpanded ? '0' : undefined,
          }}
        >
          <div
            className="relative w-full h-full overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              borderRadius: isExpanded ? '0px' : '26px',
              boxShadow: isExpanded
                ? 'none'
                : '0 12px 28px rgba(15, 23, 42, 0.16)',
            }}
          >
            {avatarImgUrl ? (
              <img
                src={avatarImgUrl}
                alt={avatarName}
                className="w-full h-full object-cover block transition-transform duration-700 ease-out"
                style={{
                  transform: isExpanded ? 'scale(1.06)' : 'scale(1)',
                }}
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center gap-2">
                <span className="text-5xl">🐝</span>
                <p className="text-sm font-medium text-gray-400">아직 아바타가 생성되지 않았습니다</p>
                <p className="text-xs text-gray-300">소비 사진을 찍으면 분석을 시작해요!</p>
              </div>
            )}

            {/* 상단 월/주차 네비게이션 */}
            <div className="absolute top-0 left-0 w-full z-20 pt-2 pb-3 bg-gradient-to-b from-black/40 to-transparent">
              <div className="flex items-center justify-center gap-2 px-4">
                <button
                  onClick={goPrev}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-white active:bg-white/20"
                  aria-label="이전 달"
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>

                <div className="flex flex-col items-center leading-none">
                  {isCurrentMonth && (
                    <span className="mb-1 text-[9px] font-bold bg-white/30 text-white rounded-full px-2 py-1 backdrop-blur-sm">
                      이번 달
                    </span>
                  )}

                  <span className="text-[16px] font-extrabold text-white tracking-tight drop-shadow">
                    {selectedYear}년 {selectedMonth}월
                  </span>
                </div>

                <button
                  onClick={goNext}
                  disabled={isCurrentMonth}
                  className={`w-8 h-8 flex items-center justify-center rounded-full ${
                    isCurrentMonth
                      ? 'text-white/30 cursor-not-allowed'
                      : 'text-white active:bg-white/20'
                  }`}
                  aria-label="다음 달"
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              {weeks.length > 0 && (
                <div className="flex gap-1.5 mt-1 px-4 overflow-x-auto scrollbar-hide">
                  {weeks.map((w) => (
                    <button
                      key={w}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedWeek(w)
                      }}
                      className={`shrink-0 text-[11px] leading-none font-bold rounded-full px-2.5 py-1 transition-colors ${
                        selectedWeek === w
                          ? 'bg-white text-[#1e73be]'
                          : 'bg-white/20 text-white'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 로딩 */}
            {loading && (
              <div className="absolute inset-0 z-30 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
                <div className="px-4 py-2 rounded-full bg-white/90 text-[#1e73be] text-sm font-bold shadow">
                  불러오는 중...
                </div>
              </div>
            )}

            {/* 터치 유도 / 아바타 없음 안내 */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-500 z-20"
              style={{
                opacity: isExpanded ? 1 : 0,
              }}
            >
              {hasWeekAvatar ? (
                <div className="mt-28 px-4 py-2 rounded-full bg-black/35 text-white backdrop-blur-sm flex items-center gap-2 animate-pulse">
                  <span className="text-[15px]">👆</span>
                  <span className="text-sm font-semibold">화면을 터치해보세요</span>
                </div>
              ) : (
                <div className="mt-28 px-4 py-2 rounded-full bg-black/20 text-white backdrop-blur-sm flex items-center gap-2">
                  <span className="text-sm font-semibold">이 주에 생성된 페르소나가 없어요</span>
                </div>
              )}
            </div>

            {/* 확장 상태 하단 타이틀 + 소비 리포트 버튼 */}
            <div
              className="absolute bottom-0 left-0 w-full px-5 pt-20 pb-6 bg-gradient-to-t from-black/85 via-black/45 to-transparent transition-opacity duration-500 z-20"
              style={{
                opacity: isExpanded ? 1 : 0,
                pointerEvents: isExpanded ? 'auto' : 'none',
              }}
            >
              <h2 className="text-white text-[26px] font-extrabold mb-4 drop-shadow-lg leading-tight break-keep">
                {avatarName}
              </h2>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate('/report/monthly')
                }}
                className="w-full py-3.5 rounded-2xl bg-white/95 text-[#1e73be] font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-transform"
              >
                <span>📊</span>
                <span>소비 리포트 보기</span>
              </button>
            </div>
          </div>
        </section>

        {/* 축소 상태 분석 영역 — flex-1로 남은 공간 자동 채움 */}
        <section
          className="flex-1 min-h-0 px-5 overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            opacity: (isExpanded || !hasWeekAvatar) ? 0 : 1,
            transform: (isExpanded || !hasWeekAvatar) ? 'translateY(36px)' : 'translateY(0)',
            pointerEvents: (isExpanded || !hasWeekAvatar) ? 'none' : 'auto',
          }}
        >
          <div className="h-full flex flex-col pt-1 pb-2">
            <div className="text-center mb-1">
              <h2 className="text-[18px] font-extrabold text-gray-900 leading-tight break-keep line-clamp-1">
                {avatarName}
              </h2>

              {descText && (
                <p className="text-gray-500 text-[11px] mt-0.5 leading-snug break-keep line-clamp-2">
                  {descText}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 flex-1">
              {detailsData.map((item, idx) => (
                <article
                  key={`${item.title}-${idx}`}
                  className="flex flex-col px-2.5 pt-1.5 pb-1.5 rounded-[18px] bg-gray-50 border border-gray-100 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className="w-8 h-8 shrink-0 bg-white rounded-full flex items-center justify-center text-base shadow-sm border border-gray-100/50 mb-1.5">
                    {item.emoji}
                  </div>

                  <h3 className="font-extrabold text-gray-900 text-[12.5px] mb-1 leading-tight break-keep">
                    {item.title}
                  </h3>

                  <p className="text-gray-500 text-[10.5px] leading-snug break-keep overflow-hidden">
                    {item.desc}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}