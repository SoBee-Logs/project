import React from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { ErrorBox } from './common/StatusViews'

const COLORS = ['#6c63ff', '#e2e8f0']

export default function DiaryMapping() {
  const { data, error, loading, reload } = useFetch('/admin/diary-mapping')

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  const pieData = [
    { name: '결제 매핑 사진', value: data.tx_mapped },
    { name: '미매핑 사진', value: data.total_photos - data.tx_mapped },
  ]

  return (
    <div>
      <h2 style={styles.heading}>사진 · 일기 · 결제 매핑 현황</h2>

      <div style={styles.row}>
        {[
          { value: data.total_photos, label: '전체 사진', color: '#1a1a2e' },
          { value: data.tx_mapped, label: '결제 매핑 사진', color: '#6c63ff', rate: data.tx_mapping_rate },
          { value: data.total_diaries, label: '생성된 일기', color: '#ec4899' },
        ].map((s, i) => (
          <div key={i} style={styles.statCard}>
            <div style={{ ...styles.statValue, color: s.color }}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
            {s.rate != null && <div style={styles.rate}>{s.rate}%</div>}
          </div>
        ))}
      </div>

      <div style={styles.chartBox}>
        <h3 style={styles.subheading}>사진 분류 비율</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Pie>
            <Tooltip formatter={v => `${v}건`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  subheading: { fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#444' },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20 },
  statCard: { background: '#fff', borderRadius: 12, padding: '20px 16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  statValue: { fontSize: 36, fontWeight: 800, color: '#1a1a2e' },
  statLabel: { fontSize: 13, color: '#888', marginTop: 4 },
  rate: { fontSize: 18, fontWeight: 700, color: '#10b981', marginTop: 4 },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)', maxWidth: 480 },
}
