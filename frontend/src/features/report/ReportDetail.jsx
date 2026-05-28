import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getUserId } from '../../common/hooks/useAuth' // ✅ Report.jsx와 동일하게 수정

const CATEGORY_COLORS = {
  '교통':        '#60a5fa',
  '카페/음료':   '#38BDF8',
  '식사':        '#1e73be',
  '편의점':      '#93c5fd',
  '쇼핑/온라인': '#2563eb',
  '제과/베이커리':'#0ea5e9',
  '선물/상품권': '#7dd3fc',
  '의료/약국':   '#1d4ed8',
  '완구/취미':   '#6366f1',
  '서적':        '#a5b4fc',
  '기타':        '#94a3b8',
}

const TIME_ICONS = {
  '새벽': '🌙', '아침': '🌅', '점심': '☀️', '저녁': '🍽️', '심야': '🌃',
}
const TIME_ORDER = ['새벽', '아침', '점심', '저녁', '심야']

export default function ReportDetail() {
  const navigate  = useNavigate()
  const location  = useLocation()

  // ✅ getUserId를 공통 훅에서 가져오기
  const USER_ID = getUserId() ?? 1

  // ✅ Report.jsx 더보기 버튼에서 넘겨준 year/month 받기 (없으면 현재 날짜)
  const today = new Date()
  const year  = location.state?.year  ?? today.getFullYear()
  const month = location.state?.month ?? today.getMonth() + 1

  const [txData,  setTxData]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // 각 섹션 ref
  const categoryRef = useRef(null)
  const weeklyRef   = useRef(null)
  const timeRef     = useRef(null)

  // ✅ API 경로 /api/report/... 로 통일, user_id + year + month 쿼리 파라미터 추가
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/report/mydata/transaction?user_id=${USER_ID}&year=${year}&month=${month}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setTxData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [year, month])

  // 로딩 끝나고 ref 마운트된 뒤 해당 섹션으로 스크롤
  useEffect(() => {
    if (loading) return
    const target = location.state?.scrollTo
    if (!target) return

    const refMap = {
      category: categoryRef,
      weekly:   weeklyRef,
      time:     timeRef,
    }
    const targetRef = refMap[target]
    if (targetRef?.current) {
      setTimeout(() => {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
    }
  }, [loading, location.state])

  // ─── 로딩 스켈레톤 ───────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col gap-4 pt-4 px-4 pb-24 animate-pulse">
      {/* 카테고리 스켈레톤 */}
      <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="h-2.5 bg-gray-200 rounded-full w-1/3 mb-4" />
        {[0,1,2,3,4].map(i => (
          <div key={i} className="mb-3">
            <div className="flex justify-between mb-1">
              <div className="h-2.5 bg-gray-200 rounded-full w-1/4" />
              <div className="h-2.5 bg-gray-200 rounded-full w-1/5" />
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
      {/* 주간 스켈레톤 */}
      <div className="flex flex-col gap-3">
        <div className="h-2.5 bg-gray-200 rounded-full w-1/4" />
        {[0,1,2].map(i => (
          <div key={i} className="rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex justify-between mb-2">
              <div className="h-3 bg-gray-200 rounded-full w-1/5" />
              <div className="h-3 bg-gray-200 rounded-full w-1/4" />
            </div>
            <div className="w-full h-2.5 rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
      {/* 시간대 스켈레톤 */}
      <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="h-2.5 bg-gray-200 rounded-full w-1/3 mb-4" />
        {[0,1,2,3,4].map(i => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <div className="h-2.5 bg-gray-200 rounded-full w-1/6" />
                <div className="h-2.5 bg-gray-200 rounded-full w-1/4" />
              </div>
              <div className="w-full h-2 rounded-full bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // ─── 에러 처리 ────────────────────────────────────────────────────
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 px-4">
      <p className="text-2xl">😢</p>
      <p className="text-sm text-gray-500 text-center">데이터를 불러올 수 없어요.<br />{error}</p>
      <button
        onClick={() => navigate('/report')}
        className="mt-2 px-5 py-2 rounded-xl bg-[#1e73be] text-white text-sm font-semibold"
      >
        돌아가기
      </button>
    </div>
  )

  // ─── 데이터 가공 ──────────────────────────────────────────────────

  // 월 누적 카테고리 배열 (금액 내림차순)
  const categoryList = txData
    ? Object.entries(txData.category_price)
        .sort((a, b) => b[1] - a[1])
        .map(([name, total]) => ({
          name,
          total,
          color: CATEGORY_COLORS[name] ?? '#94a3b8',
        }))
    : []

  const maxTotal = Math.max(...categoryList.map(c => c.total), 1)

  const thisWeekList = txData?.weekly_price?.length > 0
    ? (() => {
        const lastWeek = txData.weekly_price[txData.weekly_price.length - 1]
        const weekNum  = lastWeek.week
        const maxWeek  = Math.max(...categoryList.map(c => lastWeek[c.name] ?? 0), 1)
        return { lastWeek, weekNum, maxWeek }
      })()
    : null

  const timeList = txData
    ? (() => {
        const total = Object.values(txData.timepattern_price).reduce((a, b) => a + b, 0)
        return TIME_ORDER.map(label => ({
          label,
          amount: txData.timepattern_price[label] ?? 0,
          pct: txData.timepattern_price[label]
            ? Math.round((txData.timepattern_price[label] / total) * 100)
            : 0,
          icon: TIME_ICONS[label],
        }))
      })()
    : []

  // ─── 렌더 ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 pt-4 px-4 pb-24 overflow-y-auto">

      {/* 헤더: 조회 월 표시 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-700">{year}년 {month}월 상세 리포트</span>
      </div>

      {/* 이번 달 카테고리별 소비 */}
      <div ref={categoryRef} className="rounded-2xl border border-gray-100 p-4 shadow-sm scroll-mt-4">
        <p className="text-xs text-gray-500 font-semibold mb-4">📊 카테고리별 소비</p>
        {categoryList.length === 0
          ? <p className="text-xs text-gray-300 text-center py-4">데이터가 없어요</p>
          : (
            <div className="flex flex-col gap-3">
              {categoryList.map((cat) => (
                <div key={cat.name}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                      <span className="text-xs font-semibold text-gray-700">{cat.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{cat.total.toLocaleString()}원</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${(cat.total / maxTotal) * 100}%`,
                        background: cat.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* 이번주 소비 */}
      {thisWeekList && (
        <div ref={weeklyRef} className="flex flex-col gap-3 scroll-mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-semibold">📅 이번주 소비</p>
            <span className="text-[10px] text-[#1e73be] bg-blue-50 px-2 py-0.5 rounded-full font-semibold">
              {thisWeekList.weekNum}
            </span>
          </div>
          {categoryList.map((cat) => {
            const weekAmount = thisWeekList.lastWeek[cat.name] ?? 0
            return (
              <div key={cat.name} className="rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color }} />
                    <p className="text-xs font-semibold text-gray-700">{cat.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold" style={{ color: cat.color }}>
                      {weekAmount.toLocaleString()}원
                    </span>
                    <span className="text-[10px] text-gray-400 ml-1">/ 월 {cat.total.toLocaleString()}원</span>
                  </div>
                </div>
                <div className="w-full h-2.5 rounded-full bg-gray-100">
                  <div
                    className="h-2.5 rounded-full transition-all duration-500"
                    style={{
                      width: weekAmount === 0 ? '2%' : `${(weekAmount / thisWeekList.maxWeek) * 100}%`,
                      background: weekAmount === 0 ? '#e5e7eb' : cat.color,
                    }}
                  />
                </div>
                {weekAmount === 0 && (
                  <p className="text-[10px] text-gray-300 mt-1">이번주 소비 없음</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 시간대별 소비 금액 */}
      {timeList.length > 0 && (
        <div ref={timeRef} className="rounded-2xl border border-gray-100 p-4 shadow-sm scroll-mt-4">
          <p className="text-xs text-gray-500 font-semibold mb-3">⏰ 시간대별 소비 금액</p>
          <div className="flex flex-col gap-3">
            {timeList.map((t) => (
              <div key={t.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-base shrink-0">
                  {t.icon}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">{t.label}</span>
                    <span className="text-xs text-gray-500">{t.amount.toLocaleString()}원 ({t.pct}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: t.pct === 0 ? '2%' : `${t.pct}%`,
                        background: t.pct === 0 ? '#e5e7eb' : '#1e73be',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 뒤로가기 */}
      <button
        onClick={() => navigate('/report')}
        className="w-full py-3 rounded-2xl bg-[#1e73be] text-white text-sm font-semibold"
      >
        ← 리포트로 돌아가기
      </button>

    </div>
  )
}