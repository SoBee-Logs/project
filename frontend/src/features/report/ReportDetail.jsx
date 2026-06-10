import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getUserId } from '../../common/hooks/useAuth'

const CATEGORY_PALETTE = [
  '#1e73be', '#38BDF8', '#60a5fa', '#93c5fd', '#0ea5e9',
  '#3b82f6', '#7dd3fc', '#2563eb', '#6366f1', '#bfdbfe',
]
  
function groupByDate(transactions) {
  const map = {}
  transactions.forEach(tx => {
    const date = tx.payment_date ?? '날짜 없음'
    if (!map[date]) map[date] = []
    map[date].push(tx)
  })
  return Object.entries(map)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items }))
}
 
function formatDateLabel(dateStr) {
  try {
    const d = new Date(dateStr)
    const month = d.getMonth() + 1
    const day   = d.getDate()
    const week  = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
    return `${month}월 ${day}일 (${week})`
  } catch {
    return dateStr
  }
}
 
export default function ReportDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const USER_ID = getUserId()

  useEffect(() => {
    if (!USER_ID) navigate('/login')
  }, [USER_ID])
 
  const today = new Date()
  const year  = location.state?.year  ?? today.getFullYear()
  const month = location.state?.month ?? today.getMonth() + 1
 
  const categoryColorMap = location.state?.categoryColorMap ?? {}
 
  const [txData,  setTxData]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [openCat, setOpenCat] = useState(null)
  const catItemRefs = useRef({}) // 각 카테고리 div ref
 
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/report/mydata/transaction?user_id=${USER_ID}&year=${year}&month=${month}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setTxData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [year, month])
 
 
  if (loading) return (
    <div className="flex flex-col gap-4 pt-4 px-4 pb-24 animate-pulse">
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
    </div>
  )
 
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 px-4">
      <p className="text-2xl">😢</p>
      <p className="text-sm text-gray-500 text-center">데이터를 불러올 수 없어요.<br />{error}</p>
      <button onClick={() => navigate('/report', { state: { year, month } })} className="mt-2 px-5 py-2 rounded-xl bg-[#1e73be] text-white text-sm font-semibold">
        돌아가기
      </button>
    </div>
  )
 
  const categoryList = txData
    ? Object.entries(txData.category_price)
        .sort((a, b) => b[1] - a[1])
        .map(([name, total], i) => ({
          name,
          total,
          color: categoryColorMap[name] ?? CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
        }))
    : []
 
  const maxTotal = Math.max(...categoryList.map(c => c.total), 1)
 
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-1 pb-3 shrink-0">
        <button
          onClick={() => navigate('/report/monthly', { state: { year, month } })}
          className="flex items-center justify-center w-8 h-8 -ml-2 text-gray-800"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>
      <div className="flex flex-col gap-4 pt-2 px-4 pb-24 overflow-y-auto flex-1">

      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-700">{year}년 {month}월 상세 리포트</span>
      </div>

      <div className="rounded-2xl border border-gray-100 p-4 shadow-sm">
        <p className="text-xs text-gray-500 font-semibold mb-4">📊 카테고리별 소비</p>
        {categoryList.length === 0
          ? <p className="text-xs text-gray-300 text-center py-4">데이터가 없어요</p>
          : (
            <div className="flex flex-col gap-1">
              {categoryList.map((cat) => {
                const isOpen = openCat === cat.name
                const allTx = (txData?.category_transactions?.[cat.name] ?? [])
                  .filter(tx => Number(tx.payment_out) > 0)
                const grouped = groupByDate(allTx)
 
                return (
                  <div
                    key={cat.name}
                    ref={el => catItemRefs.current[cat.name] = el}
                  >
                    <button
                      className="w-full text-left py-2.5 active:bg-gray-50 rounded-xl px-1 transition-colors"
                      onClick={() => {
                        const next = isOpen ? null : cat.name
                        setOpenCat(next)
                        // 열릴 때만 해당 카테고리로 스크롤
                        if (next) {
                          setTimeout(() => {
                            const el = catItemRefs.current[cat.name]
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                          }, 50)
                        }
                      }}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                          <span className="text-xs font-semibold text-gray-700">{cat.name}</span>
                          {allTx.length > 0 && (
                            <span className="text-[10px] text-gray-400">({allTx.length}건)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">{cat.total.toLocaleString()}원</span>
                          <span className="text-[10px] text-gray-300">{isOpen ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(cat.total / maxTotal) * 100}%`, background: cat.color }}
                        />
                      </div>
                    </button>
 
                    {isOpen && (
                      <div className="mx-1 mb-2 rounded-xl bg-gray-50 overflow-hidden">
                        {grouped.length === 0
                          ? <p className="text-xs text-gray-300 text-center py-3">거래 내역이 없어요</p>
                          : grouped.map(({ date, items }) => (
                            <div key={date}>
                              {/* 날짜 헤더 */}
                              <div className="px-3 pt-2.5 pb-0.5 flex items-center gap-2">
                                <span className="text-[11px] font-bold text-gray-400 shrink-0">
                                  {formatDateLabel(date)}
                                </span>
                                <div className="flex-1 h-px bg-gray-200" />
                              </div>
                              {/* 거래 행 */}
                              {items.map((tx, i) => (
                                <div
                                  key={i}
                                  className="flex flex-col px-3 py-1.5 border-b border-gray-100 last:border-0"
                                >
                                  {/* 첫 줄: 가맹점명 + 금액 같은 라인 */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-700 truncate max-w-[55%]">
                                      {tx.payment_place ?? '-'}
                                    </span>
                                    <span className="text-xs font-bold shrink-0" style={{ color: cat.color }}>
                                      {Number(tx.payment_out).toLocaleString()}원
                                    </span>
                                  </div>
                                  {/* 둘째 줄: 시간 오른쪽 작게 */}
                                  {tx.payment_time && (
                                    <div className="flex justify-end mt-0">
                                      <span className="text-[9px] text-gray-300">
                                        {String(tx.payment_time).slice(0, 5)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        }
      </div>
      </div>
    </div>
  )
}