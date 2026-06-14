import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { ErrorBox } from './common/StatusViews'
import DrillDownModal from './common/DrillDownModal'
import { categoryColor } from '../constants/categoryColors'

const COLORS = ['#6c63ff','#f857a6','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#ef4444','#64748b','#f97316','#84cc16','#06b6d4','#a855f7','#d946ef']

const fmt = v => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : v.toLocaleString()

// ── VLM 카테고리 드릴다운 ──────────────────────────────────────────────────
function VlmCategoryDetail({ category, onClose }) {
  const { data, error, loading } = useFetch(`/admin/vlm-category/${encodeURIComponent(category)}`)
  return (
    <DrillDownModal title={`VLM 카테고리: ${category}`} onClose={onClose} width={720}>
      {loading && <p style={{ color: '#888' }}>불러오는 중...</p>}
      {error && <p style={{ color: '#e53e3e' }}>{error}</p>}
      {data && (
        <>
          {data.items.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={ds.sectionTitle}>품목 분포 Top 10</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.items.map((item, i) => (
                  <span key={i} style={{ ...ds.chip, background: COLORS[i % COLORS.length] + '20', color: COLORS[i % COLORS.length], border: `1px solid ${COLORS[i % COLORS.length]}40` }}>
                    {item.item} <strong>({item.count})</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div style={ds.sectionTitle}>분석된 사진 ({data.photos.length}건)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.photos.map(p => (
              <div key={p.photo_id} style={ds.photoRow}>
                {p.url ? (
                  <img src={p.url} alt="" style={ds.thumb} onError={e => { e.target.style.display = 'none' }} />
                ) : (
                  <div style={{ ...ds.thumb, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📷</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{p.item || '품목 미분류'}</div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 3 }}>
                    {p.store && `매장: ${p.store}`}{p.store && p.price_estimate && ' · '}
                    {p.price_estimate && `추정가: ${Number(p.price_estimate).toLocaleString()}원`}
                  </div>
                  {p.description && <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>{p.description}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: '#888' }}>{p.user}</div>
                  {p.confidence && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: p.confidence === 'high' ? '#10b981' : p.confidence === 'medium' ? '#f59e0b' : '#ef4444' }}>
                      신뢰도 {p.confidence === 'high' ? '높음' : p.confidence === 'medium' ? '중간' : '낮음'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DrillDownModal>
  )
}

// ── 미처리 사진 모달 ───────────────────────────────────────────────────────
function UnprocessedModal({ onClose }) {
  const { data, error, loading, reload } = useFetch('/admin/vlm-unprocessed')
  const [reprocessing, setReprocessing] = useState({})
  const [reprocessingAll, setReprocessingAll] = useState(false)

  const reprocess = async (photoId) => {
    setReprocessing(prev => ({ ...prev, [photoId]: true }))
    try {
      await fetch(`/admin/vlm-reprocess/${photoId}`, { method: 'POST' })
    } finally {
      setReprocessing(prev => ({ ...prev, [photoId]: false }))
      reload()
    }
  }

  const reprocessAll = async () => {
    setReprocessingAll(true)
    try {
      await fetch('/admin/vlm-reprocess-all', { method: 'POST' })
    } finally {
      setReprocessingAll(false)
      reload()
    }
  }

  return (
    <DrillDownModal title="VLM 미처리 사진" onClose={onClose} width={700}>
      {loading && <p style={{ color: '#888' }}>불러오는 중...</p>}
      {error && <p style={{ color: '#e53e3e' }}>{error}</p>}
      {data && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
              최근 업로드된 미처리 사진 {data.length}장 (최대 50건)
            </p>
            {data.length > 0 && (
              <button onClick={reprocessAll} disabled={reprocessingAll} style={btnStyle('#6c63ff', reprocessingAll)}>
                {reprocessingAll ? '처리 중...' : '전체 재처리'}
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {data.map(p => (
              <div key={p.photo_id} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #f0f0f0', background: '#fff' }}>
                {p.url ? (
                  <img src={p.url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }}
                    onError={e => { e.target.style.display = 'none' }} />
                ) : (
                  <div style={{ height: 90, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📷</div>
                )}
                <div style={{ padding: '6px 8px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{p.user}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>{p.created_at?.slice(0, 10)}</div>
                  <button
                    onClick={() => reprocess(p.photo_id)}
                    disabled={reprocessing[p.photo_id]}
                    style={btnStyle('#ef4444', reprocessing[p.photo_id], true)}
                  >
                    {reprocessing[p.photo_id] ? '...' : '재처리'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DrillDownModal>
  )
}

function btnStyle(color, disabled, small = false) {
  return {
    padding: small ? '3px 10px' : '5px 14px',
    borderRadius: 16,
    border: `1px solid ${disabled ? '#ccc' : color}`,
    background: disabled ? '#f5f5f5' : color,
    color: disabled ? '#aaa' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: small ? 11 : 13,
    fontWeight: 600,
    width: small ? '100%' : undefined,
  }
}

// ── 소비 트렌드 드릴다운 ──────────────────────────────────────────────────
function SpendingCategoryDetail({ category, onClose }) {
  const { data, error, loading } = useFetch(`/admin/spending-detail/${encodeURIComponent(category)}`)
  return (
    <DrillDownModal title={`카테고리 상세: ${category}`} onClose={onClose} width={700}>
      {loading && <p style={{ color: '#888' }}>불러오는 중...</p>}
      {error && <p style={{ color: '#e53e3e' }}>{error}</p>}
      {data && (
        <>
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

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
function WeekItems({ weekItems }) {
  const months = [...new Set(Object.keys(weekItems).map(k => k.slice(0, 7)))].sort()
  const [monthIdx, setMonthIdx] = useState(months.length - 1)
  const currentMonth = months[monthIdx]
  const weeks = Object.keys(weekItems).filter(k => k.startsWith(currentMonth)).sort()

  return (
    <div style={styles.chartBox}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ ...styles.subheading, margin: 0 }}>주차별 자주 등장한 품목</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setMonthIdx(i => i - 1)} disabled={monthIdx === 0}
            style={navBtn(monthIdx === 0)}>{'<'}</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#444', minWidth: 70, textAlign: 'center' }}>{currentMonth}</span>
          <button onClick={() => setMonthIdx(i => i + 1)} disabled={monthIdx === months.length - 1}
            style={navBtn(monthIdx === months.length - 1)}>{'>'}</button>
        </div>
      </div>
      <div style={styles.ageGrid}>
        {weeks.map(week => (
          <div key={week} style={styles.ageCard}>
            <div style={{ ...styles.ageBadge, background: '#f857a6' }}>{week.slice(8)}</div>
            <ul style={styles.itemList}>
              {weekItems[week].map((item, i) => (
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
  )
}

const navBtn = disabled => ({
  padding: '2px 10px', borderRadius: 6, border: '1px solid #ddd',
  background: disabled ? '#f5f5f5' : '#fff', color: disabled ? '#ccc' : '#444',
  cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700,
})

export default function VlmStats() {
  const { data: vlm, error: vlmErr, loading: vlmLoading, reload: vlmReload } = useFetch('/admin/vlm-stats')
  const { data: spending, error: spendingErr, loading: spendingLoading, reload: spendingReload } = useFetch('/admin/spending')
  const [selectedVlmCategory, setSelectedVlmCategory] = useState(null)
  const [selectedSpendingCategory, setSelectedSpendingCategory] = useState(null)
  const [showUnprocessed, setShowUnprocessed] = useState(false)
  const [spendingView, setSpendingView] = useState('count')

  if (vlmErr) return <ErrorBox message={vlmErr} onRetry={vlmReload} />
  if (spendingErr) return <ErrorBox message={spendingErr} onRetry={spendingReload} />
  if (vlmLoading || spendingLoading) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  const catData = spending.categories.map(c => ({
    name: c.category?.trim() || '기타',
    건수: c.count, 금액: c.total,
    _category: c.category,
  }))

  return (
    <div>
      {/* ── VLM 분석 ── */}
      <h2 style={styles.heading}>VLM 분석</h2>

      <div style={styles.statRow}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statVal, color: '#0ea5e9' }}>{vlm.total_photos.toLocaleString()}</div>
          <div style={styles.statLabel}>전체 사진</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statVal, color: '#6c63ff' }}>{vlm.total_vlm.toLocaleString()}</div>
          <div style={styles.statLabel}>VLM 분석 완료</div>
        </div>
        <div
          style={{ ...styles.statCard, cursor: 'pointer', border: '1px solid #fee2e2' }}
          onClick={() => setShowUnprocessed(true)}
        >
          <div style={{ ...styles.statVal, color: '#ef4444' }}>{vlm.vlm_missing.toLocaleString()}</div>
          <div style={styles.statLabel}>미처리 사진</div>
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>목록 보기 →</div>
        </div>
      </div>

      <div style={styles.charts}>
        <div style={styles.chartBox}>
          <h3 style={styles.subheading}>
            VLM 카테고리 분포
            <span style={styles.clickHint}>· 막대 클릭 시 상세</span>
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={vlm.categories} layout="vertical" margin={{ left: 20, right: 20 }}
              onClick={e => e?.activePayload?.[0] && setSelectedVlmCategory(e.activePayload[0].payload.category)}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} cursor="pointer">
                {vlm.categories.map((c, i) => <Cell key={i} fill={categoryColor(c.category, i)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <h3 style={styles.subheading}>
              거래 카테고리
              <span style={styles.clickHint}>· 막대 클릭 시 상세</span>
            </h3>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <div style={styles.toggle}>
                <button style={{ ...styles.btn, ...(spendingView === 'count' ? styles.active : {}) }} onClick={() => setSpendingView('count')}>건수</button>
                <button style={{ ...styles.btn, ...(spendingView === 'total' ? styles.active : {}) }} onClick={() => setSpendingView('total')}>금액</button>
              </div>
              <button onClick={() => downloadSpendingCsv(spending.categories)} style={styles.csvBtn}>⬇ CSV</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={catData} layout="vertical" margin={{ left: 30, right: 30 }}
              onClick={e => e?.activePayload?.[0] && setSelectedSpendingCategory(e.activePayload[0].payload._category)}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={spendingView === 'total' ? fmt : undefined} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
              <Tooltip formatter={v => spendingView === 'total' ? `${v.toLocaleString()}원` : `${v}건`} />
              <Bar dataKey={spendingView === 'count' ? '건수' : '금액'} radius={[0, 4, 4, 0]} cursor="pointer">
                {catData.map((c, i) => <Cell key={i} fill={categoryColor(c.name, i)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ ...styles.charts, marginTop: 16 }}>
        <div style={styles.chartBox}>
          <h3 style={{ ...styles.subheading, marginBottom: 16 }}>나이대별 자주 등장한 품목</h3>
          <div style={styles.ageGrid}>
            {Object.keys(vlm.age_items).sort().map(age => (
              <div key={age} style={styles.ageCard}>
                <div style={styles.ageBadge}>{age}</div>
                <ul style={styles.itemList}>
                  {vlm.age_items[age].map((item, i) => (
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

        {Object.keys(vlm.week_items || {}).length > 0 && (
          <WeekItems weekItems={vlm.week_items} />
        )}
      </div>


      {selectedVlmCategory && (
        <VlmCategoryDetail category={selectedVlmCategory} onClose={() => setSelectedVlmCategory(null)} />
      )}
      {selectedSpendingCategory && (
        <SpendingCategoryDetail category={selectedSpendingCategory} onClose={() => setSelectedSpendingCategory(null)} />
      )}
      {showUnprocessed && (
        <UnprocessedModal onClose={() => setShowUnprocessed(false)} />
      )}
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  subheading: { fontSize: 15, fontWeight: 600, color: '#444', margin: 0 },
  clickHint: { fontSize: 12, color: '#aaa', fontWeight: 400, marginLeft: 8 },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16, marginBottom: 20 },
  statCard: { background: '#fff', borderRadius: 12, padding: '20px 16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  statVal: { fontSize: 28, fontWeight: 800, marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#888' },
  charts: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  ageGrid: { display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 280, overflowY: 'auto' },
  ageCard: { background: '#f8f9fa', borderRadius: 8, padding: 12 },
  ageBadge: { display: 'inline-block', background: '#6c63ff', color: '#fff', borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 700, marginBottom: 8 },
  itemList: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, padding: 0, margin: 0 },
  item: { fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 },
  itemName: { flex: 1, color: '#333' },
  itemCount: { fontWeight: 700, color: '#6c63ff', fontSize: 12 },
  section: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  toggle: { display: 'flex', gap: 4 },
  btn: { padding: '4px 14px', borderRadius: 16, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#666' },
  active: { background: '#6c63ff', color: '#fff', border: '1px solid #6c63ff' },
  csvBtn: { padding: '4px 12px', borderRadius: 16, border: '1px solid #10b981', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#10b981' },
}

const ds = {
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#6c63ff', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' },
  chip: { padding: '4px 10px', borderRadius: 20, fontSize: 13 },
  photoRow: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid #f5f5f5' },
  thumb: { width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
  userRow: { display: 'flex', alignItems: 'center', gap: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  thead: { background: '#f8f9fa' },
  tr: { borderBottom: '1px solid #f0f0f0' },
}
