import React, { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { ErrorBox } from './common/StatusViews'
import DrillDownModal from './common/DrillDownModal'

const COLORS = ['#6c63ff','#f857a6','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#ef4444','#64748b','#f97316','#84cc16','#06b6d4','#a855f7','#d946ef']

// ── 사진 + 매핑 내역 행 ────────────────────────────────────────────────────
function MappingRow({ t, kind }) {
  // kind: 'moved' | 'remaining'
  const fromLabel = '기타·금융·미분류'
  const toLabel = kind === 'moved' ? t.new_category : t.current_category
  return (
    <div style={ds.photoRow}>
      {t.image_url ? (
        <img src={t.image_url} alt="" style={ds.thumb} onError={e => { e.target.style.display = 'none' }} />
      ) : (
        <div style={{ ...ds.thumb, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📷</div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t.place || '가맹점 미상'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={ds.fromBadge}>{fromLabel}</span>
          <span style={{ color: '#aaa' }}>→</span>
          <span style={kind === 'moved' ? ds.newBadge : ds.stayBadge}>{toLabel || '미분류'}</span>
          {t.vlm_category && (
            <span style={ds.vlmBadge}>VLM: {t.vlm_category}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>
          {t.user} · {t.date?.slice(0, 10)}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, fontWeight: 700, color: '#6c63ff' }}>
        {t.amount.toLocaleString()}원
      </div>
    </div>
  )
}

function DetailModal({ title, items, kind, onClose }) {
  return (
    <DrillDownModal title={title} onClose={onClose} width={720}>
      {items.length === 0 ? (
        <p style={{ color: '#888' }}>해당하는 거래가 없습니다.</p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>
            최근 {items.length}건 (최대 200건)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map(t => <MappingRow key={t.payment_id} t={t} kind={kind} />)}
          </div>
        </>
      )}
    </DrillDownModal>
  )
}

export default function CategoryOverrides() {
  const { data, error, loading, reload } = useFetch('/admin/category-overrides')
  const [modal, setModal] = useState(null) // 'moved' | 'remaining'

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  return (
    <div>
      <h2 style={styles.heading}>카테고리 보정 내역</h2>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
        결제 카테고리가 <strong>기타 · 금융 · 미분류(NULL)</strong> 였던 거래를 VLM 사진 분석으로 보정한 결과입니다.
        카드를 누르면 사진과 매핑 내역을 볼 수 있습니다.
      </p>

      <div style={styles.statRow}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statVal, color: '#64748b' }}>{data.before_count.toLocaleString()}</div>
          <div style={styles.statLabel}>보정 전 기타·금융·미분류 (전체)</div>
        </div>
        <div
          style={{ ...styles.statCard, ...styles.clickable }}
          onClick={() => setModal('remaining')}
        >
          <div style={{ ...styles.statVal, color: '#ef4444' }}>{data.after_count.toLocaleString()}</div>
          <div style={styles.statLabel}>아직 기타·금융·미분류인 거래</div>
          <div style={styles.viewHint}>사진·매핑 보기 →</div>
        </div>
        <div
          style={{ ...styles.statCard, ...styles.clickable }}
          onClick={() => setModal('moved')}
        >
          <div style={{ ...styles.statVal, color: '#6c63ff' }}>{data.total.toLocaleString()}</div>
          <div style={styles.statLabel}>변경된 거래 목록</div>
          <div style={styles.viewHint}>사진·매핑 보기 →</div>
        </div>
      </div>

      {data.by_category.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.subheading}>변경 후 카테고리별 분포</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.by_category.map((c, i) => (
              <span key={i} style={{ ...styles.chip, background: COLORS[i % COLORS.length] + '20', color: COLORS[i % COLORS.length], border: `1px solid ${COLORS[i % COLORS.length]}40` }}>
                {c.category} <strong>({c.count})</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={styles.section}>
        <h3 style={styles.subheading}>보정 거래 목록 (최근 {data.items.length}건)</h3>
        {data.items.length === 0 ? (
          <p style={{ color: '#888', fontSize: 14 }}>보정된 거래가 없습니다.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={{ textAlign: 'left' }}>날짜</th>
                <th style={{ textAlign: 'left' }}>가맹점</th>
                <th style={{ textAlign: 'left' }}>사용자</th>
                <th style={{ textAlign: 'left' }}>VLM 분석</th>
                <th style={{ textAlign: 'left' }}>변경된 카테고리</th>
                <th style={{ textAlign: 'right' }}>금액</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t.payment_id} style={styles.tr}>
                  <td style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>{t.date?.slice(0, 10)}</td>
                  <td style={{ fontWeight: 500 }}>{t.place || '-'}</td>
                  <td style={{ color: '#666', fontSize: 13 }}>{t.user}</td>
                  <td>
                    {t.vlm_category
                      ? <span style={styles.vlmBadge}>{t.vlm_category}</span>
                      : <span style={{ color: '#ccc' }}>-</span>}
                  </td>
                  <td><span style={styles.newBadge}>{t.new_category || '-'}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#6c63ff' }}>{t.amount.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal === 'moved' && (
        <DetailModal
          title="다른 카테고리로 보정된 거래"
          items={data.items}
          kind="moved"
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'remaining' && (
        <DetailModal
          title="아직 기타·금융·미분류인 거래"
          items={data.remaining_items}
          kind="remaining"
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  subheading: { fontSize: 15, fontWeight: 600, color: '#444', marginBottom: 16 },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 20 },
  statCard: { background: '#fff', borderRadius: 12, padding: '20px 16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  clickable: { cursor: 'pointer', border: '1px solid #eee', transition: 'box-shadow .15s' },
  statVal: { fontSize: 28, fontWeight: 800, marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#888' },
  viewHint: { fontSize: 11, color: '#6c63ff', marginTop: 6 },
  section: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  chip: { padding: '4px 10px', borderRadius: 20, fontSize: 13 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  thead: { background: '#f8f9fa', textAlign: 'left' },
  tr: { borderBottom: '1px solid #f0f0f0' },
  vlmBadge: { display: 'inline-block', background: '#0ea5e920', color: '#0ea5e9', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 },
  newBadge: { display: 'inline-block', background: '#10b98120', color: '#10b981', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 700 },
}

const ds = {
  photoRow: { display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f5f5f5' },
  thumb: { width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
  fromBadge: { display: 'inline-block', background: '#f1f5f9', color: '#64748b', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 },
  newBadge: { display: 'inline-block', background: '#10b98120', color: '#10b981', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 700 },
  stayBadge: { display: 'inline-block', background: '#ef444420', color: '#ef4444', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 700 },
  vlmBadge: { display: 'inline-block', background: '#0ea5e920', color: '#0ea5e9', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 },
}
