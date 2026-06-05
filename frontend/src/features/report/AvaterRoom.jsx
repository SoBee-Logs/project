import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserId } from '../../common/hooks/useAuth'

function getFirstWeekday(year, month) {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7 // 월=0 ... 일=6
}

function getWeekLabel(dateStr, firstWeekday) {
  const d = new Date(dateStr)
  return `${Math.floor((d.getDate() - 1 + firstWeekday) / 7) + 1}주`
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

export default function AvaterRoom() {
  const navigate = useNavigate()
  const USER_ID = getUserId()

  useEffect(() => {
    if (!USER_ID) navigate('/login')
  }, [USER_ID])

  const today = new Date()
  const [selectedYear,  setSelectedYear]  = useState(() => {
    const saved = sessionStorage.getItem('report_year')
    return saved ? Number(saved) : today.getFullYear()
  })
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const saved = sessionStorage.getItem('report_month')
    return saved ? Number(saved) : today.getMonth() + 1
  })
  const [selectedWeek,  setSelectedWeek]  = useState('1주')

  const [persona, setPersona] = useState(null)
  const [txData,  setTxData]  = useState(null)

  const isCurrentMonth =
    selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1

  const goPrev = () => {
    setSelectedYear(prev => selectedMonth === 1 ? prev - 1 : prev)
    setSelectedMonth(prev => prev === 1 ? 12 : prev - 1)
  }
  const goNext = () => {
    if (isCurrentMonth) return
    setSelectedYear(prev => selectedMonth === 12 ? prev + 1 : prev)
    setSelectedMonth(prev => prev === 12 ? 1 : prev + 1)
  }

  useEffect(() => {
    sessionStorage.setItem('report_year',  String(selectedYear))
    sessionStorage.setItem('report_month', String(selectedMonth))
    setSelectedWeek('1주')
  }, [selectedYear, selectedMonth])

  useEffect(() => {
    setTxData(null)
    Promise.allSettled([
      fetch(`/api/users/${USER_ID}/persona`).then(r => r.ok ? r.json() : null),
      fetch(`/api/report/mydata/transaction?user_id=${USER_ID}&year=${selectedYear}&month=${selectedMonth}`).then(r => r.json()),
    ]).then(([personaRes, txRes]) => {
      if (personaRes.status === 'fulfilled' && personaRes.value) setPersona(personaRes.value)
      if (txRes.status === 'fulfilled') {
        const tx = txRes.value
        setTxData(tx)
        const fw = getFirstWeekday(selectedYear, selectedMonth)
        const ws = new Set()
        Object.values(tx.category_transactions ?? {}).forEach(records =>
          records.forEach(r => ws.add(getWeekLabel(r.payment_date, fw)))
        )
        const sorted = Array.from(ws).sort()
        setSelectedWeek(sorted[0] ?? '1주')
      }
    })
  }, [selectedYear, selectedMonth])

  const weeks = (() => {
    if (!txData) return []
    const fw = getFirstWeekday(selectedYear, selectedMonth)
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
    const totalWeeks = Math.floor((lastDay + fw - 1) / 7) + 1
    const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1
    return Array.from({ length: totalWeeks }, (_, i) => `${i + 1}주`).filter(w => {
      if (!isCurrentMonth) return true
      const wNum = parseInt(w)
      const weekStartDay = (wNum - 1) * 7 - fw + 1
      return new Date(selectedYear, selectedMonth - 1, weekStartDay) <= today
    })
  })()

  let explainObj = null
  try { explainObj = JSON.parse(persona?.avatarExplain ?? '') } catch {}
  const isNewFormat = explainObj && ('emoji' in explainObj || 'background' in explainObj)
  const descText = isNewFormat
    ? explainObj?.background?.header ?? ''
    : (explainObj?.content_text ?? '')

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">

      {/* 아바타 배경 이미지 */}
      <div className="absolute inset-0 z-0">
        {persona?.avatarImgUrl
          ? <img src={persona.avatarImgUrl} alt="페르소나" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-b from-[#1e73be] to-[#0e3f78]" />
        }
      </div>

      {/* 월 네비게이터 + 주차 필터 */}
      <div className="relative z-10 px-4" style={{ background: 'rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between h-12">
          <div className="w-9" />
          <div className="flex items-center gap-2">
            <button onClick={goPrev} className="w-7 h-7 flex items-center justify-center rounded-full text-white active:bg-white/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-bold text-white tracking-tight drop-shadow">
                {selectedYear}년 {selectedMonth}월
              </span>
              {isCurrentMonth && (
                <span className="text-[10px] font-semibold bg-white/30 text-white rounded-full px-2 py-0.5 leading-tight">
                  이번 달
                </span>
              )}
            </div>
            <button onClick={goNext} disabled={isCurrentMonth}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${isCurrentMonth ? 'text-white/30 cursor-not-allowed' : 'text-white active:bg-white/20'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
          <div className="w-9" />
        </div>

        {weeks.length > 0 && (
          <div className="flex gap-2 pb-2.5 overflow-x-auto justify-center">
            {weeks.map(w => (
              <button key={w} onClick={() => setSelectedWeek(w)}
                className={`shrink-0 text-[12px] font-semibold rounded-full px-3.5 py-1.5 transition-colors ${
                  selectedWeek === w ? 'bg-white text-[#1e73be]' : 'bg-white/20 text-white'
                }`}>
                {w}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 하단 오버레이: 페르소나 정보 + 리포트 버튼 */}
      <div className="absolute inset-x-0 bottom-0 pb-24 px-5 pt-16 z-10"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)' }}>
        <div className="mb-4">
          <p className="text-white text-xl font-extrabold leading-tight drop-shadow">
            {persona?.avatarName ?? '내 페르소나'}
          </p>
          {descText && (
            <p className="text-white/80 text-sm mt-1 leading-relaxed drop-shadow">{descText}</p>
          )}
        </div>

        <button
          onClick={() => navigate('/report/monthly')}
          className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
          style={{ background: 'rgba(255,255,255,0.95)', color: '#1e73be' }}
        >
          <span>📊</span>
          <span>소비 리포트 보기</span>
        </button>
      </div>
    </div>
  )
}
