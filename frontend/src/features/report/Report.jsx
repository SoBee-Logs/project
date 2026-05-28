import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getUserId } from '../../common/hooks/useAuth'
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  AreaChart, Area,
  LineChart, Line, CartesianGrid, LabelList, ReferenceLine
} from 'recharts'

function CategoryDonut({ categoryList }) {
  const [selectedCat, setSelectedCat] = useState(null)
  return (
    <div className="flex justify-center">
      <div className="relative" style={{ width: 240, height: 240 }}>
        <PieChart width={240} height={240}>
          <Pie
            data={categoryList}
            cx={115} cy={115}
            innerRadius={72} outerRadius={110}
            dataKey="value"
            onClick={(data) => setSelectedCat(prev => prev?.name === data.name ? null : data)}
            style={{ cursor: 'pointer' }}
          >
            {categoryList.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.color}
                opacity={selectedCat && selectedCat.name !== entry.name ? 0.4 : 1}
                stroke={selectedCat?.name === entry.name ? '#042C53' : 'none'}
                strokeWidth={selectedCat?.name === entry.name ? 2 : 0}
              />
            ))}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {selectedCat ? (
            <>
              <span className="w-3 h-3 rounded-full mb-1" style={{ background: selectedCat.color }} />
              <p className="text-sm font-bold text-gray-900 text-center leading-tight px-4">{selectedCat.name}</p>
              <p className="text-base font-extrabold mt-1" style={{ color: selectedCat.color }}>
                {selectedCat.amount.toLocaleString()}원
              </p>
              <p className="text-xs text-gray-400">{selectedCat.value}%</p>
            </>
          ) : (
            <p className="text-[11px] text-gray-300">영역을 눌러보세요</p>
          )}
        </div>
      </div>
    </div>
  )
}

