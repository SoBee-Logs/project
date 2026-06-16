import React, { useState, useEffect } from 'react'
import { ScatterChart, Scatter, Cell, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { CardSkeleton, ErrorBox } from './common/StatusViews'
import DrillDownModal from './common/DrillDownModal'
import { lifecycleColor } from '../constants/lifecycleColors'

const LIFE_STAGE = {
  TEEN: '십대', UNI: '대학생', NEW_JOB: '사회초년생', NEW_WED: '신혼',
  CHILD_BABY: '자녀영유아', CHILD_TEEN: '자녀의무교육', CHILD_UNI: '자녀대학생',
  GOLLIFE: '중년기타', SECLIFE: '2nd Life', RETIR: '은퇴',
}

const LIFECYCLE_FILTERS = [
  { value: 'ALL', label: '전체' },
  ...Object.entries(LIFE_STAGE).map(([code, label]) => ({ value: code, label })),
]

// 클릭 정렬 가능한 컬럼 (생애주기는 정렬 대신 필터로 처리하므로 제외)
const SORT_COLUMNS = [
  { field: 'name', label: '유저', type: 'str' },
  { field: 'nickname', label: '닉네임', type: 'str' },
  { field: 'age', label: '나이', type: 'num' },
  { field: 'gender', label: '성별', type: 'str' },
  { field: null, label: '생애주기', type: null },
  { field: 'card_count', label: '카드', type: 'num' },
  { field: 'bank_count', label: '계좌', type: 'num' },
  { field: 'tx_count', label: '거래 내역', type: 'num' },
  { field: 'photo_count', label: '사진', type: 'num' },
  { field: 'diary_count', label: '일기', type: 'num' },
  { field: 'last_diary', label: '마지막 일기', type: 'date' },
]

const PAGE_SIZE = 10

function sortUsers(rows, field, dir, type) {
  if (!field) return rows
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let va = a[field], vb = b[field]
    if (type === 'num') {
      va = Number(va) || 0; vb = Number(vb) || 0
      return (va - vb) * sign
    }
    // str / date 모두 문자열 비교 (빈 값은 항상 뒤로)
    va = va == null ? '' : String(va)
    vb = vb == null ? '' : String(vb)
    if (!va && vb) return 1
    if (va && !vb) return -1
    return va.localeCompare(vb) * sign
  })
}

const TABS = ['소비', '일기', '사진']

