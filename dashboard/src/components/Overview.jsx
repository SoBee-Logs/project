import React from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { CardSkeleton, ErrorBox } from './common/StatusViews'

const STAT_CARDS = [
  { key: 'users', label: '전체 유저', icon: '👤', color: '#6c63ff' },
  { key: 'new_users_today', label: '오늘 신규', icon: '🆕', color: '#10b981' },
  { key: 'avatars', label: '아바타', icon: '🧬', color: '#f857a6' },
  { key: 'transactions', label: '거래 내역', icon: '💳', color: '#0ea5e9' },
  { key: 'card_transactions', label: '카드 거래', icon: '🃏', color: '#14b8a6' },
  { key: 'bank_transactions', label: '계좌 거래', icon: '🏦', color: '#f59e0b' },
  { key: 'photos', label: '사진', icon: '📷', color: '#8b5cf6' },
  { key: 'diaries', label: '일기', icon: '📓', color: '#ec4899' },
]

export default function Overview({ onReloadRef, onRefresh }) {
  const { data, error, loading, reload } = useFetch('/admin/overview', 30000)

  const handleReload = () => { reload(); onRefresh?.(new Date()) }
  if (onReloadRef) onReloadRef.current = handleReload

  if (error) return <ErrorBox message={error} onRetry={handleReload} />

  // 7일 트렌드 데이터 병합
  const trendData = (() => {
    if (!data) return []
    const map = {}
    ;(data.diary_trend || []).forEach(d => { map[d.date] = { date: d.date, 일기: d.count, 신규가입: 0 } })
    ;(data.user_trend || []).forEach(d => {
      if (!map[d.date]) map[d.date] = { date: d.date, 일기: 0, 신규가입: 0 }
      map[d.date]['신규가입'] = d.count
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  })()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={styles.heading}>전체 현황</h2>
      </div>

      <div style={styles.grid}>
        {STAT_CARDS.map(c => (
          loading ? <CardSkeleton key={c.key} /> : (
            <div key={c.key} style={{ ...styles.card, borderTop: `4px solid ${c.color}` }}>
              <div style={{ fontSize: 28 }}>{c.icon}</div>
              <div style={{ ...styles.value, color: c.color }}>{(data?.[c.key] ?? 0).toLocaleString()}</div>
              <div style={styles.label}>{c.label}</div>
            </div>
          )
        ))}
      </div>

      {/* VLM 성공률 */}
      {data && (
        <div style={styles.vlmRow}>
          <div style={{ ...styles.vlmCard, borderLeft: '4px solid #10b981' }}>
            <div style={styles.vlmVal}>{data.vlm_success_rate}%</div>
            <div style={styles.vlmLabel}>VLM 분석 성공률</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              {data.vlm_count?.toLocaleString()} / {data.photos?.toLocaleString()} 장
            </div>
          </div>
          <div style={{ ...styles.vlmCard, borderLeft: '4px solid #ef4444' }}>
            <div style={{ ...styles.vlmVal, color: '#ef4444' }}>{data.vlm_missing?.toLocaleString()}</div>
            <div style={styles.vlmLabel}>VLM 미처리 사진</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>분석 대기 중인 사진</div>
          </div>
          <div style={{ ...styles.vlmCard, borderLeft: '4px solid #6c63ff' }}>
            <div style={styles.vlmVal}>{data.vlm_count?.toLocaleString()}</div>
            <div style={styles.vlmLabel}>VLM 분석 완료</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>누적 처리 건수</div>
          </div>
        </div>
      )}

      {/* 7일 트렌드 */}
      <div style={styles.chartBox}>
        <h3 style={styles.subheading}>최근 7일 추이</h3>
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
              <Line type="monotone" dataKey="일기" stroke="#ec4899" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="신규가입" stroke="#6c63ff" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, margin: 0 },
  refreshBtn: {
    padding: '5px 14px', background: '#6c63ff', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 16 },
  card: {
    background: '#fff', borderRadius: 12, padding: '20px 16px',
    textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.06)',
  },
  value: { fontSize: 30, fontWeight: 800, margin: '8px 0 4px' },
  label: { fontSize: 13, color: '#666' },
  vlmRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 },
  vlmCard: {
    background: '#fff', borderRadius: 12, padding: '16px 20px',
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
  },
  vlmVal: { fontSize: 28, fontWeight: 800, color: '#10b981', marginBottom: 4 },
  vlmLabel: { fontSize: 13, fontWeight: 600, color: '#444' },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  subheading: { fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#444' },
}
