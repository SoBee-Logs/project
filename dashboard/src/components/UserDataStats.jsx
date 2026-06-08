import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function UserDataStats() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/admin/user-data').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  const chartData = data.map(u => ({
    name: u.name,
    카드거래: u.card_tx,
    계좌거래: u.bank_tx,
    사진: u.photo_count,
    일기: u.diary_count,
  }))

  return (
    <div>
      <h2 style={styles.heading}>사용자별 데이터 현황</h2>
      <div style={styles.chartBox}>
        <h3 style={styles.subheading}>유저별 거래·사진·일기 건수</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="카드거래" fill="#6c63ff" />
            <Bar dataKey="계좌거래" fill="#0ea5e9" />
            <Bar dataKey="사진" fill="#f59e0b" />
            <Bar dataKey="일기" fill="#ec4899" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th>유저</th><th>나이</th><th>성별</th><th>생애주기</th>
              <th>카드</th><th>계좌</th><th>카드거래</th><th>계좌거래</th><th>사진</th><th>일기</th>
            </tr>
          </thead>
          <tbody>
            {data.map(u => (
              <tr key={u.user_id} style={styles.tr}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td>{u.age ?? '-'}</td>
                <td>{u.gender === 'M' ? '남' : u.gender === 'F' ? '여' : '-'}</td>
                <td><span style={styles.badge}>{u.life_stage_code || '미분류'}</span></td>
                <td style={styles.num}>{u.card_count}</td>
                <td style={styles.num}>{u.bank_count}</td>
                <td style={styles.num}>{u.card_tx.toLocaleString()}</td>
                <td style={styles.num}>{u.bank_tx.toLocaleString()}</td>
                <td style={styles.num}>{u.photo_count}</td>
                <td style={styles.num}>{u.diary_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  subheading: { fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#444' },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  tableWrap: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  thead: { background: '#f8f9fa' },
  tr: { borderBottom: '1px solid #f0f0f0', ':hover': { background: '#fafafa' } },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingRight: 16 },
  badge: { background: '#ede9fe', color: '#6c63ff', padding: '2px 8px', borderRadius: 8, fontSize: 12 },
}

// Apply th/td padding
const styleTag = document.createElement('style')
styleTag.textContent = 'table th, table td { padding: 10px 14px; text-align: left; }'
document.head.appendChild(styleTag)
