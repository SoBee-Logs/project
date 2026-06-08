import React, { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'

const COLORS = ['#6c63ff', '#0ea5e9', '#e2e8f0']

export default function DiaryMapping() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/admin/diary-mapping').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  const pieData = [
    { name: '결제 매핑 사진', value: data.tx_mapped },
    { name: '일기 등록 사진', value: data.photos_in_diary - data.tx_mapped > 0 ? data.photos_in_diary - data.tx_mapped : 0 },
    { name: '미매핑 사진', value: data.total_photos - data.photos_in_diary },
  ]

  const barData = data.per_user
    .filter(u => u.total_photos > 0)
    .map(u => ({
      name: u.name,
      전체사진: u.total_photos,
      일기등록: u.diary_photos,
      결제매핑: u.mapped_photos,
    }))

  return (
    <div>
      <h2 style={styles.heading}>사진 · 일기 · 결제 매핑 현황</h2>

      <div style={styles.row}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{data.total_photos}</div>
          <div style={styles.statLabel}>전체 사진</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#0ea5e9' }}>{data.photos_in_diary}</div>
          <div style={styles.statLabel}>일기 등록 사진</div>
          <div style={styles.rate}>{data.diary_rate}%</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#6c63ff' }}>{data.tx_mapped}</div>
          <div style={styles.statLabel}>결제 매핑 사진</div>
          <div style={styles.rate}>{data.tx_mapping_rate}%</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#ec4899' }}>{data.total_diaries}</div>
          <div style={styles.statLabel}>생성된 일기</div>
        </div>
      </div>

      <div style={styles.charts}>
        <div style={styles.chartBox}>
          <h3 style={styles.subheading}>사진 분류 비율</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={v => `${v}건`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartBox}>
          <h3 style={styles.subheading}>유저별 사진 매핑 현황</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="전체사진" fill="#e2e8f0" />
              <Bar dataKey="일기등록" fill="#0ea5e9" />
              <Bar dataKey="결제매핑" fill="#6c63ff" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  subheading: { fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#444' },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 20 },
  statCard: {
    background: '#fff', borderRadius: 12, padding: '20px 16px', textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
  },
  statValue: { fontSize: 36, fontWeight: 800, color: '#1a1a2e' },
  statLabel: { fontSize: 13, color: '#888', marginTop: 4 },
  rate: { fontSize: 18, fontWeight: 700, color: '#10b981', marginTop: 4 },
  charts: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
}
