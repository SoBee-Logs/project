import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { ErrorBox } from './common/StatusViews'
import DrillDownModal from './common/DrillDownModal'

const COLORS = ['#6c63ff','#f857a6','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#ef4444','#64748b','#f97316','#84cc16','#06b6d4','#a855f7','#d946ef']

const fmt = v => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : v.toLocaleString()

function CategoryDetail({ category, onClose }) {
  const { data, error, loading } = useFetch(`/admin/spending-detail/${encodeURIComponent(category)}`)

  return (
    <DrillDownModal title={`카테고리 상세: ${category}`} onClose={onClose} width={700}>
      {loading && <p style={{ color: '#888' }}>불러오는 중...</p>}
      {error && <p style={{ color: '#e53e3e' }}>{error}</p>}
      {data && (
        <>
          {/* 월별 추이 */}
          {data.monthly.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={ds.sectionTitle}>월별 추이</div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={data.monthly} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
                  <Tooltip formatter={v => `${v.toLocaleString()}원`} />
                  <Line type="monotone" dataKey="total" stroke="#6c63ff" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 유저별 소비 */}
          {data.per_user.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={ds.sectionTitle}>유저별 소비</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.per_user.map((u, i) => {
                  const max = data.per_user[0].total
                  return (
                    <div key={i} style={ds.userRow}>
                      <div style={{ width: 80, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{u.name}</div>
                      <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', height: 18 }}>
                        <div style={{ height: '100%', width: `${(u.total / max) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 4 }} />
                      </div>
                      <div style={{ width: 110, textAlign: 'right', fontSize: 13, flexShrink: 0 }}>
                        <span style={{ fontWeight: 600 }}>{u.total.toLocaleString()}원</span>
                        <span style={{ color: '#aaa', marginLeft: 4 }}>({u.count}건)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 최근 거래 */}
          <div style={ds.sectionTitle}>최근 거래 ({data.transactions.length}건)</div>
          <table style={ds.table}>
            <thead>
              <tr style={ds.thead}>
                <th>날짜</th><th>가맹점</th><th>사용자</th><th style={{ textAlign: 'right' }}>금액</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t, i) => (
                <tr key={i} style={ds.tr}>
                  <td style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>{t.date}</td>
                  <td style={{ fontWeight: 500 }}>{t.place}</td>
                  <td style={{ color: '#666', fontSize: 13 }}>{t.user}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#6c63ff' }}>{t.amount.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </DrillDownModal>
  )
}

function downloadSpendingCsv(categories) {
  const headers = ['카테고리', '건수', '총금액(원)']
  const rows = categories.map(c => [c.category, c.count, c.total])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'spending.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function SpendingTrends() {
  const { data, error, loading, reload } = useFetch('/admin/spending')
  const [view, setView] = useState('count')
  const [selectedCategory, setSelectedCategory] = useState(null)

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  const catData = data.categories.map(c => ({
    name: c.category?.trim() || '기타',
    건수: c.count, 금액: c.total,
    _category: c.category,
  }))

  return (
    <div>
      <h2 style={styles.heading}>소비 트렌드</h2>

      <div style={styles.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <h3 style={styles.subheading}>
            거래 카테고리 Top 15
            <span style={styles.clickHint}>· 막대 클릭 시 상세</span>
          </h3>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <div style={styles.toggle}>
              <button style={{ ...styles.btn, ...(view === 'count' ? styles.active : {}) }} onClick={() => setView('count')}>건수</button>
              <button style={{ ...styles.btn, ...(view === 'total' ? styles.active : {}) }} onClick={() => setView('total')}>금액</button>
            </div>
            <button onClick={() => downloadSpendingCsv(data.categories)} style={styles.csvBtn}>⬇ CSV</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={catData} layout="vertical" margin={{ left: 30, right: 30 }}
            onClick={e => e?.activePayload?.[0] && setSelectedCategory(e.activePayload[0].payload._category)}>
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={view === 'total' ? fmt : undefined} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
            <Tooltip formatter={v => view === 'total' ? `${v.toLocaleString()}원` : `${v}건`} />
            <Bar dataKey={view === 'count' ? '건수' : '금액'} radius={[0, 4, 4, 0]} cursor="pointer">
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

      {data.lifecycle_spending?.length > 0 && (
        <div style={{ ...styles.chartBox, marginTop: 16 }}>
          <h3 style={styles.subheading}>생애주기별 평균 카드 소비</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.lifecycle_spending} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip formatter={(v, n) => n === 'avg_amount' ? `${v.toLocaleString()}원` : `${v}건`} />
              <Legend />
              <Bar dataKey="avg_amount" name="평균소비(원)" fill="#6c63ff" radius={[6, 6, 0, 0]} />
              <Bar dataKey="tx_count" name="거래건수" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {selectedCategory && (
        <CategoryDetail category={selectedCategory} onClose={() => setSelectedCategory(null)} />
      )}
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  subheading: { fontSize: 15, fontWeight: 600, color: '#444', margin: 0 },
  clickHint: { fontSize: 12, color: '#aaa', fontWeight: 400, marginLeft: 8 },
  section: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  toggle: { display: 'flex', gap: 4 },
  btn: { padding: '4px 14px', borderRadius: 16, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#666' },
  active: { background: '#6c63ff', color: '#fff', border: '1px solid #6c63ff' },
  csvBtn: { padding: '4px 12px', borderRadius: 16, border: '1px solid #10b981', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#10b981' },
}

const ds = {
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#6c63ff', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' },
  userRow: { display: 'flex', alignItems: 'center', gap: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  thead: { background: '#f8f9fa' },
  tr: { borderBottom: '1px solid #f0f0f0' },
}

if (typeof document !== 'undefined' && !document.getElementById('spending-table-style')) {
  const s = document.createElement('style')
  s.id = 'spending-table-style'
  s.textContent = '#spending-table th, #spending-table td { padding: 8px 14px; text-align: left; }'
  document.head.appendChild(s)
}