function RecommendCard({ item, index }) {
  const navigate = useNavigate()
  const { product_name, product_company, product_img_url, product_type, content } = item
  const label = product_type === 'card' ? '💳 추천 카드' : '🏦 추천 예적금'

  return (
    <div
      onClick={() => navigate('/product/detail', { state: { item } })}
      className="rounded-2xl border border-gray-100 p-4 shadow-sm flex gap-3 items-center cursor-pointer active:bg-gray-50"
    >
      <div className="shrink-0 w-12 rounded-lg overflow-hidden shadow-md"
        style={{ height: 76, background: 'linear-gradient(135deg, #1e73be, #0e3f78)' }}
      >
        {product_img_url ? (
          <img
            src={product_img_url}
            alt={product_name}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            {product_type === 'card' ? '💳' : '🏦'}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-[10px] bg-blue-100 text-[#1e73be] rounded-full px-2 py-0.5 font-semibold">{label}</span>
        <p className="text-sm font-bold text-gray-900 mt-1 truncate">{product_name}</p>
        {item.reason && (
          <p className="text-[11px] text-[#1e73be] mt-0.5 leading-snug line-clamp-2">{item.reason}</p>
        )}
      </div>

      <span className="text-gray-300 text-sm shrink-0">›</span>
    </div>
  )
}

const CATEGORY_PALETTE = [
  '#1e73be', '#38BDF8', '#60a5fa', '#93c5fd', '#0ea5e9',
  '#3b82f6', '#7dd3fc', '#2563eb', '#6366f1', '#bfdbfe',
]

const TIME_ICONS = {
  '새벽': '🌙', '아침': '🌅', '점심': '☀️', '저녁': '🍽️', '심야': '🌃',
}
const TIME_RANGES = {
  '새벽': '0~6시', '아침': '6~11시', '점심': '11~14시', '저녁': '14~20시', '심야': '20~24시',
}
const TIME_ORDER = ['새벽', '아침', '점심', '저녁', '심야']

const API_BASE = import.meta.env.VITE_FASTAPI_BASE_URL || 'http://localhost:8000'

function MonthNavigator({ year, month, isCurrentMonth, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between h-12">
      {/* 뒤로가기 자리 — 레이아웃 균형용 */}
      <div className="w-9" />

      {/* 중앙: 년월 + 이번달 배지 */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          className="w-7 h-7 flex items-center justify-center rounded-full active:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold text-gray-900 tracking-tight">
            {year}년 {month}월
          </span>
          {isCurrentMonth && (
            <span className="text-[10px] font-semibold bg-[#1e73be] text-white rounded-full px-2 py-0.5 leading-tight">
              이번 달
            </span>
          )}
        </div>

        <button
          onClick={onNext}
          disabled={isCurrentMonth}
          className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
            isCurrentMonth
              ? 'text-gray-200 cursor-not-allowed'
              : 'text-gray-400 hover:text-gray-700 active:bg-gray-100'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* 오른쪽 여백 균형 */}
      <div className="w-9" />
    </div>
  )
}

export default function Report() {
  const navigate = useNavigate()
  const location = useLocation()
  const aiRecommendRef = useRef(null)
  const USER_ID = getUserId() ?? 1
  const [persona,        setPersona]        = useState(null)
  const [lifecycle,      setLifecycle]      = useState(null)
  const [txData,         setTxData]         = useState(null)
  const [recommendData,  setRecommendData]  = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)

  const today = new Date()
  const [selectedYear,  setSelectedYear]  = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)

  const isCurrentMonth =
    selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1

  const goPrev = () => {
    if (selectedMonth === 1) {
      setSelectedYear(y => y - 1)
      setSelectedMonth(12)
    } else {
      setSelectedMonth(m => m - 1)
    }
  }

  const goNext = () => {
    if (isCurrentMonth) return
    if (selectedMonth === 12) {
      setSelectedYear(y => y + 1)
      setSelectedMonth(1)
    } else {
      setSelectedMonth(m => m + 1)
    }
  }

  useEffect(() => {
    if (location.state?.scrollTo === 'aiRecommend' && aiRecommendRef.current) {
      setTimeout(() => {
        aiRecommendRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
  }, [loading, location.state])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true)
        setTxData(null)
        setRecommendData(null)

        fetch(`/api/users/${USER_ID}/persona`)
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data) setPersona(data) })
          .catch(() => {})

        const [lcRes, txRes] = await Promise.allSettled([
          fetch(`${API_BASE}/api/lifecycle/${USER_ID}`).then(r => r.json()),
          fetch(`${API_BASE}/report/mydata/transaction?user_id=${USER_ID}&year=${selectedYear}&month=${selectedMonth}`).then(r => r.json()),
        ])
        if (lcRes.status === 'fulfilled') setLifecycle(lcRes.value)
        else setLifecycle({ lifecycle_stage: '생애주기 없음', description: '분석 결과를 불러올 수 없어요.' })
        if (txRes.status === 'fulfilled') setTxData(txRes.value)

        try {
          const recRes = await fetch(`${API_BASE}/report/ai-insight?user_id=${USER_ID}&year=${selectedYear}&month=${selectedMonth}`)
          const recData = await recRes.json()
          setRecommendData(recData)
        } catch {
          setRecommendData({ error: true })
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [selectedYear, selectedMonth])

  const categoryList = txData
    ? (() => {
        const total = Object.values(txData.category_price).reduce((a, b) => a + b, 0)
        return Object.entries(txData.category_price)
          .sort((a, b) => b[1] - a[1])
          .map(([name, amount], i) => ({
            name,
            amount,
            value: Math.round((amount / total) * 100),
            color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
          }))
      })()
    : []

  const top3 = categoryList.slice(0, 3)

  // ✅ amount 필드 추가
  const timeList = txData
    ? (() => {
        const total = Object.values(txData.timepattern_price).reduce((a, b) => a + b, 0)
        return TIME_ORDER.map(label => ({
          label,
          pct: txData.timepattern_price[label]
            ? Math.round((txData.timepattern_price[label] / total) * 100)
            : 0,
          amount: txData.timepattern_price[label] ?? 0,
          icon: TIME_ICONS[label],
        }))
      })()
    : []

  const peakTime = timeList.length > 0
    ? timeList.reduce((a, b) => a.pct > b.pct ? a : b)
    : null

  if (loading) return (
    <div className="flex flex-col h-full">
      {/* 상단 고정 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4">
        <MonthNavigator
          year={selectedYear}
          month={selectedMonth}
          isCurrentMonth={isCurrentMonth}
          onPrev={goPrev}
          onNext={goNext}
        />
      </div>
      <div className="flex flex-col gap-4 pt-4 px-4 pb-24 animate-pulse overflow-y-auto">
      {/* 페르소나 배너 스켈레톤 */}
      <div className="rounded-2xl bg-gray-200 p-4 flex items-center gap-3 h-20">
        <div className="w-14 h-14 rounded-full bg-gray-300 shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-2.5 bg-gray-300 rounded-full w-1/3" />
          <div className="h-4 bg-gray-300 rounded-full w-1/2" />
          <div className="h-2.5 bg-gray-300 rounded-full w-2/3" />
        </div>
      </div>

      {/* 총 소비 스켈레톤 */}
      <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="h-2.5 bg-gray-200 rounded-full w-1/4 mb-3" />
        <div className="h-8 bg-gray-200 rounded-full w-2/5 mb-4" />
        <div className="flex gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1 rounded-xl bg-gray-100 p-3 flex flex-col gap-1.5">
              <div className="h-2 bg-gray-200 rounded-full w-2/3 mx-auto" />
              <div className="h-3.5 bg-gray-200 rounded-full w-1/2 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* AI 추천 스켈레톤 */}
      <div className="flex flex-col gap-2">
        <div className="h-2.5 bg-gray-200 rounded-full w-1/4" />
        {[0, 1].map(i => (
          <div key={i} className="rounded-2xl border border-gray-100 p-4 shadow-sm flex gap-3 items-center">
            <div className="w-12 rounded-lg bg-gray-200 shrink-0" style={{ height: 76 }} />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-2.5 bg-gray-200 rounded-full w-1/4" />
              <div className="h-4 bg-gray-200 rounded-full w-3/4" />
              <div className="h-2.5 bg-gray-200 rounded-full w-1/2" />
            </div>
          </div>
        ))}
      </div>

      {/* 생애주기 스켈레톤 */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 flex flex-col gap-2">
        <div className="h-2.5 bg-blue-200 rounded-full w-1/3" />
        <div className="h-5 bg-blue-200 rounded-full w-1/2" />
        <div className="h-2.5 bg-blue-200 rounded-full w-full" />
        <div className="h-2.5 bg-blue-200 rounded-full w-2/3" />
      </div>

      {/* 카테고리 차트 스켈레톤 */}
      <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="h-2.5 bg-gray-200 rounded-full w-1/3 mb-4" />
        <div className="flex items-center gap-4">
          <div className="w-28 h-28 rounded-full bg-gray-200 shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-200 shrink-0" />
                <div className="h-2.5 bg-gray-200 rounded-full flex-1" />
                <div className="h-2.5 bg-gray-200 rounded-full w-6" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 주별 차트 스켈레톤 */}
      <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="h-2.5 bg-gray-200 rounded-full w-1/3 mb-4" />
        <div className="h-24 bg-gray-100 rounded-xl" />
      </div>

      {/* 시간대 스켈레톤 */}
      <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="h-2.5 bg-gray-200 rounded-full w-1/3 mb-4" />
        <div className="flex justify-between">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-gray-200" />
              <div className="h-2 bg-gray-200 rounded-full w-7" />
              <div className="h-2 bg-gray-200 rounded-full w-5" />
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* 상단 고정 헤더 — 월 네비게이터 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4">
        <MonthNavigator
          year={selectedYear}
          month={selectedMonth}
          isCurrentMonth={isCurrentMonth}
          onPrev={goPrev}
          onNext={goNext}
        />
      </div>

      {/* 스크롤 콘텐츠 */}
      <div className="flex flex-col gap-4 pt-4 px-4 pb-24 overflow-y-auto">

      {/* 페르소나 배너 */}
      <div className="rounded-2xl bg-[#1e73be] text-white p-4 flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-white/20 overflow-hidden shrink-0">
          {persona?.avatarImgUrl
            ? <img src={persona.avatarImgUrl} alt="페르소나" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-2xl">🐝</div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight">{persona?.avatarName ?? '분석 중...'}</p>
          <p className="text-xs text-blue-100 mt-0.5 leading-relaxed">{persona?.avatarExplane ?? ''}</p>
        </div>
      </div>

      {/* 이번 달 총 소비 */}
      <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
        <p className="text-xs text-gray-400 mb-1">📊 소비 리포트</p>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-extrabold text-gray-900">
            {txData ? txData.payment_out.toLocaleString() : '-'}원
          </span>
        </div>
        <div className="flex gap-3 mt-3">
          {[
            ['결제 건수', txData ? `${txData.payment_total_num}건` : '-'],
            ['결제 일수', txData ? `${txData.payment_days}일` : '-'],
            ['결제 시간', peakTime ? `${peakTime.icon}${peakTime.label}` : '-'],
          ].map(([label, val]) => (
            <div key={label} className="flex-1 rounded-xl bg-gray-50 p-2 text-center">
              <p className="text-[10px] text-gray-400">{label}</p>
              <p className="text-sm font-bold text-gray-800">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI 상품 추천 */}
      <div ref={aiRecommendRef} className="flex flex-col gap-2">
        <p className="text-xs text-gray-500 font-semibold">🤖 AI 상품 추천</p>
        {recommendData?.message && (
          <p className="text-[11px] text-gray-400 leading-relaxed px-1">{recommendData.message}</p>
        )}
        {recommendData?.recommned?.length > 0
          ? recommendData.recommned.map((item, i) => (
              <RecommendCard key={i} item={item} index={i} />
            ))
          : recommendData === null
            ? (
              <div className="rounded-2xl border border-gray-100 p-4 shadow-sm text-center text-xs text-gray-400">
                추천 상품을 불러오는 중...
              </div>
            )
            : (
              <div className="rounded-2xl border border-gray-100 p-4 shadow-sm text-center text-xs text-gray-400">
                추천 상품을 불러올 수 없어요
              </div>
            )
        }
      </div>

      {/* 생애주기 */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs text-[#1e73be] font-semibold mb-2">🧬 AI 생애주기 분석</p>
        <p className="font-bold text-[#1e73be] text-base">{lifecycle?.life_stage_code}</p>
        <p className="text-xs text-blue-400 mt-1 leading-relaxed">{lifecycle?.description}</p>
        {error && <p className="text-[10px] text-red-300 mt-1">※ 서버 연결 실패</p>}
      </div>

      {/* 카테고리 도넛 */}
      {categoryList.length > 0 && (
        <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-500 font-semibold">🏷️ 카테고리별 소비 내역</p>
            <button
              onClick={() => navigate('/report/detail', { state: { scrollTo: 'category' } })}
              className="text-[10px] text-[#1e73be] underline"
            >
              더보기 →
            </button>
          </div>

          <CategoryDonut categoryList={categoryList} />

          {top3.length > 0 && (
            <>
              <div className="border-t border-gray-100 my-3" />
              <p className="text-[10px] text-gray-400 mb-2">TOP 3 소비금액</p>
              {(() => {
                const RANK_BADGES = ['①', '②', '③']
                const RANK_COLORS = ['#f59e0b', '#9ca3af', '#b45309']
                const rankedTop3 = top3.map((entry, i) => ({
                  ...entry,
                  rankName: `${RANK_BADGES[i]} ${entry.name}`,
                }))
                return (
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart
                      data={rankedTop3}
                      layout="vertical"
                      margin={{ left: 8, right: 110, top: 4, bottom: 4 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="rankName"
                        width={88}
                        interval={0}
                        tick={({ x, y, payload, index }) => (
                          <text x={x} y={y} textAnchor="end" dominantBaseline="middle" fontSize={11}>
                            <tspan fill={RANK_COLORS[index]} fontWeight={700}>{RANK_BADGES[index]} </tspan>
                            <tspan fill="#374151">{top3[index]?.name}</tspan>
                          </text>
                        )}
                      />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={18}>
                        {rankedTop3.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        <LabelList
                          dataKey="amount"
                          position="right"
                          content={({ x, y, width, height, value, index }) => (
                            <text x={x + width + 6} y={y + height / 2} dominantBaseline="middle" fontSize={11} fill="#374151" fontWeight={600}>
                              {`${value.toLocaleString()}원 `}
                              <tspan fill="#9ca3af" fontSize={10}>{`(${top3[index]?.value}%)`}</tspan>
                            </text>
                          )}
                        />
                      </Bar>
                      <Tooltip formatter={(v) => [`${v.toLocaleString()}원`, '소비금액']} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* ✅ 주별 세로 막대 차트 — 평균 레이블 겹침 수정 + 비중 제거 */}
      {txData?.weekly_price?.length > 0 && (
        <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-500 font-semibold">📈 주별 소비 변화 추이</p>
            <button
              onClick={() => navigate('/report/detail', { state: { scrollTo: 'weekly' } })}
              className="text-[10px] text-[#1e73be] underline"
            >
              더보기 →
            </button>
          </div>
          {(() => {
            const weeklyTotals = txData.weekly_price.map(w => ({
              week: w.week,
              total: Object.entries(w)
                .filter(([k]) => k !== 'week')
                .reduce((sum, [, v]) => sum + v, 0),
            }))
            const avg = Math.round(weeklyTotals.reduce((s, w) => s + w.total, 0) / weeklyTotals.length)
            const getBarColor = (total) => total > avg ? '#ef4444' : '#1e73be'

            // ✅ 금액만 표시 (비중 제거)
            const getAmountLabel = (total) => `${Math.round(total / 10000)}만`

            return (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={weeklyTotals} margin={{ top: 28, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v) => [`${v.toLocaleString()}원`, '소비금액']}
                    labelFormatter={(l) => `${l}주차`}
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e5e7eb' }}
                  />
                  {/* ✅ 평균선 레이블을 SVG text로 직접 렌더링해 겹침 방지 */}
                  <ReferenceLine
                    y={avg}
                    stroke="#f97316"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    label={({ viewBox }) => {
                      const { x, y, width } = viewBox
                      return (
                        <text
                          x={x + width - 4}
                          y={y - 5}
                          textAnchor="end"
                          fontSize={10}
                          fill="#f97316"
                          fontWeight={600}
                        >
                          평균 {Math.round(avg / 10000)}만
                        </text>
                      )
                    }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={28}>
                    {weeklyTotals.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={getBarColor(entry.total)}
                        opacity={0.85}
                      />
                    ))}
                    {/* ✅ 금액만 표시 */}
                    <LabelList
                      dataKey="total"
                      position="top"
                      content={({ x, y, width, value }) => {
                        if (!value) return null
                        return (
                          <text x={x + width / 2} y={y - 4} textAnchor="middle">
                            <tspan fontSize={10} fill="#374151" fontWeight={600}>
                              {getAmountLabel(value)}
                            </tspan>
                          </text>
                        )
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          })()}
        </div>
      )}

      {/* ✅ 시간대 패턴 — 툴팁 금액으로 변경 */}
      {timeList.length > 0 && (
        <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-500 font-semibold">⏰ 시간대별 소비 패턴</p>
            <button
              onClick={() => navigate('/report/detail', { state: { scrollTo: 'time' } })}
              className="text-[10px] text-[#1e73be] underline"
            >
              더보기 →
            </button>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={timeList} margin={{ top: 20, right: 20, left: 20, bottom: 10 }}>
              <defs>
                <linearGradient id="timeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1e73be" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#1e73be" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={({ x, y, payload }) => (
                  <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill="#6B7280">
                    <tspan x={x} dy="0">{TIME_ICONS[payload.value]} {payload.value}</tspan>
                    <tspan x={x} dy="14" fontSize={9} fill="#9CA3AF">{TIME_RANGES[payload.value]}</tspan>
                  </text>
                )}
                axisLine={false}
                tickLine={false}
                interval={0}
                height={40}
              />
              <YAxis hide />
              {/* ✅ 커스텀 툴팁으로 금액 메인 표시 */}
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div style={{
                      borderRadius: 8,
                      fontSize: 12,
                      border: '1px solid #e5e7eb',
                      background: 'white',
                      padding: '6px 10px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}>
                      <p style={{ fontWeight: 600, color: '#374151', marginBottom: 2 }}>
                        {d.icon} {d.label}
                      </p>
                      <p style={{ color: '#1e73be', fontWeight: 700 }}>
                        {d.amount.toLocaleString()}원
                      </p>
                      <p style={{ color: '#9ca3af', fontSize: 10, marginTop: 1 }}>
                        비중 {d.pct}%
                      </p>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="pct"
                stroke="#1e73be"
                strokeWidth={2.5}
                fill="url(#timeGradient)"
                dot={({ cx, cy, payload }) => {
                  const isPeak = payload.pct === peakTime?.pct
                  return (
                    <circle
                      key={`dot-${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={isPeak ? 7 : 4}
                      fill={isPeak ? '#f97316' : '#1e73be'}
                      stroke="white"
                      strokeWidth={2}
                    />
                  )
                }}
                activeDot={{ r: 7, stroke: 'white', strokeWidth: 2 }}
              >
                <LabelList
                  dataKey="pct"
                  position="top"
                  formatter={(v) => v > 0 ? `${v}%` : ''}
                  style={{ fontSize: 10, fill: '#6B7280', fontWeight: 600 }}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
          {peakTime && (
            <p className="text-[11px] text-center text-gray-400 mt-2">
              {peakTime.icon} {peakTime.label} 시간대 소비가 가장 활발해요
            </p>
          )}
        </div>
      )}

      </div>
    </div>
  )
}