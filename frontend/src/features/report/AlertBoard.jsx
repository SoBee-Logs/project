import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const CATEGORY_MAP = {
  1: '🍚 식비', 2: '☕ 카페간식', 3: '🛒 온라인쇼핑', 4: '👗 패션쇼핑',
  5: '🚌 교통', 6: '✈️ 여행숙박', 7: '🎬 문화여가', 8: '🍺 술유흥',
  9: '🏥 의료건강', 10: '💄 뷰티미용', 11: '🏠 주거통신', 12: '📚 교육학습',
  13: '💳 금융', 14: '🎁 경조선물', 15: '🛍️ 생활', 16: '📦 기타',
}

function buildSummary(alerts) {
  const dangerBudget  = alerts.filter(a => a.budgetStatus === 'DANGER').length
  const warningBudget = alerts.filter(a => a.budgetStatus === 'WARNING').length
  const dangerDiary   = alerts.filter(a => a.diaryStatus === 'DANGER').length
  const warningDiary  = alerts.filter(a => a.diaryStatus === 'WARNING').length
  const parts = []
  if (dangerBudget > 0)               parts.push(`🚨 예산 ${dangerBudget}건 초과`)
  if (warningBudget > 0)              parts.push(`⚠️ 예산 ${warningBudget}건 임박`)
  if (dangerDiary + warningDiary > 0) parts.push(`✍️ 목표 ${dangerDiary + warningDiary}건 미달`)
  return parts.length > 0 ? parts.join(' · ') : null
}

export function buildAlertFingerprint(alerts) {
  return alerts
    .filter(a => a.budgetStatus !== 'SAFE' || a.diaryStatus !== 'SAFE')
    .sort((a, b) => a.groupId - b.groupId)
    .map(a => `${a.groupId}:${a.budgetStatus}:${a.diaryStatus}`)
    .join('|')
}

// 이번 주(weeklyData 마지막 항목) DANGER인 방이 하나라도 있으면 true
export function hasCurrentWeekDanger(alerts) {
  return alerts.some(a => {
    const weeks = a.weeklyData ?? []
    if (weeks.length === 0) return false
    const current = weeks[weeks.length - 1]
    return current.budgetStatus === 'DANGER' || current.diaryStatus === 'DANGER'
  })
}

function statusChip(status) {
  if (status === 'DANGER')  return { label: '초과', bg: '#fef2f2', color: '#ef4444' }
  if (status === 'WARNING') return { label: '임박', bg: '#fffbeb', color: '#f59e0b' }
  return { label: '안전', bg: '#f0fdf4', color: '#22c55e' }
}

function WeekDetail({ w }) {
  const hasBudget = w.targetBudget != null && w.targetBudget > 0
  const hasDiary  = w.targetDiaryCount != null && w.targetDiaryCount > 0
  const budgetRaw = hasBudget ? Math.round((w.weeklySpend / w.targetBudget) * 100) : 0
  const budgetColor = w.budgetStatus === 'DANGER' ? '#ef4444' : w.budgetStatus === 'WARNING' ? '#f59e0b' : '#22c55e'
  const diaryColor  = w.diaryStatus  === 'DANGER' ? '#ef4444' : w.diaryStatus  === 'WARNING' ? '#f59e0b' : '#22c55e'

  return (
    <div className="rounded-xl bg-blue-50 px-3 py-2.5">
      {hasBudget && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasDiary ? '8px' : '0' }}>
          <span style={{ fontSize: '10px', color: '#9ca3af' }}>💸 소비한도</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '10px', color: '#374151' }}>
              {w.weeklySpend.toLocaleString()}원 / {w.targetBudget.toLocaleString()}원
            </span>
            <span style={{ fontSize: '9px', fontWeight: '700', color: budgetColor }}>
              {budgetRaw >= 100 ? `+${budgetRaw - 100}%` : `${budgetRaw}%`}
            </span>
          </div>
        </div>
      )}
      {hasDiary && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: '#9ca3af' }}>✍️ 일기 목표</span>
          <span style={{ fontSize: '10px', color: diaryColor, fontWeight: '700' }}>
            {w.weeklyDiaryCount}회 / {w.targetDiaryCount}회 목표
          </span>
        </div>
      )}
    </div>
  )
}

