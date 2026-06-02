// AlertBoard 컴포넌트 — Report 화면 주간 목표 달성 현황
// 항상 틀은 표시, WARNING/DANGER 방 있을 때만 배너 내용 채움

import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// 상태별 스타일 설정
const STATUS_STYLE = {
  WARNING: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    icon: '⚠️',
    textColor: 'text-yellow-800',
  },
  DANGER: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    icon: '🚨',
    textColor: 'text-red-700',
  },
}

// 단일 알림 배너
function AlertBanner({ icon, message, style }) {
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-xl border ${style.bg} ${style.border}`}>
      <span className="text-sm shrink-0 mt-0.5">{icon}</span>
      <p className={`text-xs leading-relaxed ${style.textColor}`}>{message}</p>
    </div>
  )
}

export default function AlertBoard() {
  const [alerts, setAlerts] = useState([])
  const location = useLocation()

  // 리포트 탭 진입할 때마다 재조회
  // - 소비 경고: 전날까지 동기화된 거래 기준 (하루 1회 Airflow 동기화)
  // - 일기 경고: diary 테이블 실시간 카운트 → 일기 작성 후 탭 이동 시 즉시 반영
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
      } catch (err) {
        console.error('AlertBoard 조회 실패', err)
      }
    }
    fetchAlerts()
  }, [location.pathname])

  // WARNING / DANGER 상태인 항목만 필터링
  const activeAlerts = alerts.filter(
    (a) => a.budgetStatus !== 'SAFE' || a.diaryStatus !== 'SAFE'
  )

  return (
    <section className="rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-xs text-gray-500 font-semibold mb-3">🎯 이번 주 목표 현황</p>

      {activeAlerts.length === 0 ? (
        // 경고 없음 — 빈 틀 유지 (목표 미설정 또는 모두 SAFE)
        <p className="text-xs text-gray-300 text-center py-2">
          이번 주 목표를 잘 달성하고 있어요 🎉
        </p>
      ) : (
        // 경고 있음 — 방별 배너 표시
        <div className="flex flex-col gap-3">
          {activeAlerts.map((alert) => (
            <div key={alert.groupId} className="flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold text-gray-400 px-1">
                📌 {alert.groupName}
              </p>
              {alert.budgetStatus !== 'SAFE' && alert.budgetMessage && (
                <AlertBanner
                  icon={STATUS_STYLE[alert.budgetStatus]?.icon ?? '⚠️'}
                  message={alert.budgetMessage}
                  style={STATUS_STYLE[alert.budgetStatus] ?? STATUS_STYLE.WARNING}
                />
              )}
              {alert.diaryStatus !== 'SAFE' && alert.diaryMessage && (
                <AlertBanner
                  icon={STATUS_STYLE[alert.diaryStatus]?.icon ?? '⚠️'}
                  message={alert.diaryMessage}
                  style={STATUS_STYLE[alert.diaryStatus] ?? STATUS_STYLE.WARNING}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