function UserDetailModal({ userId, onClose }) {
  const { data, error, loading } = useFetch(`/admin/user-detail/${userId}`)
  const [tab, setTab] = useState('소비')

  const genderLabel = g => g?.toLowerCase() === 'm' ? '남' : g?.toLowerCase() === 'f' ? '여' : '-'

  return (
    <DrillDownModal title={data ? `${data.name} 상세` : '유저 상세'} onClose={onClose} width={640}>
      {loading && <p style={{ color: '#888' }}>불러오는 중...</p>}
      {error && <p style={{ color: '#e53e3e' }}>오류: {error}</p>}
      {data && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{data.name}</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
                {data.age}세 · {genderLabel(data.gender)} · {LIFE_STAGE[data.life_stage_code] || '미분류'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ padding: '4px 12px', borderRadius: 14, border: '1px solid #ddd', cursor: 'pointer', fontSize: 13, background: tab === t ? '#6c63ff' : '#fff', color: tab === t ? '#fff' : '#666' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {tab === '소비' && (
            <>
              <div style={ms.sectionTitle}>상위 소비 카테고리</div>
              {data.top_categories.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>데이터 없음</p>}
              {data.top_categories.map((c, i) => {
                const max = data.top_categories[0]?.total || 1
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{c.category}</span>
                      <span style={{ fontWeight: 700, color: '#6c63ff' }}>{c.total.toLocaleString()}원 ({c.count}건)</span>
                    </div>
                    <div style={{ background: '#f0f0f0', borderRadius: 4, height: 6 }}>
                      <div style={{ height: '100%', width: `${(c.total / max) * 100}%`, background: '#6c63ff', borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
              <div style={{ ...ms.sectionTitle, marginTop: 20 }}>최근 거래 10건</div>
              {data.recent_transactions.map((t, i) => (
                <div key={i} style={ms.txRow}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.place}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{t.date} · {t.category}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#333' }}>{t.amount.toLocaleString()}원</div>
                </div>
              ))}
            </>
          )}

          {tab === '일기' && (
            <>
              <div style={ms.sectionTitle}>최근 일기 ({data.recent_diaries.length}건)</div>
              {data.recent_diaries.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>일기 없음</p>}
              {data.recent_diaries.map(d => (
                <div key={d.id} style={ms.diary}>
                  <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>{d.created_at.slice(0, 10)}</div>
                  <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>{d.content}</div>
                </div>
              ))}
            </>
          )}

          {tab === '사진' && (
            <>
              <div style={ms.sectionTitle}>최근 사진 VLM 결과 ({data.recent_photos.length}장)</div>
              {data.recent_photos.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>사진 없음</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {data.recent_photos.map(p => (
                  <div key={p.photo_id} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
                    {p.url ? (
                      <img src={p.url} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }}
                        onError={e => { e.target.style.display = 'none' }} />
                    ) : (
                      <div style={{ height: 80, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📷</div>
                    )}
                    <div style={{ padding: '6px 8px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6c63ff' }}>{p.category || '미분류'}</div>
                      <div style={{ fontSize: 11, color: '#666' }}>{p.item || '-'}</div>
                      {p.confidence && (
                        <div style={{ fontSize: 10, color: p.confidence === 'high' ? '#10b981' : p.confidence === 'medium' ? '#f59e0b' : '#ef4444' }}>
                          {p.confidence === 'high' ? '높음' : p.confidence === 'medium' ? '중간' : '낮음'}
                        </div>
                      )}
                    </div>
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

function downloadCsv(data) {
  const headers = ['이름', '나이', '성별', '생애주기', '카드', '계좌', '거래 내역', '사진', '일기', '마지막 일기']
  const rows = data.map(u => [
    u.name, u.age ?? '', u.gender === 'M' ? '남' : u.gender === 'F' ? '여' : '',
    LIFE_STAGE[u.life_stage_code] || u.life_stage_code || '',
    u.card_count, u.bank_count, u.tx_count,
    u.photo_count, u.diary_count, u.last_diary || '',
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'users.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function UserDataStats() {
  const { data, error, loading, reload } = useFetch('/admin/user-data')
  const [filter, setFilter] = useState('all')
  const [lifecycleFilter, setLifecycleFilter] = useState('ALL')
  const [sortField, setSortField] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState(null)

  // 필터/정렬이 바뀌면 첫 페이지로
  useEffect(() => { setPage(1) }, [filter, lifecycleFilter, sortField, sortDir])

  if (error) return <ErrorBox message={error} onRetry={reload} />

  const handleSort = field => {
    if (!field) return
    if (field === sortField) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  const filtered = (() => {
    if (!data) return []
    let rows = data
    if (filter === 'inactive') rows = rows.filter(u => !u.last_diary)
    else if (filter === 'no_photo') rows = rows.filter(u => u.photo_count === 0)
    if (lifecycleFilter !== 'ALL') rows = rows.filter(u => u.life_stage_code === lifecycleFilter)
    return rows
  })()

  const sortType = SORT_COLUMNS.find(c => c.field === sortField)?.type
  const sorted = sortUsers(filtered, sortField, sortDir, sortType)
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const bubbleData = filtered.map(u => ({
    x: Number(u.diary_count) || 0,
    y: Number(u.photo_count) || 0,
    z: Number(u.tx_count) || 1,
    name: u.name,
    code: u.life_stage_code,
    stage: LIFE_STAGE[u.life_stage_code] || '미분류',
  }))

  // 차트에 실제로 나타나는 생애주기만 범례로 표시
  const presentStages = LIFECYCLE_FILTERS.slice(1).filter(
    f => filtered.some(u => u.life_stage_code === f.value)
  )
  const hasUnclassified = filtered.some(u => !LIFE_STAGE[u.life_stage_code])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={styles.heading}>사용자별 데이터 현황</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['all', '전체'], ['inactive', '일기 없음'], ['no_photo', '사진 없음']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{ ...styles.filterBtn, ...(filter === v ? styles.filterActive : {}) }}>{l}</button>
          ))}
          {data && (
            <button onClick={() => downloadCsv(data)} style={styles.csvBtn}>⬇ CSV</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {LIFECYCLE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setLifecycleFilter(f.value)}
            style={lifecycleFilter === f.value ? styles.lifeBtnActive : styles.lifeBtn}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={styles.chartBox}>
        <h3 style={styles.subheading}>일기 vs 사진 (버블 크기 = 거래 내역)</h3>
        {loading ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>로딩 중...</div>
        ) : bubbleData.length === 0 ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="x" name="일기" type="number" tick={{ fontSize: 11 }} label={{ value: '일기', position: 'insideBottom', offset: -8, fontSize: 12, fill: '#888' }} />
              <YAxis dataKey="y" name="사진" type="number" tick={{ fontSize: 11 }} label={{ value: '사진', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#888' }} />
              <ZAxis dataKey="z" name="거래내역" type="number" range={[40, 600]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                return (
                  <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{d.name}</div>
                    <div style={{ color: lifecycleColor(d.code), fontWeight: 600, marginBottom: 4 }}>{d.stage}</div>
                    <div>일기: {d.x}</div>
                    <div>사진: {d.y}</div>
                    <div>거래내역: {d.z === 1 ? 0 : d.z}</div>
                  </div>
                )
              }} />
              <Scatter data={bubbleData} fillOpacity={0.75}>
                {bubbleData.map((d, i) => (
                  <Cell key={i} fill={lifecycleColor(d.code)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
        {!loading && bubbleData.length > 0 && (presentStages.length > 0 || hasUnclassified) && (
          <div style={styles.legend}>
            {presentStages.map(f => (
              <span key={f.value} style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: lifecycleColor(f.value) }} />
                {f.label}
              </span>
            ))}
            {hasUnclassified && (
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: lifecycleColor(null) }} />
                미분류
              </span>
            )}
          </div>
        )}
      </div>

      <div style={styles.tableWrap}>
        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(5)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="dash-scroll-wrap" style={{ overflowX: 'auto' }}>
          <table className="udt" style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th>번호</th>
                {SORT_COLUMNS.map(col => (
                  <th
                    key={col.label}
                    onClick={() => handleSort(col.field)}
                    style={col.field ? styles.thSortable : undefined}
                  >
                    {col.label}
                    {col.field === sortField && (
                      <span style={styles.sortArrow}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
                    )}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((u, i) => (
                <tr key={u.user_id} style={styles.tr}>
                  <td style={{ color: '#aaa', fontVariantNumeric: 'tabular-nums' }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td style={{ fontWeight: 600 }}>
                    {u.name}
                    {u.is_active === 0 && <span style={{ marginLeft: 6, fontSize: 10, background: '#fee2e2', color: '#ef4444', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>탈퇴</span>}
                  </td>
                  <td style={{ color: '#888', fontSize: 12 }}>{u.nickname || '-'}</td>
                  <td>{u.age ?? '-'}</td>
                  <td>{u.gender?.toLowerCase() === 'm' ? '남' : u.gender?.toLowerCase() === 'f' ? '여' : '-'}</td>
                  <td><span style={styles.badge}>{LIFE_STAGE[u.life_stage_code] || u.life_stage_code || '미분류'}</span></td>
                  <td style={styles.num}>{Number(u.card_count) || 0}</td>
                  <td style={styles.num}>{Number(u.bank_count) || 0}</td>
                  <td style={styles.num}>{(Number(u.tx_count) || 0).toLocaleString()}</td>
                  <td style={styles.num}>{Number(u.photo_count) || 0}</td>
                  <td style={styles.num}>{Number(u.diary_count) || 0}</td>
                  <td style={{ fontSize: 12, color: u.last_diary ? '#666' : '#ef4444' }}>
                    {u.last_diary ? u.last_diary.slice(0, 10) : '없음'}
                  </td>
                  <td>
                    <button onClick={() => setSelectedUser(u.user_id)} style={styles.detailBtn}>상세</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {!loading && totalPages > 1 && (
        <div style={styles.pagination}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={styles.pageBtn}>←</button>
          <span style={styles.pageInfo}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={styles.pageBtn}>→</button>
        </div>
      )}

      {selectedUser && (
        <UserDetailModal userId={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, margin: 0 },
  subheading: { fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#444' },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  tableWrap: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  thead: { background: '#f8f9fa' },
  tr: { borderBottom: '1px solid #f0f0f0' },
  num: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' },
  badge: { background: '#ede9fe', color: '#6c63ff', padding: '2px 8px', borderRadius: 8, fontSize: 12 },
  filterBtn: {
    padding: '5px 14px', borderRadius: 16, border: '1px solid #ddd',
    background: '#fff', cursor: 'pointer', fontSize: 13, color: '#666',
  },
  filterActive: { background: '#6c63ff', color: '#fff', border: '1px solid #6c63ff' },
  lifeBtn: {
    padding: '5px 14px', borderRadius: 20, border: '1px solid #ddd',
    background: '#fff', fontSize: 13, color: '#555', cursor: 'pointer',
  },
  lifeBtnActive: {
    padding: '5px 14px', borderRadius: 20, border: '1px solid #6c63ff',
    background: '#6c63ff', fontSize: 13, color: '#fff', cursor: 'pointer', fontWeight: 600,
  },
  thSortable: { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' },
  sortArrow: { color: '#6c63ff', fontWeight: 700 },
  pagination: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 16, marginTop: 20,
  },
  pageBtn: {
    width: 36, height: 36, borderRadius: 8, border: '1px solid #ddd',
    background: '#fff', fontSize: 16, cursor: 'pointer', color: '#444',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  pageInfo: { fontSize: 14, color: '#555', minWidth: 60, textAlign: 'center' },
  legend: {
    display: 'flex', flexWrap: 'wrap', gap: '8px 16px',
    justifyContent: 'center', marginTop: 16,
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555' },
  legendDot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  csvBtn: {
    padding: '5px 14px', borderRadius: 16, border: '1px solid #10b981',
    background: '#fff', cursor: 'pointer', fontSize: 13, color: '#10b981',
  },
  detailBtn: {
    padding: '3px 10px', borderRadius: 6, border: '1px solid #6c63ff',
    background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6c63ff',
  },
}

const ms = {
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#6c63ff', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' },
  diary: { background: '#f8f9fa', borderRadius: 8, padding: '12px 14px', marginBottom: 8 },
  txRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid #f5f5f5',
  },
  cardRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 14px', background: '#f8f9fa', borderRadius: 10, marginBottom: 8,
  },
}

if (typeof document !== 'undefined' && !document.getElementById('table-style')) {
  const s = document.createElement('style')
  s.id = 'table-style'
  s.textContent = 'table th, table td { padding: 10px 14px; text-align: left; } table.udt th, table.udt td { text-align: center; vertical-align: middle; }'
  document.head.appendChild(s)
}
