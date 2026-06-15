import React, { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { ErrorBox } from './common/StatusViews'
import DrillDownModal from './common/DrillDownModal'

const COLORS = ['#6c63ff', '#e2e8f0']
const PAGE_SIZE = 10

function UserMappingDetail({ userId, name, onClose }) {
  const { data, error, loading } = useFetch(`/admin/diary-user/${userId}`)

  const statusLabel = p => {
    if (p.tx_mapped) return { text: '결제 매핑', color: '#6c63ff', bg: '#ede9fe' }
    if (p.in_diary) return { text: '일기 등록', color: '#0ea5e9', bg: '#e0f2fe' }
    return { text: '미매핑', color: '#94a3b8', bg: '#f1f5f9' }
  }

  return (
    <DrillDownModal title={`${name}의 사진·일기 현황`} onClose={onClose} width={700}>
      {loading && <p style={{ color: '#888' }}>불러오는 중...</p>}
      {error && <p style={{ color: '#e53e3e' }}>{error}</p>}
      {data && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[
              { label: '전체 사진', value: data.photos.length, color: '#333' },
              { label: '일기 등록', value: data.photos.filter(p => p.in_diary).length, color: '#0ea5e9' },
              { label: '결제 매핑', value: data.photos.filter(p => p.tx_mapped).length, color: '#6c63ff' },
              { label: '일기 수', value: data.diaries.length, color: '#ec4899' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: '#f8f9fa', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={ds.sectionTitle}>사진 목록 ({data.photos.length}장)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 24 }}>
            {data.photos.map(p => {
              const st = statusLabel(p)
              return (
                <div key={p.photo_id} style={{ borderRadius: 10, overflow: 'hidden', border: `2px solid ${st.color}40`, background: '#fff' }}>
                  {p.url ? (
                    <img src={p.url} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }}
                      onError={e => { e.target.style.display = 'none' }} />
                  ) : (
                    <div style={{ height: 80, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📷</div>
                  )}
                  <div style={{ padding: '6px 8px' }}>
                    <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '2px 6px', borderRadius: 6, display: 'block', textAlign: 'center', marginBottom: 4 }}>
                      {st.text}
                    </span>
                    {p.category && <div style={{ fontSize: 10, color: '#888', textAlign: 'center' }}>{p.category}</div>}
                  </div>
                </div>
              )
            })}
          </div>

          {data.diaries.length > 0 && (
            <>
              <div style={ds.sectionTitle}>일기 목록 ({data.diaries.length}건)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.diaries.map(d => (
                  <div key={d.id} style={ds.diaryCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#888' }}>{d.created_at.slice(0, 10)}</span>
                      <span style={{ fontSize: 12, color: '#0ea5e9' }}>사진 {d.photo_count}장</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>{d.content}...</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </DrillDownModal>
  )
}

export default function DiaryMapping() {
  const { data, error, loading, reload } = useFetch('/admin/diary-mapping')
  const [selectedUser, setSelectedUser] = useState(null)
  const [page, setPage] = useState(1)

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  const pieData = [
    { name: '결제 매핑 사진', value: data.tx_mapped },
    { name: '미매핑 사진', value: data.total_photos - data.tx_mapped },
  ]

  const totalPages = Math.max(1, Math.ceil(data.per_user.length / PAGE_SIZE))
  const paginated = data.per_user.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <h2 style={styles.heading}>사진 · 일기 · 결제 매핑 현황</h2>

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
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

        <div style={{ ...styles.chartBox, flex: 2 }}>
          <h3 style={styles.subheading}>사진 분류 비율</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart margin={{ top: 50, bottom: 40, left: 10, right: 10 }}>
              <Pie data={pieData} cx="50%" cy="58%" outerRadius={75} dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={v => `${v}건`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16 }}>
            {pieData.map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555' }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: COLORS[i] }} />
                {entry.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)', marginTop: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={th}>번호</th>
              <th style={th}>유저</th>
              <th style={th}>전체 사진</th>
              <th style={th}>일기 등록</th>
              <th style={th}>결제 매핑</th>
              <th style={th}>일기등록률</th>
              <th style={th}>매핑률</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((u, i) => (
              <tr key={u.user_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ ...th, color: '#aaa', fontVariantNumeric: 'tabular-nums' }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                <td style={{ ...th, fontWeight: 600 }}>{u.name}</td>
                <td style={th}>{u.total_photos}</td>
                <td style={{ ...th, color: '#0ea5e9', fontWeight: 600 }}>{u.diary_photos}</td>
                <td style={{ ...th, color: '#6c63ff', fontWeight: 600 }}>{u.mapped_photos}</td>
                <td style={th}>
                  {u.total_photos > 0 ? `${((u.diary_photos / u.total_photos) * 100).toFixed(0)}%` : '-'}
                </td>
                <td style={th}>
                  {u.total_photos > 0 ? `${((u.mapped_photos / u.total_photos) * 100).toFixed(0)}%` : '-'}
                </td>
                <td style={th}>
                  <button onClick={() => setSelectedUser({ id: u.user_id, name: u.name })}
                    style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #6c63ff', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6c63ff' }}>
                    상세
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={styles.pageBtn}>←</button>
          <span style={styles.pageInfo}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={styles.pageBtn}>→</button>
        </div>
      )}

      {selectedUser && (
        <UserMappingDetail userId={selectedUser.id} name={selectedUser.name} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  )
}

const th = { padding: '10px 14px', textAlign: 'center', verticalAlign: 'middle' }

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  subheading: { fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#444' },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20 },
  statCard: { background: '#fff', borderRadius: 12, padding: '20px 16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  statValue: { fontSize: 36, fontWeight: 800, color: '#1a1a2e' },
  statLabel: { fontSize: 13, color: '#888', marginTop: 4 },
  rate: { fontSize: 18, fontWeight: 700, color: '#10b981', marginTop: 4 },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)', maxWidth: 480 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 20 },
  pageBtn: {
    width: 36, height: 36, borderRadius: 8, border: '1px solid #ddd',
    background: '#fff', fontSize: 16, cursor: 'pointer', color: '#444',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  pageInfo: { fontSize: 14, color: '#555', minWidth: 60, textAlign: 'center' },
}

const ds = {
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#6c63ff', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' },
  diaryCard: { background: '#f8f9fa', borderRadius: 10, padding: '12px 14px' },
}
