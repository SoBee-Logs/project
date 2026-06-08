import React, { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { ErrorBox } from './common/StatusViews'
import DrillDownModal from './common/DrillDownModal'

const COLORS = ['#6c63ff', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#64748b']

function StageDetail({ stage, label, onClose }) {
  const { data, error, loading } = useFetch(`/admin/lifecycle/${encodeURIComponent(stage)}`)

  const genderLabel = g => g?.toLowerCase() === 'm' ? '남' : g?.toLowerCase() === 'f' ? '여' : '-'

  return (
    <DrillDownModal title={`${label} 상세`} onClose={onClose} width={680}>
      {loading && <p style={{ color: '#888' }}>불러오는 중...</p>}
      {error && <p style={{ color: '#e53e3e' }}>{error}</p>}
      {data && (
        <>
          {/* 상위 소비 카테고리 */}
          {data.top_categories.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={ds.sectionTitle}>이 그룹의 소비 카테고리 Top 5</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.top_categories.map((c, i) => {
                  const max = data.top_categories[0].total
                  return (
                    <div key={i} style={ds.catRow}>
                      <div style={{ width: 100, fontSize: 13, color: '#444', flexShrink: 0 }}>{c.category}</div>
                      <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', height: 18 }}>
                        <div style={{ height: '100%', width: `${(c.total / max) * 100}%`, background: COLORS[i], borderRadius: 4 }} />
                      </div>
                      <div style={{ width: 100, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#333', flexShrink: 0 }}>
                        {c.total.toLocaleString()}원
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 유저 목록 */}
          <div style={ds.sectionTitle}>유저 ({data.users.length}명)</div>
          <table style={ds.table}>
            <thead>
              <tr style={ds.thead}>
                <th>이름</th><th>나이</th><th>성별</th>
                <th>사진</th><th>일기</th><th>거래</th><th>총 소비</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map(u => (
                <tr key={u.user_id} style={ds.tr}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.age ?? '-'}</td>
                  <td>{genderLabel(u.gender)}</td>
                  <td style={ds.num}>{u.photo_count}</td>
                  <td style={ds.num}>{u.diary_count}</td>
                  <td style={ds.num}>{u.tx_count.toLocaleString()}</td>
                  <td style={ds.num}>{u.total_spend.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </DrillDownModal>
  )
}

export default function Lifecycle() {
  const { data, error, loading, reload } = useFetch('/admin/lifecycle')
  const [selected, setSelected] = useState(null)

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  return (
    <div>
      <h2 style={styles.heading}>생애주기 예측 분포</h2>

      <div style={styles.charts}>
        <div style={styles.chartBox}>
          <h3 style={styles.subheading}>생애주기 도넛 차트
            <span style={styles.clickHint}>· 클릭 시 상세</span>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data} cx="50%" cy="50%"
                innerRadius={70} outerRadius={110}
                dataKey="count" nameKey="label"
                label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                cursor="pointer"
                onClick={(entry) => entry && setSelected({ stage: entry.stage, label: entry.label })}
              >
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v}명`, n]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartBox}>
          <h3 style={styles.subheading}>생애주기별 인원 수
            <span style={styles.clickHint}>· 막대 클릭 시 상세</span>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              onClick={e => { if (e?.activePayload?.[0]) { const d = e.activePayload[0].payload; setSelected({ stage: d.stage, label: d.label }) } }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => [`${v}명`]} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} cursor="pointer">
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.cards}>
        {data.map((d, i) => (
          <div key={d.stage} style={{ ...styles.card, borderLeft: `4px solid ${COLORS[i % COLORS.length]}`, cursor: 'pointer' }}
            onClick={() => setSelected({ stage: d.stage, label: d.label })}>
            <div style={{ ...styles.count, color: COLORS[i % COLORS.length] }}>{d.count}명</div>
            <div style={styles.label}>{d.label}</div>
            <div style={styles.code}>{d.stage}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>클릭하여 상세 보기 →</div>
          </div>
        ))}
      </div>

      {selected && (
        <StageDetail stage={selected.stage} label={selected.label} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  subheading: { fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#444' },
  clickHint: { fontSize: 12, color: '#aaa', fontWeight: 400, marginLeft: 8 },
  charts: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 },
  card: { background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', transition: 'box-shadow .15s' },
  count: { fontSize: 28, fontWeight: 800, marginBottom: 4 },
  label: { fontSize: 14, fontWeight: 600, color: '#333' },
  code: { fontSize: 11, color: '#aaa', marginTop: 2 },
}

const ds = {
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#6c63ff', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' },
  catRow: { display: 'flex', alignItems: 'center', gap: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  thead: { background: '#f8f9fa' },
  tr: { borderBottom: '1px solid #f0f0f0' },
  num: { textAlign: 'right', padding: '8px 14px' },
}

if (typeof document !== 'undefined' && !document.getElementById('lifecycle-style')) {
  const s = document.createElement('style')
  s.id = 'lifecycle-style'
  s.textContent = '#lifecycle-table th, #lifecycle-table td { padding: 8px 14px; text-align: left; }'
  document.head.appendChild(s)
}
