import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getUserId } from '../../common/hooks/useAuth'
import beeImage from '../../assets/image 61.png'
import AlertBoard from './AlertBoard'
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  AreaChart, Area,
  CartesianGrid, LabelList, ReferenceLine
} from 'recharts'


export const CATEGORY_PALETTE = [
  '#003580',  // 1위: 짙은 네이비
  '#1D4ED8',  // 2위: 진한 파랑
  '#2F7DF6',  // 3위: 기본 파랑
  '#0284C7',  // 4위: 오션 블루
  '#0EA5E9',  // 5위: 하늘 청색
  '#38BDF8',  // 6위: 밝은 스카이
  '#0891B2',  // 7위: 틸
  '#67E8F9',  // 8위: 연한 시안
  '#93C5FD',  // 9위: 연한 파랑
  '#BAE6FD',  // 10위: 아주 연한 하늘
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
          className="py-3 rounded-xl bg-[#2F7DF6] text-white font-bold text-sm active:opacity-80"
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
            onClick={(data, _index, event) => { event?.stopPropagation(); onSelect(data) }}
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
  const [error, setError] = useState(false)
  useEffect(() => {
    const img = new Image()
    img.onload = () => setLandscape(img.naturalWidth > img.naturalHeight)
    img.src = src
  }, [src])

  if (error) {
    return (
      <div style={{ width: containerW, height: containerH, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <img src={beeImage} alt="상품 이미지" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    )
  }

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
          onError={() => setError(true)} />
      </div>
    </div>
  ) : (
    <div style={{ width: containerW, height: containerH, overflow: 'hidden', flexShrink: 0 }}>
      <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={() => setError(true)} />
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
          style={{ background: 'linear-gradient(135deg, #2F7DF6, #1a5bbf)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
        >
          {product_img_url ? (
            <CardImage src={product_img_url} alt={product_name} containerW={72} containerH={110} />
          ) : (
            <div style={{ width: 72, height: 110, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={beeImage} alt="상품 이미지" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          )}
        </div>
      ) : (
        <div className="shrink-0 rounded-lg overflow-hidden shadow-md self-center"
          style={{ width: 72, height: 72, background: '#fff' }}
        >
          {product_img_url ? (
            <img
              src={product_img_url}
              alt={product_name}
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8, display: 'block' }}
              onError={(e) => { e.currentTarget.src = beeImage; e.currentTarget.style.padding = '4px' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={beeImage} alt="상품 이미지" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col self-stretch">
        <div>
          <span className="text-[10px] bg-[#EBF5FF] text-[#2F7DF6] rounded-full px-2 py-0 font-semibold leading-[18px] inline-block">{label}</span>
          <div className="flex items-center gap-1 mt-px">
            <p className="text-sm font-bold text-gray-900 truncate flex-1">{product_name}</p>
            {product_type === 'savings' && item.content?.header && (
              <span className="text-[11px] font-semibold text-[#2F7DF6] shrink-0">{item.content.header.replace('우대금리 최대 ', '최대 ')}</span>
            )}
          </div>
        </div>
        {item.reason && (
          <div className="flex-1 flex items-center">
            <p className="text-[11px] text-[#2F7DF6] leading-snug" style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
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
    <div className="flex flex-col items-center justify-center py-2 gap-0.5">
      {isCurrentMonth && (
        <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 leading-tight bg-[#2F7DF6] text-white">
          이번 달
        </span>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          className="w-7 h-7 flex items-center justify-center rounded-full active:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-[15px] font-bold text-gray-900 tracking-tight">
          {year}년 {month}월
        </span>
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
    </div>
  )
}

function getPersonaWeekLabel(startStr, year, month, weekOrder) {
  if (!startStr) return `${month}월`
  const s = new Date(`${startStr}T00:00:00`)
  const adjustedFirst = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const day = s.getMonth() + 1 === month ? s.getDate() : null
  if (!day) return `${month}월`
  const w = Math.floor((day + adjustedFirst - 1) / 7) + 1
  const candidate = `${w}주`
  return weekOrder?.includes(candidate) ? `${month}월 ${candidate}차` : `${month}월`
}

function formatPersonaWeek(startStr, endStr, year, month, weekOrder) {
  if (!startStr || !endStr) return ''
  const s = new Date(`${startStr}T00:00:00`)
  const e = new Date(`${endStr}T00:00:00`)
  const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`
  // persona_week_start가 속하는 주차 찾기
  let weekLabel = ''
  if (weekOrder?.length) {
    const adjustedFirst = (new Date(year, month - 1, 1).getDay() + 6) % 7  // Mon=0..Sun=6
    const day = s.getMonth() + 1 === month ? s.getDate() : null
    if (day) {
      const w = Math.floor((day + adjustedFirst - 1) / 7) + 1
      const candidate = `${w}주`
      if (weekOrder.includes(candidate)) weekLabel = candidate + ' '
    }
  }
  return `${weekLabel}${fmt(s)}~${fmt(e)}`
}

function getWeekDateRange(year, month, weekLabel) {
  if (!weekLabel) return ''
  const w = parseInt(weekLabel)
  if (isNaN(w)) return ''
  const adjustedFirst = (new Date(year, month - 1, 1).getDay() + 6) % 7  // Mon=0..Sun=6
  const startDate = new Date(year, month - 1, (w - 1) * 7 - adjustedFirst + 1)
  const endDate   = new Date(year, month - 1, w * 7 - adjustedFirst)
  const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`
  return `${fmt(startDate)}~${fmt(endDate)}`
}

export default function Report() {
  const navigate = useNavigate()
  const location = useLocation()
  const aiRecommendRef = useRef(null)
  const USER_ID = getUserId()

  useEffect(() => {
    if (!USER_ID) navigate('/login')
  }, [USER_ID])

  const [persona,       setPersona]       = useState(null)
  const [lifecycle,     setLifecycle]     = useState(null)
  const [peers,         setPeers]         = useState([])
  const [expandedPeer,  setExpandedPeer]  = useState(null)
  const [selectedCat,   setSelectedCat]   = useState(null)
  const [catDeselected, setCatDeselected] = useState(false)
  const [catWeek,       setCatWeek]       = useState('전체')
  const [timeWeek,      setTimeWeek]      = useState('전체')
  const [txData,        setTxData]        = useState(null)
  const [selectedEmotionWeek, setSelectedEmotionWeek] = useState(null)
  const [personaWeek,        setPersonaWeek]        = useState(null)
  const [recommendData, setRecommendData] = useState(null)
  const [recommendRefreshing, setRecommendRefreshing] = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [isEmptyMonth,  setIsEmptyMonth]  = useState(false)

  const today = new Date()
  const [selectedYear,  setSelectedYear]  = useState(() => {
    const saved = sessionStorage.getItem('report_year')
    return location.state?.year ?? (saved ? Number(saved) : today.getFullYear())
  })
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const saved = sessionStorage.getItem('report_month')
    return location.state?.month ?? (saved ? Number(saved) : today.getMonth() + 1)
  })

  const prevYearRef  = useRef(selectedYear)
  const prevMonthRef = useRef(selectedMonth)

  useEffect(() => {
    sessionStorage.setItem('report_year',  String(selectedYear))
    sessionStorage.setItem('report_month', String(selectedMonth))
  }, [selectedYear, selectedMonth])

  const isCurrentMonth =
    selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1

  const goPrev = () => {
    prevYearRef.current  = selectedYear
    prevMonthRef.current = selectedMonth
    setSelectedYear(selectedMonth === 1 ? selectedYear - 1 : selectedYear)
    setSelectedMonth(selectedMonth === 1 ? 12 : selectedMonth - 1)
  }

  const goNext = () => {
    if (isCurrentMonth) return
    prevYearRef.current  = selectedYear
    prevMonthRef.current = selectedMonth
    setSelectedYear(selectedMonth === 12 ? selectedYear + 1 : selectedYear)
    setSelectedMonth(selectedMonth === 12 ? 1 : selectedMonth + 1)
  }

  useEffect(() => {
    if (location.state?.scrollTo === 'aiRecommend' && aiRecommendRef.current) {
      setTimeout(() => {
        aiRecommendRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
  }, [loading, location.state])

  useEffect(() => {
    fetch(`/api/lifecycle/${USER_ID}`)
      .then(r => r.json())
      .then(data => {
        setLifecycle(data)
        fetch(`/api/lifecycle/${USER_ID}/peers`)
          .then(r => r.json())
          .then(setPeers)
          .catch(() => setPeers([]))
      })
      .catch(() => setLifecycle({ life_stage_code: '생애주기 없음', description: '분석 결과를 불러올 수 없어요.' }))

    fetch(`/api/users/${USER_ID}/persona`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPersona(data) })
      .catch(() => {})
  }, [USER_ID])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true)
        setTxData(null)
        setRecommendData(null)
        setCatWeek('전체')
        setTimeWeek('전체')
        setSelectedCat(null)
        setCatDeselected(false)
        setSelectedEmotionWeek(null)
        setPersonaWeek(null)

        const txRes = await fetch(
          `/api/report/mydata/transaction?user_id=${USER_ID}&year=${selectedYear}&month=${selectedMonth}`
        ).then(r => r.json()).catch(() => null)

        if (txRes) {
          const isEmpty = !isCurrentMonth &&
            txRes.payment_total_num === 0 && txRes.payment_out === 0 &&
            Object.keys(txRes.category_price ?? {}).length === 0
          if (isEmpty) {
            setIsEmptyMonth(true)
          } else {
            setTxData(txRes)
            // 감정 섹션 default: 변경사유 있는 주차 중 마지막
            const weeklyEmotion = txRes.weekly_top_emotion ?? {}
            const weeklyAvatar  = txRes.weekly_avatar ?? {}
            const emotionWeeks  = (txRes.week_order ?? []).filter(w => weeklyEmotion[w])
            const defaultEmotionWeek = [...emotionWeeks].reverse().find(w => {
              try {
                const cr = weeklyAvatar[w]?.avatar_change_reason
                if (!cr) return false
                const parsed = typeof cr === 'string' ? JSON.parse(cr) : cr
                return !!parsed?.emoji?.context
              } catch { return false }
            }) ?? emotionWeeks[emotionWeeks.length - 1] ?? null
            setSelectedEmotionWeek(defaultEmotionWeek)
          }
        }

        setLoading(false)

        // AI 추천은 백그라운드 로드
        fetch(`/api/report/ai-insight?user_id=${USER_ID}&year=${selectedYear}&month=${selectedMonth}`)
          .then(r => r.json())
          .then(data => setRecommendData(data))
          .catch(() => setRecommendData({ error: true }))
      } catch (e) {
        setError(e.message)
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

  if (loading) return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center h-10 px-4">
          <button
            onClick={() => navigate('/report', { state: { year: selectedYear, month: selectedMonth } })}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="flex-1 text-center text-base font-semibold text-gray-800 -ml-8 pointer-events-none">리포트</span>
        </div>
        <div className="px-4">
          <MonthNavigator year={selectedYear} month={selectedMonth} isCurrentMonth={isCurrentMonth} onPrev={goPrev} onNext={goNext} />
        </div>
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
        <div className="rounded-2xl border border-[#EBF5FF] bg-[#EBF5FF] p-4 flex flex-col gap-2">
          <div className="h-2.5 bg-[#EBF5FF] rounded-full w-1/3" />
          <div className="h-5 bg-[#EBF5FF] rounded-full w-1/2" />
          <div className="h-2.5 bg-[#EBF5FF] rounded-full w-full" />
          <div className="h-2.5 bg-[#EBF5FF] rounded-full w-2/3" />
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

      {expandedPeer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setExpandedPeer(null)}
        >
          <div className="flex flex-col items-center gap-3">
            <img
              src={expandedPeer.avatar_img_url}
              alt={expandedPeer.avatar_name}
              className="w-64 h-64 rounded-2xl object-cover shadow-2xl"
            />
            <p className="text-white font-bold text-base drop-shadow">{expandedPeer.avatar_name}</p>
          </div>
        </div>
      )}

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

      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center h-10 px-4">
          <button
            onClick={() => navigate('/report', { state: { year: selectedYear, month: selectedMonth } })}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="flex-1 text-center text-base font-semibold text-gray-800 -ml-8 pointer-events-none">리포트</span>
        </div>
        <div className="px-4">
          <MonthNavigator year={selectedYear} month={selectedMonth} isCurrentMonth={isCurrentMonth} onPrev={goPrev} onNext={goNext} />
        </div>
      </div>

      <div className="overflow-y-auto flex-1 px-4 pb-8">
      <div className="flex flex-col gap-4 pt-4">

        {/* ① 소비 리포트 (월 총액) */}
        <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-semibold mb-1">📊 {selectedYear}년 {selectedMonth}월 총 소비</p>
          <span className="text-2xl font-extrabold text-gray-900">
            {txData ? txData.payment_out.toLocaleString() : '-'}원
          </span>
          {txData?.vlm_summary?.total_count > 0 && (
            <div className="mt-3 rounded-xl border border-[#EBF5FF] bg-[#EBF5FF] px-3 py-2 flex items-center gap-2">
              <span className="text-sm">📷</span>
              <span className="text-[11px] text-[#2F7DF6] font-semibold">
                사진 {txData.vlm_summary.total_count}장 · VLM 분석 아이템 {txData.vlm_items?.length ?? 0}종 연결됨
              </span>
            </div>
          )}
        </div>

        {/* 생애주기 */}
        {lifecycle && lifecycle.life_stage_code && lifecycle.life_stage_code !== '생애주기 없음' && (() => {
          const LIFECYCLE_EMOJI = {
            '십대': '🧑‍🎓', '대학생': '🎓', '사회초년생': '💼', '신혼': '💍',
            '자녀영유아': '🍼', '자녀의무교육': '🏫', '자녀대학생': '📚',
            '중년기타': '⛳', '2nd Life': '🌅', '은퇴': '🏡',
          }
          const emoji = LIFECYCLE_EMOJI[lifecycle.life_stage_code] ?? '🧬'
          return (
            <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500 font-semibold mb-2">👤 나의 소비 생애주기</p>
              <div className="flex items-center gap-2">
                <span className="text-base shrink-0">{emoji}</span>
                <p className="text-base font-bold text-gray-900">{lifecycle.life_stage_code}</p>
              </div>
              {peers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 mb-2">같은 생애주기 유저</p>
                  <div className="flex gap-3 justify-center">
                    {peers.map((peer, i) => (
                      <div key={i} className="flex flex-col items-center gap-1" onClick={() => setExpandedPeer(peer)}>
                        <img
                          src={peer.avatar_img_url}
                          alt={peer.avatar_name}
                          className="w-14 h-14 rounded-xl object-cover border border-gray-100 cursor-pointer active:scale-95 transition-transform"
                        />
                        <p className="text-[10px] text-gray-500 text-center max-w-[56px] truncate">{peer.avatar_name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* 주간 목표 달성 현황 AlertBoard */}
        <AlertBoard year={selectedYear} month={selectedMonth} />

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

        {/* 카테고리별 소비 도넛 */}
        {categoryList.length > 0 && (() => {
          const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1
          const weekOrder = (txData?.week_order ?? []).filter(w => {
            if (!isCurrentMonth) return true  // 지난 달은 전체 주차 표시
            const fw = (new Date(selectedYear, selectedMonth - 1, 1).getDay() + 6) % 7
            const wNum = parseInt(w)
            const weekStart = new Date(selectedYear, selectedMonth - 1, (wNum - 1) * 7 - fw + 1)
            return weekStart <= today  // 주차 시작일이 오늘 이전인 것만 표시
          })
          const weekButtons = ['전체', ...weekOrder]
          const activeCatData = catWeek === '전체'
            ? categoryList
            : (() => {
                const weekCatPrice = txData?.weekly_category_price?.[catWeek] ?? {}
                if (Object.keys(weekCatPrice).length === 0) return []
                const total = Object.values(weekCatPrice).reduce((a, b) => a + b, 0)
                return Object.entries(weekCatPrice)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, amount], i) => ({
                    name, amount,
                    value: Math.round((amount / total) * 100),
                    color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
                  }))
              })()

          const validSelectedCat = selectedCat && activeCatData.some(c => c.name === selectedCat.name)
            ? activeCatData.find(c => c.name === selectedCat.name)
            : null
          const displayCat = catDeselected ? null : (validSelectedCat ?? (activeCatData.length > 0 ? activeCatData[0] : null))

          return (
            <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs text-gray-500 font-semibold">🏷️ 카테고리별 소비</p>
                <button
                  onClick={() => navigate('/report/detail', { state: { year: selectedYear, month: selectedMonth, categoryColorMap } })}
                  className="text-[10px] text-[#2F7DF6] underline"
                >
                  더보기 →
                </button>
              </div>
              {weekButtons.length > 1 && (
                <div className="mb-3">
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {weekButtons.map(w => (
                      <button
                        key={w}
                        onClick={() => { setCatWeek(w); setSelectedCat(null); setCatDeselected(false) }}
                        className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                          catWeek === w
                            ? 'bg-[#2F7DF6] text-white'
                            : 'bg-white text-gray-500 border border-gray-200'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  {catWeek !== '전체' && (
                    <p className="text-[9px] text-gray-400 mt-1.5">
                      {catWeek} · {getWeekDateRange(selectedYear, selectedMonth, catWeek)}
                    </p>
                  )}
                </div>
              )}
              {activeCatData.length > 0 ? (
                <CategoryDonut categoryList={activeCatData} selectedCat={displayCat} onSelect={(cat) => { setSelectedCat(cat); setCatDeselected(false) }} />
              ) : (
                <p className="text-[11px] text-gray-300 text-center py-6">{catWeek}는 마이데이터 수집 전이에요</p>
              )}
            </div>
          )
        })()}

        {/* 페르소나 기준 주간 TOP 카테고리 */}
        {txData?.persona_top_category && (() => {
          const spendName   = txData.persona_top_category
          const spendAmount = txData.persona_top_category_amount
          const spendColor  = categoryColorMap[spendName] ?? '#2F7DF6'

          const weekOrder = Object.keys(txData.weekly_avatar ?? {}).sort()
          const lastPersonaWeek = weekOrder[weekOrder.length - 1] ?? null
          const activeWeek = personaWeek ?? lastPersonaWeek
          const hasAvatar = !!txData.weekly_avatar?.[activeWeek]
          const changeReasonRaw = txData.weekly_avatar?.[activeWeek]?.avatar_change_reason ?? null
          const changeReason = (() => {
            try { return typeof changeReasonRaw === 'string' ? JSON.parse(changeReasonRaw) : changeReasonRaw }
            catch { return null }
          })()

          // 선택된 주차의 vlm_scene 사용 (없으면 마지막 페르소나 주차 fallback)
          const scene = txData.weekly_avatar[activeWeek]?.vlm_scene
            ?? (activeWeek === lastPersonaWeek ? txData.persona_vlm_scene : null)
            ?? {}
          const totalVlm = scene.total_count ?? 0
          const categoryCounts = scene.category_counts ?? {}
          const topPhotoCat = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0] ?? null
          const topPhotoCatCount = topPhotoCat ? categoryCounts[topPhotoCat] : 0
          const topPhotoCatPct = totalVlm > 0 ? Math.round((topPhotoCatCount / totalVlm) * 100) : 0
          const topPhotoColor = topPhotoCat ? (categoryColorMap[topPhotoCat] ?? '#2F7DF6') : '#2F7DF6'
          const topPhotoItems = topPhotoCat ? (scene.category_items?.[topPhotoCat] ?? []) : []

          return (
            <div className="rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-semibold">🧬 페르소나 기준</p>
              </div>

              {/* 주차 탭 — 전체 주차 표시 */}
              {weekOrder.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {weekOrder.map(w => {
                    const hasAvatarForWeek = !!txData.weekly_avatar?.[w]
                    return (
                      <button
                        key={w}
                        onClick={() => setPersonaWeek(w)}
                        className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                          activeWeek === w
                            ? 'bg-[#1e73be] text-white'
                            : hasAvatarForWeek
                              ? 'bg-white text-gray-500 border border-gray-200'
                              : 'bg-white text-gray-300 border border-gray-100'
                        }`}
                      >
                        {w}
                      </button>
                    )
                  })}
                </div>
              )}

              {!hasAvatar ? (
                <p className="text-[11px] text-gray-300 text-center py-4">이 주에 생성된 페르소나가 없어요</p>
              ) : (
              <>
              <p className="text-[11px] text-gray-400">{selectedMonth}월 {activeWeek}차 페르소나 기준</p>

              {/* 사진 TOP 카테고리 */}
              {topPhotoCat && totalVlm > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-gray-400 font-medium">📸 사진 TOP 카테고리</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: topPhotoColor }} />
                      <span className="text-sm font-bold text-gray-900">{topPhotoCat}</span>
                    </div>
                    <span className="text-[10px] font-bold text-[#2F7DF6]">{topPhotoCatCount}/{totalVlm}건 ({topPhotoCatPct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#2F7DF6] transition-all" style={{ width: `${topPhotoCatPct}%` }} />
                  </div>
                </div>
              )}

              {/* 아바타 생성 이유 */}
              {changeReason && (changeReason.item || changeReason.background) && (
                <div className="rounded-xl bg-blue-50 px-3 py-2.5 flex flex-col gap-1">
                  <p className="text-[9px] text-blue-300">{selectedMonth}월 {activeWeek}차 아바타 생성 이유</p>
                  {changeReason.item && (
                    <>
                      <p className="text-[10px] font-semibold text-[#2F7DF6]">{changeReason.item.header}</p>
                      <p className="text-[11px] text-gray-500 leading-relaxed">{changeReason.item.context}</p>
                    </>
                  )}
                  {!changeReason.item && changeReason.background && (
                    <>
                      <p className="text-[10px] font-semibold text-[#2F7DF6]">{changeReason.background.header}</p>
                      <p className="text-[11px] text-gray-500 leading-relaxed">{changeReason.background.context}</p>
                    </>
                  )}
                </div>
              )}
              </>
              )}
            </div>
          )
        })()}


        {/* ④ 주차별 소비 감정 */}
        {txData?.week_order?.length > 0 && (() => {
          const weeklyEmotion = txData?.weekly_top_emotion ?? {}
          const weeks = txData.week_order.filter(w => weeklyEmotion[w])
          if (weeks.length === 0) return null

          const getEmojiReason = (w) => {
            try {
              const cr = txData.weekly_avatar?.[w]?.avatar_change_reason ?? null
              if (!cr) return null
              const parsed = typeof cr === 'string' ? JSON.parse(cr) : cr
              const emoji = parsed?.emoji
              if (!emoji?.context) return null
              return { header: emoji.header ?? null, context: emoji.context }
            } catch { return null }
          }

          const activeEmojiReason = selectedEmotionWeek ? getEmojiReason(selectedEmotionWeek) : null

          return (
            <div className="rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3">
              <p className="text-xs text-gray-500 font-semibold">😊 주차별 소비 감정</p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {weeks.map(w => {
                  const em = weeklyEmotion[w]
                  const emoji = em?.emoji ?? em
                  const topCount = em?.top_count
                  const totalCount = em?.total_count
                  const hasContext = !!getEmojiReason(w)
                  const isSelected = selectedEmotionWeek === w
                  return (
                    <div
                      key={w}
                      onClick={() => hasContext && setSelectedEmotionWeek(isSelected ? null : w)}
                      className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 transition-colors ${hasContext ? 'cursor-pointer active:bg-gray-50' : ''} ${isSelected ? 'bg-blue-50' : ''}`}
                    >
                      <span className="text-2xl">{emoji}</span>
                      <span className={`text-[10px] font-semibold ${isSelected ? 'text-[#1e73be]' : 'text-gray-400'}`}>{w}</span>
                      {topCount != null && <span className="text-[9px] text-gray-500">{topCount}/{totalCount}건</span>}
                    </div>
                  )
                })}
              </div>
              {activeEmojiReason && (
                <div className="rounded-xl bg-blue-50 px-3 py-2">
                  <p className="text-[9px] text-blue-300 mb-0.5">{selectedEmotionWeek} 아바타 생성 이유</p>
                  {activeEmojiReason.header && (
                    <p className="text-[10px] font-semibold text-[#1e73be] mb-0.5">{activeEmojiReason.header}</p>
                  )}
                  <p className="text-[11px] text-gray-500 leading-relaxed">{activeEmojiReason.context}</p>
                </div>
              )}
            </div>
          )
        })()}

        {/* 시간대 패턴 */}
        {timeList.length > 0 && (() => {
          let timeContext = null
          try {
            const activeWeek = timeWeek === '전체' ? null : timeWeek
            const cr = activeWeek
              ? txData?.weekly_avatar?.[activeWeek]?.avatar_change_reason ?? null
              : null
            if (cr) {
              const parsed = typeof cr === 'string' ? JSON.parse(cr) : cr
              timeContext = parsed?.time ?? null
            }
          } catch {}

          const weekOrder = (txData?.week_order ?? []).filter(w => {
            if (!isCurrentMonth) return true
            const fw = (new Date(selectedYear, selectedMonth - 1, 1).getDay() + 6) % 7
            const wNum = parseInt(w)
            const weekStart = new Date(selectedYear, selectedMonth - 1, (wNum - 1) * 7 - fw + 1)
            return weekStart <= today
          })
          const weekButtons = ['전체', ...weekOrder]
          const activeTimeData = timeWeek === '전체'
            ? timeList
            : (() => {
                const weekTimePriceMap = txData?.weekly_timepattern_price?.[timeWeek] ?? {}
                const total = Object.values(weekTimePriceMap).reduce((a, b) => a + b, 0)
                return TIME_ORDER.map(label => ({
                  label,
                  pct: weekTimePriceMap[label] && total > 0 ? Math.round((weekTimePriceMap[label] / total) * 100) : 0,
                  amount: weekTimePriceMap[label] ?? 0,
                  icon: TIME_ICONS[label],
                }))
              })()
          const hasTimeData = activeTimeData.some(d => d.pct > 0)
          const activePeak = hasTimeData
            ? activeTimeData.reduce((a, b) => a.pct > b.pct ? a : b)
            : null

          return (
            <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 font-semibold">⏰ 시간대별 소비 패턴</p>
              </div>
              {weekButtons.length > 1 && (
                <div className="mb-3">
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {weekButtons.map(w => (
                      <button
                        key={w}
                        onClick={() => setTimeWeek(w)}
                        className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                          timeWeek === w
                            ? 'bg-[#2F7DF6] text-white'
                            : 'bg-white text-gray-500 border border-gray-200'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  {timeWeek !== '전체' && (
                    <p className="text-[9px] text-gray-400 mt-1.5">
                      {timeWeek} · {getWeekDateRange(selectedYear, selectedMonth, timeWeek)}
                    </p>
                  )}
                </div>
              )}
              {!hasTimeData ? (
                <p className="text-[11px] text-gray-300 text-center py-6">{timeWeek === '전체' ? '이번 달' : timeWeek}는 마이데이터 수집 전이에요</p>
              ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={activeTimeData} margin={{ top: 20, right: 20, left: 20, bottom: 10 }}>
                  <defs>
                    <linearGradient id="timeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2F7DF6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2F7DF6" stopOpacity={0} />
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
                          <p style={{ color: '#2F7DF6', fontWeight: 700 }}>{d.amount.toLocaleString()}원</p>
                          <p style={{ color: '#9ca3af', fontSize: 10, marginTop: 1 }}>비중 {d.pct}%</p>
                        </div>
                      )
                    }}
                  />
                  <Area type="monotone" dataKey="pct" stroke="#2F7DF6" strokeWidth={2.5} fill="url(#timeGradient)"
                    dot={({ cx, cy, payload }) => {
                      const isPeak = activePeak && payload.pct === activePeak.pct && payload.pct > 0
                      return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={isPeak ? 6 : 4} fill="#2F7DF6" opacity={isPeak ? 1 : 0.5} stroke="white" strokeWidth={2} />
                    }}
                    activeDot={{ r: 7, stroke: 'white', strokeWidth: 2 }}
                  >
                    <LabelList dataKey="pct" position="top" offset={8} formatter={(v) => v > 0 ? `${v}%` : ''} style={{ fontSize: 10, fill: '#6B7280', fontWeight: 600 }} />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
              )}
              {activePeak && (
                <p className="text-[11px] text-center text-gray-400 mt-2">
                  {activePeak.icon} {activePeak.label} 시간대 소비가 가장 활발해요
                </p>
              )}
              {timeContext && (
                <div className="rounded-xl bg-blue-50 px-3 py-2 mt-1">
                  <p className="text-[9px] text-blue-300 mb-0.5">{timeWeek} 아바타 생성 이유</p>
                  <p className="text-[10px] font-semibold text-[#1e73be] mb-0.5">{timeContext.header}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{timeContext.context}</p>
                </div>
              )}
            </div>
          )
        })()}

      </div>
      </div>
    </div>
  )
}