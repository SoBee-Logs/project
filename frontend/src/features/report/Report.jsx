import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getUserId } from '../../common/hooks/useAuth'
import AlertBoard from './AlertBoard'
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  AreaChart, Area,
  CartesianGrid, LabelList, ReferenceLine
} from 'recharts'

export const CATEGORY_PALETTE = [
  '#1e73be', '#38BDF8', '#60a5fa', '#93c5fd', '#0ea5e9',
  '#3b82f6', '#7dd3fc', '#2563eb', '#6366f1', '#bfdbfe',
]

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

function CategoryDonut({ categoryList, selectedCat, onSelect }) {
  return (
    <div className="flex justify-center">
      <div className="relative" style={{ width: 240, height: 240 }}>
        <PieChart width={240} height={240}>
          <Pie
            data={categoryList}
            cx={115} cy={115}
            innerRadius={72} outerRadius={110}
            dataKey="value"
            onClick={(data) => onSelect(prev => prev?.name === data.name ? null : data)}
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

function CardImage({ src, alt, containerW, containerH }) {
  const [landscape, setLandscape] = useState(false)
  useEffect(() => {
    const img = new Image()
    img.onload = () => setLandscape(img.naturalWidth > img.naturalHeight)
    img.src = src
  }, [src])

  return landscape ? (
    <div style={{ width: containerW, height: containerH, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
      <div style={{
        width: containerH, height: containerW,
        position: 'absolute',
        left: (containerW - containerH) / 2,
        top: (containerH - containerW) / 2,
        transform: 'rotate(90deg)',
        transformOrigin: 'center center',
        overflow: 'hidden',
      }}>
        <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={(e) => { e.currentTarget.style.display = 'none' }} />
      </div>
    </div>
  ) : (
    <div style={{ width: containerW, height: containerH, overflow: 'hidden', flexShrink: 0 }}>
      <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={(e) => { e.currentTarget.style.display = 'none' }} />
    </div>
  )
}

function RecommendCard({ item }) {
  const navigate = useNavigate()
  const { product_name, product_img_url, product_type } = item
  const label = product_type === 'card' ? '💳 추천 카드' : '🏦 추천 예적금'

  return (
    <div
      onClick={() => navigate('/product/detail', { state: { item } })}
      className="rounded-2xl border border-gray-100 p-4 shadow-sm flex gap-3 items-start cursor-pointer active:bg-gray-50"
    >
      {product_type === 'card' ? (
        <div className="shrink-0 rounded-lg overflow-hidden shadow-md self-center"
          style={{ background: 'linear-gradient(135deg, #2A7FD8, #0E3F78)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
        >
          {product_img_url ? (
            <CardImage src={product_img_url} alt={product_name} containerW={72} containerH={110} />
          ) : (
            <div style={{ width: 72, height: 110 }} className="flex items-center justify-center text-2xl">💳</div>
          )}
        </div>
      ) : (
        <div className="shrink-0 rounded-lg overflow-hidden shadow-md self-center"
          style={{ width: 72, height: 72, background: product_img_url ? '#fff' : 'linear-gradient(135deg, #1D9E75, #0A6B4E)' }}
        >
          {product_img_url ? (
            <img
              src={product_img_url}
              alt={product_name}
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8, display: 'block' }}
              onError={(e) => { e.currentTarget.parentElement.style.background = 'linear-gradient(135deg, #1D9E75, #0A6B4E)'; e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">🏦</div>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col self-stretch">
        <div>
          <span className="text-[10px] bg-blue-100 text-[#1e73be] rounded-full px-2 py-0 font-semibold leading-[18px] inline-block">{label}</span>
          <div className="flex items-center gap-1 mt-px">
            <p className="text-sm font-bold text-gray-900 truncate flex-1">{product_name}</p>
            {product_type === 'savings' && item.content?.header && (
              <span className="text-[11px] font-semibold text-[#1D9E75] shrink-0">{item.content.header.replace('우대금리 최대 ', '최대 ')}</span>
            )}
          </div>
        </div>
        {item.reason && (
          <div className="flex-1 flex items-center">
            <p className="text-[11px] text-[#1e73be] leading-snug" style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
              {product_type === 'savings'
                ? item.reason.replace(/\s*\(최고 연 [\d.]+%\)/, '')
                : item.reason}
            </p>
          </div>
        )}
      </div>
      <span className="text-gray-300 text-sm shrink-0 self-center">›</span>
    </div>
  )
}

const TIME_ICONS = {
  '새벽': '🌙', '아침': '🌅', '점심': '☀️', '저녁': '🍽️', '심야': '🌃',
}
const TIME_RANGES = {
  '새벽': '0~5시', '아침': '5~10시', '점심': '10~15시', '저녁': '15~20시', '심야': '20~24시',
}
const TIME_ORDER = ['새벽', '아침', '점심', '저녁', '심야']

function MonthNavigator({ year, month, isCurrentMonth, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between h-12">
      <div className="w-9" />
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
      <div className="w-9" />
    </div>
  )
}

export default function Report() {
  const navigate = useNavigate()
  const location = useLocation()
  const aiRecommendRef = useRef(null)
  const USER_ID = getUserId() ?? 1

  const [persona,       setPersona]       = useState(null)
  const [lifecycle,     setLifecycle]     = useState(null)
  const [txData,        setTxData]        = useState(null)
  const [recommendData, setRecommendData] = useState(null)
  const [recommendRefreshing, setRecommendRefreshing] = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [isEmptyMonth,  setIsEmptyMonth]  = useState(false)

  const today = new Date()
  const [selectedYear,  setSelectedYear]  = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)

  const [pendingYear,  setPendingYear]  = useState(null)
  const [pendingMonth, setPendingMonth] = useState(null)
  const [checkPending, setCheckPending] = useState(false)

  const isCurrentMonth =
    selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1

  const goPrev = () => {
    const newYear  = selectedMonth === 1 ? selectedYear - 1 : selectedYear
    const newMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
    setPendingYear(newYear)
    setPendingMonth(newMonth)
    setCheckPending(true)
  }

  const goNext = () => {
    if (isCurrentMonth) return
    const newYear  = selectedMonth === 12 ? selectedYear + 1 : selectedYear
    const newMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
    setPendingYear(newYear)
    setPendingMonth(newMonth)
    setCheckPending(true)
  }

  useEffect(() => {
    if (location.state?.scrollTo === 'aiRecommend' && aiRecommendRef.current) {
      setTimeout(() => {
        aiRecommendRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
  }, [loading, location.state])

  useEffect(() => {
    if (!checkPending || pendingYear === null || pendingMonth === null) return
    const isPendingCurrentMonth =
      pendingYear === today.getFullYear() && pendingMonth === today.getMonth() + 1
    if (isPendingCurrentMonth) {
      setSelectedYear(pendingYear)
      setSelectedMonth(pendingMonth)
      setCheckPending(false)
      return
    }
    const checkData = async () => {
      try {
        const res = await fetch(`/api/report/mydata/transaction?user_id=${USER_ID}&year=${pendingYear}&month=${pendingMonth}`)
        const tx = await res.json()
        if (!tx || (tx.payment_total_num === 0 && tx.payment_out === 0 && Object.keys(tx.category_price ?? {}).length === 0)) {
          setIsEmptyMonth(true)
        } else {
          setSelectedYear(pendingYear)
          setSelectedMonth(pendingMonth)
        }
      } catch {
        setIsEmptyMonth(true)
      } finally {
        setCheckPending(false)
      }
    }
    checkData()
  }, [checkPending])

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
          fetch(`/api/lifecycle/${USER_ID}`).then(r => r.json()),
          fetch(`/api/report/mydata/transaction?user_id=${USER_ID}&year=${selectedYear}&month=${selectedMonth}`).then(r => r.json()),
        ])

        if (lcRes.status === 'fulfilled') setLifecycle(lcRes.value)
        else setLifecycle({ life_stage_code: '생애주기 없음', description: '분석 결과를 불러올 수 없어요.' })

        if (txRes.status === 'fulfilled') setTxData(txRes.value)

        try {
          const recRes = await fetch(`/api/report/ai-insight?user_id=${USER_ID}&year=${selectedYear}&month=${selectedMonth}`)
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

  const fetchRecommend = async () => {
    setRecommendRefreshing(true)
    setRecommendData(null)
    try {
      const res = await fetch(`/api/report/ai-insight?user_id=${USER_ID}&year=${selectedYear}&month=${selectedMonth}`)
      const data = await res.json()
      setRecommendData(data)
    } catch {
      setRecommendData({ error: true })
    } finally {
      setRecommendRefreshing(false)
    }
  }

  // ✅ 팔레트 기반 categoryList
  const categoryList = txData
    ? (() => {
        const total = Object.values(txData.category_price).reduce((a, b) => a + b, 0)
        return Object.entries(txData.category_price)
          .sort((a, b) => b[1] - a[1])
          .map(([name, amount], i) => ({
            name, amount,
            value: Math.round((amount / total) * 100),
            color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
          }))
      })()
    : []

  // ✅ 상세보기로 넘길 색상 맵
  const categoryColorMap = Object.fromEntries(categoryList.map(c => [c.name, c.color]))

  const top3 = categoryList.slice(0, 3)

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

  const [selectedCat, setSelectedCat] = useState(null)

  if (loading) return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4">
        <MonthNavigator year={selectedYear} month={selectedMonth} isCurrentMonth={isCurrentMonth} onPrev={goPrev} onNext={goNext} />
      </div>
      <div className="flex flex-col gap-4 pt-4 px-4 pb-24 animate-pulse overflow-y-auto">
        <div className="rounded-2xl bg-gray-200 p-4 flex items-center gap-3 h-20">
          <div className="w-14 h-14 rounded-full bg-gray-300 shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-2.5 bg-gray-300 rounded-full w-1/3" />
            <div className="h-4 bg-gray-300 rounded-full w-1/2" />
            <div className="h-2.5 bg-gray-300 rounded-full w-2/3" />
          </div>
        </div>
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
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 flex flex-col gap-2">
          <div className="h-2.5 bg-blue-200 rounded-full w-1/3" />
          <div className="h-5 bg-blue-200 rounded-full w-1/2" />
          <div className="h-2.5 bg-blue-200 rounded-full w-full" />
          <div className="h-2.5 bg-blue-200 rounded-full w-2/3" />
        </div>
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
        <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="h-2.5 bg-gray-200 rounded-full w-1/3 mb-4" />
          <div className="h-24 bg-gray-100 rounded-xl" />
        </div>
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {isEmptyMonth && (
        <EmptyMonthModal
          year={pendingYear}
          month={pendingMonth}
          onClose={() => {
            setIsEmptyMonth(false)
            setPendingYear(null)
            setPendingMonth(null)
          }}
        />
      )}

      {/* 월 네비게이터 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4">
        <MonthNavigator year={selectedYear} month={selectedMonth} isCurrentMonth={isCurrentMonth} onPrev={goPrev} onNext={goNext} />
      </div>

      <div className="overflow-y-auto flex-1 px-4 pb-8">
      <div className="flex flex-col gap-4 pt-4">

        {/* 페르소나 배너 */}
        {(() => {
          const descText = persona?.avatarExplain ?? ''

          const traitTags = txData ? [
            categoryList[0] && `${categoryList[0].name} 집중`,
            peakTime && `${peakTime.icon} ${peakTime.label}`,
            lifecycle?.life_stage_code && `${lifecycle.life_stage_code}`,
            txData.vlm_items?.length > 0 && `📸 사진 소비 ${txData.vlm_items.length}건`,
          ].filter(Boolean) : []

          return (
            <div className="rounded-2xl bg-[#1e73be] text-white p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-white/20 overflow-hidden shrink-0">
                  {persona?.avatarImgUrl
                    ? <img src={persona.avatarImgUrl} alt="페르소나" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">🐝</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base leading-tight">{persona?.avatarName ?? '분석 중...'}</p>
                  {descText && (
                    <p className="text-xs text-blue-100 mt-0.5 leading-relaxed">{descText}</p>
                  )}
                </div>
              </div>
              {traitTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {traitTags.map((tag, i) => (
                    <span key={i} className="text-[11px] font-semibold bg-white/20 text-white rounded-full px-3 py-1">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* ① 소비 리포트 (월 총액) */}
        <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">📊 {selectedYear}년 {selectedMonth}월 총 소비</p>
          <span className="text-2xl font-extrabold text-gray-900">
            {txData ? txData.payment_out.toLocaleString() : '-'}원
          </span>
          {txData?.vlm_summary?.total_count > 0 && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 flex items-center gap-2">
              <span className="text-sm">📷</span>
              <span className="text-[11px] text-[#1e73be] font-semibold">
                사진 {txData.vlm_summary.total_count}장 · VLM 분석 아이템 {txData.vlm_items?.length ?? 0}종 연결됨
              </span>
            </div>
          )}
        </div>

        {/* 주간 목표 달성 현황 AlertBoard */}
        <AlertBoard />

        {/* AI 상품 추천 */}
        <div ref={aiRecommendRef} className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <p className="text-xs text-gray-500 font-semibold">🤖 AI 상품 추천</p>
            <button
              onClick={fetchRecommend}
              disabled={recommendRefreshing}
              className="w-7 h-7 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors"
              style={{ color: '#8494A8' }}
            >
              <svg
                width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: recommendRefreshing ? 'spin 0.7s linear infinite' : 'none', opacity: recommendRefreshing ? 0.4 : 1 }}
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
          {recommendRefreshing || recommendData === null ? (
            <>
              {/* 카드 스켈레톤 */}
              <div className="rounded-2xl border border-gray-100 p-4 shadow-sm flex gap-3 items-start animate-pulse">
                <div className="shrink-0 rounded-lg bg-gray-200 self-center" style={{ width: 72, height: 110 }} />
                <div className="flex-1 flex flex-col self-stretch">
                  <div>
                    <div className="h-[18px] bg-gray-200 rounded-full w-16 mb-1" />
                    <div className="h-4 bg-gray-200 rounded-full w-3/4 mt-1" />
                  </div>
                  <div className="flex-1 flex items-center">
                    <div className="w-full flex flex-col gap-1.5">
                      <div className="h-2.5 bg-gray-100 rounded-full w-full" />
                      <div className="h-2.5 bg-gray-100 rounded-full w-4/5" />
                    </div>
                  </div>
                </div>
              </div>
              {/* 예적금 스켈레톤 */}
              <div className="rounded-2xl border border-gray-100 p-4 shadow-sm flex gap-3 items-start animate-pulse">
                <div className="shrink-0 rounded-lg bg-gray-200 self-center" style={{ width: 72, height: 72 }} />
                <div className="flex-1 flex flex-col self-stretch">
                  <div>
                    <div className="h-[18px] bg-gray-200 rounded-full w-20 mb-1" />
                    <div className="flex items-center gap-1 mt-1">
                      <div className="h-4 bg-gray-200 rounded-full flex-1" />
                      <div className="h-4 bg-gray-200 rounded-full w-12 shrink-0" />
                    </div>
                  </div>
                  <div className="flex-1 flex items-center">
                    <div className="w-full flex flex-col gap-1.5">
                      <div className="h-2.5 bg-gray-100 rounded-full w-full" />
                      <div className="h-2.5 bg-gray-100 rounded-full w-2/3" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : recommendData?.recommned?.length > 0 ? (
            <>
              {recommendData.message && (
                <p className="text-[11px] text-gray-400 leading-relaxed px-1">{recommendData.message}</p>
              )}
              {recommendData.recommned.map((item, i) => <RecommendCard key={i} item={item} />)}
            </>
          ) : (
            <div className="rounded-2xl border border-gray-100 p-4 shadow-sm text-center text-xs text-gray-400">추천 상품을 불러올 수 없어요</div>
          )}
        </div>

        {/* 카테고리별 소비 도넛 (월 전체) */}
        {categoryList.length > 0 && (
          <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs text-gray-500 font-semibold">🏷️ 카테고리별 소비</p>
              <button
                onClick={() => navigate('/report/detail', { state: { year: selectedYear, month: selectedMonth, categoryColorMap } })}
                className="text-[10px] text-[#1e73be] underline"
              >
                더보기 →
              </button>
            </div>
            <CategoryDonut categoryList={categoryList} selectedCat={selectedCat} onSelect={setSelectedCat} />
          </div>
        )}

        {/* 카테고리별 VLM 연결 카드 (월 전체) */}
        {categoryList.length > 0 && txData && (() => {
          const vlmCatMap = txData.vlm_summary?.category_items ?? {}
          const vlmCards = txData.vlm_summary?.cards ?? []
          const top3 = categoryList.slice(0, 3)
          if (top3.length === 0) return null

          return (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] text-gray-400 px-1">이번 달 전체 TOP 3 카테고리</p>
              {top3.map((cat) => {
                const vlmItems = vlmCatMap[cat.name] ?? []
                const catVlmCards = vlmCards.filter(c => c.category === cat.name)
                const storeNames = [...new Set(catVlmCards.map(c => c.store_name).filter(Boolean))].slice(0, 3)
                const catVlmCount = catVlmCards.length
                const totalVlm = vlmCards.length
                const vlmPct = totalVlm > 0 ? Math.round((catVlmCount / totalVlm) * 100) : 0

                return (
                  <div key={cat.name} className="rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color }} />
                        <span className="text-sm font-bold text-gray-900">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-gray-900">{cat.amount.toLocaleString()}원</span>
                        <span className="text-[10px] text-gray-400">{cat.value}%</span>
                      </div>
                    </div>

                    {(storeNames.length > 0 || vlmItems.length > 0) && (
                      <div className="rounded-xl bg-gray-50 p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-gray-500">📸 이달 사진 기록</span>
                          {catVlmCount > 0 && (
                            <span className="text-[10px] text-[#1e73be] font-semibold">{catVlmCount}건</span>
                          )}
                        </div>
                        {storeNames.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {storeNames.map((s, i) => (
                              <span key={i} className="text-[11px] text-gray-600 font-medium bg-white rounded-full px-2.5 py-0.5 border border-gray-200">{s}</span>
                            ))}
                          </div>
                        )}
                        {vlmItems.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {vlmItems.slice(0, 4).map((item, i) => (
                              <span key={i} className="text-[11px] text-[#1e73be] font-medium bg-blue-50 rounded-full px-2.5 py-0.5 border border-blue-100">{item}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-2 pt-1 border-t border-gray-100">
                      <span className="text-[10px] font-semibold text-gray-400">🐝 이달 페르소나와 연결된 이유</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-20 shrink-0">사진 비중</span>
                        {totalVlm > 0 ? (
                          <>
                            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full bg-[#1e73be]" style={{ width: `${vlmPct}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-[#1e73be]">{catVlmCount}건 ({vlmPct}%)</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-300">사진 기록 없음</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed rounded-xl bg-gray-50 px-3 py-2">
                        "{cat.name} 소비가 {catVlmCount > 0 ? '카드·사진 모두에서' : '결제 내역에서'} 가장 자주 포착된 이달의 장면이에요"
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* ⑥ 아바타 변화 이유 */}
        {(() => {
          const reason = persona?.avatarChangeReason || txData?.avatar_change_reason
          const lifecycleText = lifecycle?.life_stage_code
          if (!reason && !lifecycleText) return null
          const highlightNumbers = (text) =>
            text.split(/(\d[\d,]*(?:건|원|일|%|개|번)?)/).map((part, i) =>
              /^\d[\d,]*(?:건|원|일|%|개|번)?$/.test(part)
                ? <span key={i} style={{ color: '#0F766E', fontWeight: 700 }}>{part}</span>
                : part
            )
          return (
            <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: '#F0FDF9', border: '1px solid #99F6E4' }}>
              <p className="text-xs font-semibold" style={{ color: '#0F766E' }}>🔄 아바타 변화 이유</p>
              {reason ? (
                <p className="text-sm text-gray-700 leading-relaxed">{highlightNumbers(reason)}</p>
              ) : (
                <p className="text-sm text-gray-500 leading-relaxed">
                  {lifecycleText} 단계로 분석됐어요. 소비 패턴이 바뀌면 아바타도 함께 진화해요.
                </p>
              )}
              {lifecycle?.description && (
                <p className="text-[11px] leading-relaxed" style={{ color: '#0D9488' }}>{lifecycle.description}</p>
              )}
            </div>
          )
        })()}

        {/* ③ 이번 달 소비 장면 (VLM 기반) */}
        {txData?.vlm_summary?.total_count > 0 && (() => {
          const { cards, category_items } = txData.vlm_summary
          const storeTypeCounts = cards.reduce((acc, c) => {
            if (c.store_type) acc[c.store_type] = (acc[c.store_type] || 0) + 1
            return acc
          }, {})
          const topStores = Object.entries(storeTypeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([type, cnt]) => `${type} ${cnt}회`)
          const topItems = cards
            .map(c => c.item_name).filter(Boolean)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .slice(0, 5)

          return (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: '#FFF8F0', border: '1px solid #FFE4C4' }}>
              <p className="text-xs font-semibold" style={{ color: '#B45309' }}>📷 이번 달 소비 장면</p>
              <div>
                <p className="text-lg font-extrabold text-gray-900">VLM 분석 기반</p>
                {topStores.length > 0 && (
                  <p className="text-sm text-gray-600 mt-0.5">{topStores.join(' · ')}</p>
                )}
                {topItems.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    주요 아이템: {topItems.join(', ')}
                    {cards.length > 5 ? '...' : ''}
                  </p>
                )}
              </div>
              {Object.keys(category_items).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(category_items).flatMap(([cat, items]) =>
                    items.slice(0, 2).map((item, i) => (
                      <span key={`${cat}-${i}`} className="text-[11px] font-medium rounded-full px-2.5 py-0.5"
                        style={{ background: '#FDEBC8', color: '#92400E' }}>
                        {item}
                      </span>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* ④ 이번 달 소비 감정 (카테고리 이모지 분포) */}
        {categoryList.length > 0 && (() => {
          const CAT_EMOJI = {
            '카페/음료': '☕', '식사': '🍽️', '한식': '🍚', '편의점': '🏪',
            '쇼핑/온라인': '🛍️', '교통': '🚌', '제과/베이커리': '🥐',
            '의료/약국': '💊', '완구/취미': '🎮', '서적': '📚', '기타': '🎉',
          }
          const top3Cats = categoryList.slice(0, 3)
          return (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
              <p className="text-xs font-semibold" style={{ color: '#6D28D9' }}>😊 이번 달 소비 감정</p>
              <div className="flex items-center gap-3 flex-wrap">
                {top3Cats.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-1">
                    <span className="text-xl">{CAT_EMOJI[cat.name] ?? '💳'}</span>
                    <span className="text-base font-extrabold" style={{ color: '#5B21B6' }}>{cat.value}%</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px]" style={{ color: '#7C3AED' }}>
                {top3Cats.map(c => `${CAT_EMOJI[c.name] ?? '💳'} ${c.name}`).join(' · ')} 순으로 소비했어요
              </p>
            </div>
          )
        })()}

        {/* 시간대 패턴 */}
        {timeList.length > 0 && (
          <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-semibold mb-3">⏰ 시간대별 소비 패턴</p>
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
                  axisLine={false} tickLine={false} interval={0} height={40}
                />
                <YAxis hide />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div style={{ borderRadius: 8, fontSize: 12, border: '1px solid #e5e7eb', background: 'white', padding: '6px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                        <p style={{ fontWeight: 600, color: '#374151', marginBottom: 2 }}>{d.icon} {d.label}</p>
                        <p style={{ color: '#1e73be', fontWeight: 700 }}>{d.amount.toLocaleString()}원</p>
                        <p style={{ color: '#9ca3af', fontSize: 10, marginTop: 1 }}>비중 {d.pct}%</p>
                      </div>
                    )
                  }}
                />
                <Area type="monotone" dataKey="pct" stroke="#1e73be" strokeWidth={2.5} fill="url(#timeGradient)"
                  dot={({ cx, cy, payload }) => {
                    const isPeak = payload.pct === peakTime?.pct
                    return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={isPeak ? 7 : 4} fill={isPeak ? '#f97316' : '#1e73be'} stroke="white" strokeWidth={2} />
                  }}
                  activeDot={{ r: 7, stroke: 'white', strokeWidth: 2 }}
                >
                  <LabelList dataKey="pct" position="top" formatter={(v) => v > 0 ? `${v}%` : ''} style={{ fontSize: 10, fill: '#6B7280', fontWeight: 600 }} />
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
    </div>
  )
}