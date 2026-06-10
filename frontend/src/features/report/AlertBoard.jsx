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

// 주차별 소비 progress bar
function WeekRow({ w }) {
  const hasBudget = w.targetBudget != null && w.targetBudget > 0
  const hasDiary  = w.targetDiaryCount != null && w.targetDiaryCount > 0

  const budgetRaw = hasBudget ? Math.round((w.weeklySpend / w.targetBudget) * 100) : 0
  const budgetPct = Math.min(100, budgetRaw) // bar는 100%까지만
  const budgetColor = w.budgetStatus === 'DANGER' ? '#ef4444' : w.budgetStatus === 'WARNING' ? '#f59e0b' : '#22c55e'
  const diaryColor  = w.diaryStatus  === 'DANGER' ? '#ef4444' : w.diaryStatus  === 'WARNING' ? '#f59e0b' : '#22c55e'

  return (
    <div style={{ marginBottom: '10px' }}>
      <p style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '5px' }}>{w.week}차</p>

      {hasBudget && (
        <div style={{ marginBottom: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>💸 소비한도</span>
            <span style={{ fontSize: '10px', fontWeight: '700', color: budgetColor }}>
              {w.weeklySpend.toLocaleString()} / {w.targetBudget.toLocaleString()}원 ({budgetRaw}%)
            </span>
          </div>
          <div style={{ height: '5px', borderRadius: '99px', background: '#f3f4f6', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${budgetPct}%`, background: budgetColor, borderRadius: '99px', transition: 'width 0.4s' }} />
          </div>
        </div>
      )}

      {hasDiary && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <span style={{ fontSize: '10px', color: '#9ca3af' }}>✍️ 일기 목표</span>
          <span style={{ fontSize: '10px', fontWeight: '700', color: diaryColor }}>
            {w.weeklyDiaryCount} / {w.targetDiaryCount}회
          </span>
        </div>
      )}
    </div>
  )
}

// 방별 아코디언
function GroupAlert({ alert }) {
  const [open, setOpen] = useState(false)
  const hasIssue = alert.budgetStatus !== 'SAFE' || alert.diaryStatus !== 'SAFE'

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#374151' }}>{alert.groupName}</span>
          {hasIssue && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: alert.budgetStatus === 'DANGER' || alert.diaryStatus === 'DANGER' ? '#ef4444' : '#f59e0b', display: 'inline-block' }} />}
        </div>
        <span style={{ fontSize: '10px', color: '#d1d5db' }}>{open ? '∧' : '∨'}</span>
      </button>

      {open && (
        <div style={{ marginTop: '8px', paddingLeft: '4px' }}>
          {alert.spendingCategoryId && (
            <p style={{ fontSize: '10px', color: '#6366f1', fontWeight: '600', marginBottom: '8px' }}>
              절약 카테고리: {CATEGORY_MAP[alert.spendingCategoryId] ?? `카테고리 ${alert.spendingCategoryId}`}
            </p>
          )}
          {!alert.spendingCategoryId && (
            <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>전체 지출 기준</p>
          )}
          {alert.weeklyData?.map(w => <WeekRow key={w.week} w={w} />)}
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
        localStorage.setItem('alertSeenKey', buildAlertFingerprint(data))
      } catch (err) {
        console.error('AlertBoard 조회 실패', err)
      }
    }
    fetchAlerts()
  }, [location.pathname, year, month])

  const activeAlerts = alerts.filter(a => a.budgetStatus !== 'SAFE' || a.diaryStatus !== 'SAFE')
  const summary = buildSummary(activeAlerts)

  return (
    <section className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex flex-col px-4 py-3 bg-white active:bg-gray-50 text-left"
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-700">🎯 이번 달 목표 현황</span>
            {summary && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
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
            alerts.map(alert => <GroupAlert key={alert.groupId} alert={alert} />)
          )}
        </div>
      )}
    </section>
  )
}
