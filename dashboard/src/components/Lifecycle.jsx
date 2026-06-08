import React, { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'

const COLORS = ['#6c63ff', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#64748b']

export default function Lifecycle() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/admin/lifecycle').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  return (
    <div>
      <h2 style={styles.heading}>생애주기 예측 분포</h2>
      <div style={styles.charts}>
        <div style={styles.chartBox}>
          <h3 style={styles.subheading}>생애주기 도넛 차트</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data} cx="50%" cy="50%"
                innerRadius={70} outerRadius={110}
                dataKey="count" nameKey="label"
                label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v}명`, n]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartBox}>
          <h3 style={styles.subheading}>생애주기별 인원 수</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => [`${v}명`]} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.cards}>
        {data.map((d, i) => (
          <div key={d.stage} style={{ ...styles.card, borderLeft: `4px solid ${COLORS[i % COLORS.length]}` }}>
            <div style={{ ...styles.count, color: COLORS[i % COLORS.length] }}>{d.count}명</div>
            <div style={styles.label}>{d.label}</div>
            <div style={styles.code}>{d.stage}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  subheading: { fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#444' },
  charts: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 },
  card: {
    background: '#fff', borderRadius: 12, padding: '16px 20px',
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
  },
  count: { fontSize: 28, fontWeight: 800, marginBottom: 4 },
  label: { fontSize: 14, fontWeight: 600, color: '#333' },
  code: { fontSize: 11, color: '#aaa', marginTop: 2 },
}
