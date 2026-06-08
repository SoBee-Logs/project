import React, { useEffect, useState } from 'react'

const STAT_CARDS = [
  { key: 'users', label: '전체 유저', icon: '👤', color: '#6c63ff' },
  { key: 'avatars', label: '아바타', icon: '🧬', color: '#f857a6' },
  { key: 'transactions', label: '거래 내역', icon: '💳', color: '#0ea5e9' },
  { key: 'card_transactions', label: '카드 거래', icon: '🃏', color: '#10b981' },
  { key: 'bank_transactions', label: '계좌 거래', icon: '🏦', color: '#f59e0b' },
  { key: 'photos', label: '사진', icon: '📷', color: '#8b5cf6' },
  { key: 'diaries', label: '일기', icon: '📓', color: '#ec4899' },
  { key: 'vlm_count', label: 'VLM 분석', icon: '🔍', color: '#14b8a6' },
]

export default function Overview() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/admin/overview').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <p style={styles.loading}>불러오는 중...</p>

  return (
    <div>
      <h2 style={styles.heading}>전체 현황</h2>
      <div style={styles.grid}>
        {STAT_CARDS.map(c => (
          <div key={c.key} style={{ ...styles.card, borderTop: `4px solid ${c.color}` }}>
            <div style={{ fontSize: 32 }}>{c.icon}</div>
            <div style={{ ...styles.value, color: c.color }}>{(data[c.key] ?? 0).toLocaleString()}</div>
            <div style={styles.label}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  loading: { color: '#888', padding: 24 },
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 },
  card: {
    background: '#fff', borderRadius: 12, padding: '20px 16px',
    textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.06)',
  },
  value: { fontSize: 32, fontWeight: 800, margin: '8px 0 4px' },
  label: { fontSize: 13, color: '#666' },
}
