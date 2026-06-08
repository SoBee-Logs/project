import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { ErrorBox } from './common/StatusViews'
import DrillDownModal from './common/DrillDownModal'

const COLORS = ['#6c63ff','#f857a6','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#ef4444','#64748b']

function CategoryDetail({ category, onClose }) {
  const { data, error, loading } = useFetch(`/admin/vlm-category/${encodeURIComponent(category)}`)

  return (
    <DrillDownModal title={`VLM 카테고리: ${category}`} onClose={onClose} width={720}>
      {loading && <p style={{ color: '#888' }}>불러오는 중...</p>}
      {error && <p style={{ color: '#e53e3e' }}>{error}</p>}
      {data && (
        <>
          {/* 품목 분포 */}
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

          {/* 사진 목록 */}
          <div style={ds.sectionTitle}>분석된 사진 ({data.photos.length}건)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.photos.map(p => (
              <div key={p.photo_id} style={ds.photoRow}>
                {p.url ? (
                  <img src={p.url} alt="" style={ds.thumb}
                    onError={e => { e.target.style.display = 'none' }} />
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
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: p.confidence === 'high' ? '#10b981' : p.confidence === 'medium' ? '#f59e0b' : '#ef4444',
                    }}>신뢰도 {p.confidence === 'high' ? '높음' : p.confidence === 'medium' ? '중간' : '낮음'}</div>
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

function UnprocessedModal({ onClose }) {
  const { data, error, loading } = useFetch('/admin/vlm-unprocessed')

  return (
    <DrillDownModal title="VLM 미처리 사진" onClose={onClose} width={700}>
      {loading && <p style={{ color: '#888' }}>불러오는 중...</p>}
      {error && <p style={{ color: '#e53e3e' }}>{error}</p>}
      {data && (
        <>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
            최근 업로드된 미처리 사진 {data.length}장 (최대 50건)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
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
                  <div style={{ fontSize: 11, color: '#aaa' }}>{p.created_at?.slice(0, 10)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DrillDownModal>
  )
}

export default function VlmStats() {
  const { data, error, loading, reload } = useFetch('/admin/vlm-stats')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [showUnprocessed, setShowUnprocessed] = useState(false)

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  const ages = Object.keys(data.age_items).sort((a, b) => Number(a) - Number(b))
  const successRate = data.vlm_success_rate
  const successColor = successRate >= 80 ? '#10b981' : successRate >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div>
      <h2 style={styles.heading}>VLM 분석 현황</h2>

      <div style={styles.statRow}>
        {[
          { label: 'VLM 분석 완료', value: data.total_vlm, color: '#6c63ff' },
          { label: '전체 사진', value: data.total_photos, color: '#0ea5e9' },
          { label: '결제 매핑', value: data.mapped_count, color: '#10b981' },
          { label: '매핑률', value: `${data.mapping_rate}%`, color: '#f59e0b' },
          { label: '미처리 사진', value: data.vlm_missing, color: '#ef4444', clickable: true },
          { label: '카테고리 누락', value: data.null_category_count, color: '#f857a6' },
        ].map(s => (
          <div key={s.label}
            style={{ ...styles.statCard, ...(s.clickable ? { cursor: 'pointer', border: '1px solid #fee2e2' } : {}) }}
            onClick={s.clickable ? () => setShowUnprocessed(true) : undefined}>
            <div style={{ ...styles.statVal, color: s.color }}>
              {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
            </div>
            <div style={styles.statLabel}>{s.label}</div>
            {s.clickable && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>목록 보기 →</div>}
          </div>
        ))}
      </div>

      <div style={styles.gaugeRow}>
        <div style={styles.gaugeBox}>
          <h3 style={styles.subheading}>VLM 분석 성공률</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ position: 'relative', width: 120, height: 120 }}>
              <svg viewBox="0 0 36 36" style={{ width: 120, height: 120, transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f0f0f0" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={successColor} strokeWidth="3"
                  strokeDasharray={`${successRate} ${100 - successRate}`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 20, fontWeight: 800, color: successColor }}>{successRate}%</div>
            </div>
            <div>
              <div style={{ fontSize: 14, color: '#444', marginBottom: 8 }}>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{data.total_vlm.toLocaleString()}</span>장 분석 완료
              </div>
              <div style={{ fontSize: 14, color: '#444', marginBottom: 8 }}>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>{data.vlm_missing.toLocaleString()}</span>장 미처리
              </div>
              <div style={{ fontSize: 14, color: '#444' }}>
                <span style={{ color: '#f857a6', fontWeight: 700 }}>{data.null_category_count.toLocaleString()}</span>건 카테고리 누락
              </div>
            </div>
          </div>
        </div>

        <div style={styles.gaugeBox}>
          <h3 style={styles.subheading}>유저별 VLM 처리 현황</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.per_user_vlm} margin={{ left: 0, right: 10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="analyzed" name="분석 완료" fill="#6c63ff" stackId="a" />
              <Bar dataKey="missing" name="미처리" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.charts}>
        <div style={styles.chartBox}>
          <h3 style={styles.subheading}>
            VLM 카테고리 분포 (Top 10)
            <span style={styles.clickHint}>· 막대 클릭 시 상세</span>
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.categories} layout="vertical" margin={{ left: 20, right: 20 }}
              onClick={e => e?.activePayload?.[0] && setSelectedCategory(e.activePayload[0].payload.category)}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} cursor="pointer">
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

      {selectedCategory && (
        <CategoryDetail category={selectedCategory} onClose={() => setSelectedCategory(null)} />
      )}
      {showUnprocessed && (
        <UnprocessedModal onClose={() => setShowUnprocessed(false)} />
      )}
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  subheading: { fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#444' },
  clickHint: { fontSize: 12, color: '#aaa', fontWeight: 400, marginLeft: 8 },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16, marginBottom: 20 },
  statCard: { background: '#fff', borderRadius: 12, padding: '20px 16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  statVal: { fontSize: 28, fontWeight: 800, marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#888' },
  detailLink: { fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 },
  gaugeRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  gaugeBox: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  charts: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  chartBox: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  ageGrid: { display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 280, overflowY: 'auto' },
  ageCard: { background: '#f8f9fa', borderRadius: 8, padding: 12 },
  ageBadge: { display: 'inline-block', background: '#6c63ff', color: '#fff', borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 700, marginBottom: 8 },
  itemList: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, padding: 0, margin: 0 },
  item: { fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 },
  itemName: { flex: 1, color: '#333' },
  itemCount: { fontWeight: 700, color: '#6c63ff', fontSize: 12 },
}

const ds = {
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#6c63ff', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' },
  chip: { padding: '4px 10px', borderRadius: 20, fontSize: 13 },
  photoRow: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    padding: '12px 0', borderBottom: '1px solid #f5f5f5',
  },
  thumb: { width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
}