// 방별 아코디언
function GroupAlert({ alert, isCurrentMonth }) {
  const [open, setOpen] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const weeks = alert.weeklyData ?? []
  const currentWeek = weeks[weeks.length - 1]
  const currentWeekWorst = !isCurrentMonth ? 'SAFE'
    : (currentWeek?.budgetStatus === 'DANGER' || currentWeek?.diaryStatus === 'DANGER') ? 'DANGER'
    : (currentWeek?.budgetStatus === 'WARNING' || currentWeek?.diaryStatus === 'WARNING') ? 'WARNING' : 'SAFE'
  const hasIssue = currentWeekWorst !== 'SAFE'

  const handleOpen = () => {
    if (!open && weeks.length > 0) setSelectedWeek(weeks[weeks.length - 1].week)
    setOpen(prev => !prev)
  }

  const activeWeek = weeks.find(w => w.week === selectedWeek)
  const worstStatus = (activeWeek?.budgetStatus === 'DANGER' || activeWeek?.diaryStatus === 'DANGER') ? 'DANGER'
    : (activeWeek?.budgetStatus === 'WARNING' || activeWeek?.diaryStatus === 'WARNING') ? 'WARNING' : 'SAFE'
  const chip = statusChip(worstStatus)

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>
      <button
        type="button"
        onClick={handleOpen}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#374151' }}>{alert.groupName}</span>
          {hasIssue && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: currentWeekWorst === 'DANGER' ? '#ef4444' : '#f59e0b', display: 'inline-block' }} />}
        </div>
        <span style={{ fontSize: '10px', color: '#d1d5db' }}>{open ? '∧' : '∨'}</span>
      </button>

      {open && (
        <div style={{ marginTop: '8px' }}>
          {/* 카테고리 표시 */}
          <p style={{ fontSize: '10px', marginBottom: '8px', color: alert.spendingCategoryId ? '#6366f1' : '#9ca3af', fontWeight: alert.spendingCategoryId ? '600' : '400' }}>
            {alert.spendingCategoryId
              ? `절약 카테고리: ${CATEGORY_MAP[alert.spendingCategoryId] ?? `카테고리 ${alert.spendingCategoryId}`}`
              : '전체 지출 기준'}
          </p>

          {/* 주차 탭 */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2">
            {weeks.map((w, idx) => {
              const isCurrentWeek = isCurrentMonth && idx === weeks.length - 1
              const wWorst = (w.budgetStatus === 'DANGER' || w.diaryStatus === 'DANGER') ? 'DANGER'
                : (w.budgetStatus === 'WARNING' || w.diaryStatus === 'WARNING') ? 'WARNING' : 'SAFE'
              const isActive = selectedWeek === w.week
              return (
                <button
                  key={w.week}
                  type="button"
                  onClick={() => setSelectedWeek(w.week)}
                  className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    isActive ? 'bg-[#1e73be] text-white' : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  {w.week}
                  {isCurrentWeek && wWorst !== 'SAFE' && (
                    <span style={{ marginLeft: '3px', fontSize: '7px', verticalAlign: 'middle', color: isActive ? 'white' : wWorst === 'DANGER' ? '#ef4444' : '#f59e0b' }}>●</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 선택된 주차 상태 칩 + 날짜 */}
          {activeWeek && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <span style={{ fontSize: '9px', color: '#9ca3af' }}>{activeWeek.startDate} ~ {activeWeek.endDate}</span>
              <span style={{ fontSize: '9px', fontWeight: '700', padding: '1px 6px', borderRadius: '99px', background: chip.bg, color: chip.color }}>{chip.label}</span>
            </div>
          )}

          {/* 선택된 주차 상세 */}
          {activeWeek && <WeekDetail w={activeWeek} />}
        </div>
      )}
    </div>
  )
}

export default function AlertBoard({ year, month }) {
  const [alerts, setAlerts] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const params = new URLSearchParams()
        if (year)  params.set('year',  year)
        if (month) params.set('month', month)
        const res = await fetch(`/api/report/alert?${params}`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return
        const data = await res.json()
        setAlerts(data)
      } catch (err) {
        console.error('AlertBoard 조회 실패', err)
      }
    }
    fetchAlerts()
  }, [location.pathname, year, month])

  const activeAlerts = alerts.filter(a => a.budgetStatus !== 'SAFE' || a.diaryStatus !== 'SAFE')
  const summary = buildSummary(activeAlerts)
  const now = new Date()
  const isCurrentMonth = (!year || year === now.getFullYear()) && (!month || month === now.getMonth() + 1)
  const currentWeekHeaderStatus = !isCurrentMonth ? 'SAFE' : (() => {
    let worst = 'SAFE'
    for (const a of alerts) {
      const weeks = a.weeklyData ?? []
      if (weeks.length === 0) continue
      const cur = weeks[weeks.length - 1]
      if (cur.budgetStatus === 'DANGER' || cur.diaryStatus === 'DANGER') return 'DANGER'
      if (cur.budgetStatus === 'WARNING' || cur.diaryStatus === 'WARNING') worst = 'WARNING'
    }
    return worst
  })()

  return (
    <section className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => {
            if (!prev) {
              // 처음 열 때 읽음 처리
              localStorage.setItem('alertSeenKey', buildAlertFingerprint(alerts))
              window.dispatchEvent(new Event('alertSeen'))
            }
            return !prev
          })
        }}
        className="w-full flex flex-col px-4 py-3 bg-white active:bg-gray-50 text-left"
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-700">🎯 이번 달 목표 현황</span>
            {currentWeekHeaderStatus !== 'SAFE' && (
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${currentWeekHeaderStatus === 'DANGER' ? 'bg-red-500' : 'bg-yellow-400'}`} />
            )}
          </div>
          <span className="text-gray-300 text-xs">{isOpen ? '∧' : '∨'}</span>
        </div>
        {!isOpen && summary && (
          <p className="text-[10px] font-medium text-red-500 mt-1">{summary}</p>
        )}
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 px-4 py-3 bg-white flex flex-col gap-2">
          {alerts.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-1">아직 목표가 설정된 방이 없어요 🎯</p>
          ) : (
            alerts.map(alert => <GroupAlert key={alert.groupId} alert={alert} isCurrentMonth={isCurrentMonth} />)
          )}
        </div>
      )}
    </section>
  )
}
