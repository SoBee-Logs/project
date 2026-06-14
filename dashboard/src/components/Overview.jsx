import React, { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { CardSkeleton, ErrorBox } from './common/StatusViews'
import soBee from '../assets/so-bee.png'

const STAT_CARDS = [
  { key: 'users',          label: '전체 유저', icon: '👤',  color: '#6c63ff' },
  { key: 'new_users_today',label: '오늘 신규', icon: '🆕',  color: '#10b981' },
  { key: 'avatars',        label: '페르소나',  icon: null, img: soBee, color: '#f857a6' },
  { key: 'transactions',   label: '거래 내역', icon: '💳',  color: '#0ea5e9' },
  { key: 'photos',         label: '사진',      icon: '📷',  color: '#f59e0b' },
  { key: 'diaries',        label: '일기',      icon: '📓',  color: '#ef4444' },
]

const LINES = [
  { key: '일기생성수',  color: '#14b8a6' },
  { key: '사진업로드수', color: '#f59e0b' },
  { key: '거래내역수',  color: '#a855f7' },
]

export default function Overview() {
  const { data, error, loading, reload } = useFetch('/admin/overview', 30000)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [activeLines, setActiveLines] = useState(new Set(LINES.map(l => l.key)))

  const toggleLine = (key) => {
    setActiveLines(prev => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size > 1) next.delete(key) }
      else next.add(key)
      return next
    })
  }

  const handleReload = () => { reload(); setLastRefresh(new Date()) }

  if (error) return <ErrorBox message={error} onRetry={handleReload} />

  const trendData = (() => {
    if (!data) return []
    const map = {}
    ;(data.diary_trend || []).forEach(d => { map[d.date] = { date: d.date, 일기생성수: d.count, 사진업로드수: 0, 거래내역수: 0 } })
    ;(data.photo_trend || []).forEach(d => {
      if (!map[d.date]) map[d.date] = { date: d.date, 일기생성수: 0, 사진업로드수: 0, 거래내역수: 0 }
      map[d.date]['사진업로드수'] = d.count
    })
    ;(data.transaction_trend || []).forEach(d => {
      if (!map[d.date]) map[d.date] = { date: d.date, 일기생성수: 0, 사진업로드수: 0, 거래내역수: 0 }
      map[d.date]['거래내역수'] = d.count
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  })()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={styles.heading}>전체 현황</h2>
        <span style={{ fontSize: 12, color: '#aaa' }}>30초마다 자동갱신 · 마지막: {lastRefresh.toLocaleTimeString()}</span>
      </div>

      <div style={styles.grid}>
        {STAT_CARDS.map(c => (
          loading ? <CardSkeleton key={c.key} /> : (
            <div key={c.key} style={{ ...styles.card, borderTop: `4px solid ${c.color}` }}>
              <div style={{ fontSize: 28, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {c.img ? <img src={c.img} alt={c.label} style={{ width: 42, height: 42, objectFit: 'contain' }} /> : c.icon}
              </div>
              <div style={{ ...styles.value, color: c.color }}>{(data?.[c.key] ?? 0).toLocaleString()}</div>
              <div style={styles.label}>{c.label}</div>
            </div>
          )
        ))}
      </div>

      <div style={styles.chartBox}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ ...styles.subheading, marginBottom: 0 }}>최근 7일 서비스 이용 추이</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {LINES.map(l => (
              <button key={l.key} onClick={() => toggleLine(l.key)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                border: `2px solid ${l.color}`,
                background: activeLines.has(l.key) ? l.color : 'transparent',
                color: activeLines.has(l.key) ? '#fff' : l.color,
                fontWeight: 600, transition: 'all .15s',
              }}>
                {l.key}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>로딩 중...</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {LINES.map(l => activeLines.has(l.key) && (
                <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 16 },
  card: {
    background: '#fff', borderRadius: 12, padding: '20px 16px',
    textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.06)',
  },
  value: { fontSize: 30, fontWeight: 800, margin: '8px 0 4px' },
  label: { fontSize: 13, color: '#666' },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  subheading: { fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#444' },
}
