import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#6c63ff','#f857a6','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#ef4444','#64748b']

export default function VlmStats() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/admin/vlm-stats').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  const ages = Object.keys(data.age_items).sort((a, b) => Number(a) - Number(b))

  return (
    <div>
      <h2 style={styles.heading}>VLM 분석 현황</h2>

      <div style={styles.statRow}>
        {[
          { label: 'VLM 분석 완료', value: data.total_vlm, color: '#6c63ff' },
          { label: '전체 사진', value: data.total_photos, color: '#0ea5e9' },
          { label: '결제 매핑', value: data.mapped_count, color: '#10b981' },
          { label: '매핑률', value: `${data.mapping_rate}%`, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={styles.statCard}>
            <div style={{ ...styles.statVal, color: s.color }}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.charts}>
        <div style={styles.chartBox}>
          <h3 style={styles.subheading}>VLM 카테고리 분포 (Top 10)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.categories} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartBox}>
          <h3 style={styles.subheading}>나이대별 자주 등장한 품목</h3>
          <div style={styles.ageGrid}>
            {ages.map(age => (
              <div key={age} style={styles.ageCard}>
                <div style={styles.ageBadge}>{age}세</div>
                <ul style={styles.itemList}>
                  {data.age_items[age].map((item, i) => (
                    <li key={i} style={styles.item}>
                      <span style={{ color: COLORS[i] }}>●</span>{' '}
                      <span style={styles.itemName}>{item.item.length > 20 ? item.item.slice(0, 20) + '…' : item.item}</span>
                      <span style={styles.itemCount}>{item.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  subheading: { fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#444' },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16, marginBottom: 20 },
  statCard: {
    background: '#fff', borderRadius: 12, padding: '20px 16px', textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
  },
  statVal: { fontSize: 32, fontWeight: 800, marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#888' },
  charts: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  ageGrid: { display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 280, overflowY: 'auto' },
  ageCard: { background: '#f8f9fa', borderRadius: 8, padding: 12 },
  ageBadge: {
    display: 'inline-block', background: '#6c63ff', color: '#fff',
    borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 700, marginBottom: 8,
  },
  itemList: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 },
  item: { fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 },
  itemName: { flex: 1, color: '#333' },
  itemCount: { fontWeight: 700, color: '#6c63ff', fontSize: 12 },
}
