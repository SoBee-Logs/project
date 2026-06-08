import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts'

const COLORS = ['#6c63ff','#f857a6','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#ef4444','#64748b','#f97316','#84cc16','#06b6d4','#a855f7','#d946ef']

const fmt = v => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : v.toLocaleString()

export default function SpendingTrends() {
  const [data, setData] = useState(null)
  const [view, setView] = useState('count')

  useEffect(() => {
    fetch('/admin/spending').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  const catData = data.categories.map(c => ({
    name: c.category?.trim() || '기타',
    건수: c.count,
    금액: c.total,
  }))

  return (
    <div>
      <h2 style={styles.heading}>소비 트렌드</h2>

      <div style={styles.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <h3 style={styles.subheading}>거래 카테고리 Top 15</h3>
          <div style={styles.toggle}>
            <button style={{ ...styles.btn, ...(view === 'count' ? styles.active : {}) }} onClick={() => setView('count')}>건수</button>
            <button style={{ ...styles.btn, ...(view === 'total' ? styles.active : {}) }} onClick={() => setView('total')}>금액</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={catData} layout="vertical" margin={{ left: 30, right: 30 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={view === 'total' ? fmt : undefined} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
            <Tooltip formatter={v => view === 'total' ? `${v.toLocaleString()}원` : `${v}건`} />
            <Bar dataKey={view === 'count' ? '건수' : '금액'} radius={[0, 4, 4, 0]}>
              {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.row}>
        <div style={styles.chartBox}>
          <h3 style={styles.subheading}>월별 카드 소비 추이</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.monthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip formatter={v => `${v.toLocaleString()}원`} />
              <Line type="monotone" dataKey="total" stroke="#6c63ff" strokeWidth={2} dot={{ r: 4 }} name="총 소비" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartBox}>
          <h3 style={styles.subheading}>카드 업종 분류 Top 10</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.card_types} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="type" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={v => `${v}건`} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.card_types.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  subheading: { fontSize: 15, fontWeight: 600, color: '#444', margin: 0 },
  section: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  toggle: { display: 'flex', gap: 4 },
  btn: {
    padding: '4px 14px', borderRadius: 16, border: '1px solid #ddd',
    background: '#fff', cursor: 'pointer', fontSize: 13, color: '#666',
  },
  active: { background: '#6c63ff', color: '#fff', border: '1px solid #6c63ff' },
}
