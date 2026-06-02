import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

const BLUE = '#3B82F6'
const GRAY = '#6b7280'

export default function BottomNav({ floating = false }) {
  const location = useLocation()

  // 리포트 탭 경고 Red Dot — WARNING/DANGER 상태인 방이 하나라도 있으면 표시
  const [hasAlert, setHasAlert] = useState(false)

  useEffect(() => {
    const checkAlerts = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch('/api/report/alert', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        // SAFE가 아닌 항목이 하나라도 있으면 Red Dot 표시
        const active = data.some(
          (a) => a.budgetStatus !== 'SAFE' || a.diaryStatus !== 'SAFE'
        )
        setHasAlert(active)
      } catch {
        // 조회 실패 시 Red Dot 미표시
      }
    }
    checkAlerts()
  }, [location.pathname])

  const tabs = [
    {
      label: '리포트',
      path: '/report',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? BLUE : GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="12" width="4" height="9" rx="1" fill={active ? BLUE : GRAY} stroke="none" />
          <rect x="10" y="7" width="4" height="14" rx="1" fill={active ? BLUE : GRAY} stroke="none" />
          <rect x="17" y="3" width="4" height="18" rx="1" fill={active ? BLUE : GRAY} stroke="none" />
        </svg>
      ),
    },
    {
      label: '홈',
      path: '/home',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? BLUE : GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" fill={active ? BLUE : 'none'} />
          <path d="M9 21V12h6v9" stroke={active ? 'white' : GRAY} strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      label: '피드',
      path: '/feed',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? BLUE : GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" fill={active ? BLUE : 'none'} />
          <line x1="7" y1="8" x2="17" y2="8" stroke={active ? 'white' : GRAY} />
          <line x1="7" y1="12" x2="17" y2="12" stroke={active ? 'white' : GRAY} />
          <line x1="7" y1="16" x2="13" y2="16" stroke={active ? 'white' : GRAY} />
        </svg>
      ),
    },
  ]

  const navClass = floating
  ? 'bg-white shadow-lg border-t border-gray-100 h-14'
  : 'h-16 bg-white border-t border-gray-100'

  return (
    <nav className={`flex-shrink-0 flex items-center justify-around ${navClass}`}>
      {tabs.map((tab) => {
        const active = location.pathname.startsWith(tab.path)
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className="flex flex-col items-center justify-center gap-0.5 w-full h-full"
          >
            {/* 리포트 탭에만 Red Dot 표시 */}
            <div className="relative">
              {tab.icon(active)}
              {tab.path === '/report' && hasAlert && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
              )}
            </div>
            <span className="text-[11px] font-medium" style={{ color: active ? BLUE : GRAY }}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
