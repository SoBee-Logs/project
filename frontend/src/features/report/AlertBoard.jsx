// AlertBoard — 주간 목표 현황 아코디언 컴포넌트
// 닫힌 상태: 요약 배지 표시
// 펼친 상태: 방별 소비/일기 수치 상세
// /report 진입 시 자동으로 "확인" 처리 → BottomNav Red Dot 제거

import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// 경고 건수 기반 요약 문자열 생성
function buildSummary(activeAlerts) {
  const dangerBudget  = activeAlerts.filter(a => a.budgetStatus === 'DANGER').length
  const warningBudget = activeAlerts.filter(a => a.budgetStatus === 'WARNING').length
  const dangerDiary   = activeAlerts.filter(a => a.diaryStatus === 'DANGER').length
  const warningDiary  = activeAlerts.filter(a => a.diaryStatus === 'WARNING').length

  const parts = []
  if (dangerBudget > 0)                    parts.push(`🚨 예산 ${dangerBudget}건 초과`)
  if (warningBudget > 0)                   parts.push(`⚠️ 예산 ${warningBudget}건 임박`)
  if (dangerDiary + warningDiary > 0)      parts.push(`✍️ 목표 ${dangerDiary + warningDiary}건 미달`)
  return parts.length > 0 ? parts.join(' · ') : null
}

// 방별 소비 수치 텍스트 (초과/임박 시만 반환)
function budgetLabel(alert) {
  if (!alert.targetBudget || alert.budgetStatus === 'SAFE') return null
  if (alert.budgetStatus === 'DANGER') {
    const over = (alert.weeklySpend - alert.targetBudget).toLocaleString()
    return `💸 예산 +${over}원 초과`
  }
  return `💸 ${alert.weeklySpend.toLocaleString()}/${alert.targetBudget.toLocaleString()}원`
}

// 방별 일기 수치 텍스트 (미달 시만 반환)
function diaryLabel(alert) {
  if (!alert.targetDiaryCount || alert.diaryStatus === 'SAFE') return null
  return `✍️ ${alert.weeklyDiaryCount}/${alert.targetDiaryCount}회`
}

// fingerprint 생성 — BottomNav "확인" 처리와 동기화
export function buildAlertFingerprint(alerts) {
  return alerts
    .filter(a => a.budgetStatus !== 'SAFE' || a.diaryStatus !== 'SAFE')
    .sort((a, b) => a.groupId - b.groupId)
    .map(a => `${a.groupId}:${a.budgetStatus}:${a.diaryStatus}`)
    .join('|')
}

export default function AlertBoard() {
  const [alerts, setAlerts] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch('/api/report/alert', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        setAlerts(data)
        // /report 진입 = 알림 확인 처리 → BottomNav Red Dot 제거
        localStorage.setItem('alertSeenKey', buildAlertFingerprint(data))
      } catch (err) {
        console.error('AlertBoard 조회 실패', err)
      }
    }
    fetchAlerts()
  }, [location.pathname])

  const activeAlerts = alerts.filter(
    a => a.budgetStatus !== 'SAFE' || a.diaryStatus !== 'SAFE'
  )
  const summary = buildSummary(activeAlerts)
  // 모든 방에 목표(예산/일기 횟수)가 하나도 설정되지 않은 경우 감지
  const hasNoGoal = alerts.length > 0 && alerts.every(a => !a.targetBudget && !a.targetDiaryCount)

  return (
    <section className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* 헤더 — 항상 표시 */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex flex-col px-4 py-3 bg-white active:bg-gray-50 text-left"
      >
        {/* 윗줄: 제목 + 빨간 점 + 화살표 */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-700">🎯 이번 주 목표 현황</span>
            {summary && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
          </div>
          <span className="text-gray-300 text-xs">{isOpen ? '∧' : '∨'}</span>
        </div>
        {/* 아랫줄: 닫힌 상태에서만 요약 표시 */}
        {!isOpen && summary && (
          <p className="text-[10px] font-medium text-red-500 mt-1">
            {summary}
          </p>
        )}
      </button>

      {/* 펼친 상태 — 방별 수치 상세 */}
      {isOpen && (
        <div className="border-t border-gray-100 px-4 py-3 bg-white flex flex-col gap-3">
          {hasNoGoal ? (
            <p className="text-xs text-gray-400 text-center py-1">아직 목표가 설정되지 않았어요! 🎯</p>
          ) : activeAlerts.length === 0 ? (
            <p className="text-xs text-gray-300 text-center py-1">이번 주 목표를 잘 달성하고 있어요 🎉</p>
          ) : (
            activeAlerts.map(alert => {
              const bl = budgetLabel(alert)
              const dl = diaryLabel(alert)
              return (
                <div key={alert.groupId} className="flex flex-col gap-1">
                  <p className="text-[10px] text-gray-400 font-semibold">{alert.groupName}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bl && (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        alert.budgetStatus === 'DANGER'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-yellow-50 text-yellow-700'
                      }`}>{bl}</span>
                    )}
                    {dl && (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        alert.diaryStatus === 'DANGER'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-yellow-50 text-yellow-700'
                      }`}>{dl}</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </section>
  )
}
