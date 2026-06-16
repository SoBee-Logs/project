import React, { useEffect, useState } from 'react'
import soBee from '../assets/so-bee.png'
import { categoryColor } from '../constants/categoryColors'

const LIFE_STAGE = {
  TEEN: '십대', UNI: '대학생', NEW_JOB: '사회초년생', NEW_WED: '신혼',
  CHILD_BABY: '자녀영유아', CHILD_TEEN: '자녀의무교육', CHILD_UNI: '자녀대학생',
  GOLLIFE: '중년기타', SECLIFE: '2nd Life', RETIR: '은퇴',
}

const LIFECYCLE_FILTERS = [
  { value: 'ALL', label: '전체' },
  ...Object.entries(LIFE_STAGE).map(([code, label]) => ({ value: code, label })),
]

const FAVORITES = new Set([13, 114, 115, 116, 119, 17])
const PAGE_SIZE = 12

const SORT_OPTIONS = [
  { value: 'avatar_created_at', label: '아바타 생성일' },
  { value: 'user_created_at',   label: '가입일' },
  { value: 'persona_tx',        label: '이용 횟수' },
  { value: 'age',               label: '나이' },
  { value: 'name',              label: '이름' },
]

function sortData(data, field, dir) {
  const d = [...data]
  const asc = dir === 'asc'
  switch (field) {
    case 'avatar_created_at': return d.sort((a, b) => asc
      ? (a.avatar_created_at || '') > (b.avatar_created_at || '') ? 1 : -1
      : (b.avatar_created_at || '') > (a.avatar_created_at || '') ? 1 : -1)
    case 'user_created_at': return d.sort((a, b) => asc
      ? (a.user_created_at || '') > (b.user_created_at || '') ? 1 : -1
      : (b.user_created_at || '') > (a.user_created_at || '') ? 1 : -1)
    case 'persona_tx': return d.sort((a, b) => asc
      ? (a.persona_tx_count || 0) - (b.persona_tx_count || 0)
      : (b.persona_tx_count || 0) - (a.persona_tx_count || 0))
    case 'age': return d.sort((a, b) => asc
      ? (a.age || 0) - (b.age || 0)
      : (b.age || 0) - (a.age || 0))
    case 'name': return d.sort((a, b) => asc
      ? (a.name || '').localeCompare(b.name || '', 'ko')
      : (b.name || '').localeCompare(a.name || '', 'ko'))
    default: return d
  }
}

function applyFavorites(sorted) {
  const favs = sorted.filter(u => FAVORITES.has(u.user_id))
  const rest = sorted.filter(u => !FAVORITES.has(u.user_id))
  return [...favs, ...rest]
}

function Bar({ label, value, max, color, suffix, highlight }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div style={ds.barRow}>
      <div style={{ ...ds.barLabel, fontWeight: highlight ? 700 : 400, color: highlight ? '#222' : '#666' }}>{label}</div>
      <div style={ds.barTrack}>
        <div style={{ ...ds.barFill, width: `${pct}%`, background: color }} />
      </div>
      <div style={ds.barVal}>{value.toLocaleString()}{suffix || ''}</div>
    </div>
  )
}

function PhotoStrip({ photos, caption }) {
  if (!photos.length) return <p style={ds.empty}>해당 사진 없음</p>
  return (
    <div style={ds.photoStrip}>
      {photos.map(p => (
        <div key={p.photo_id} style={{ flexShrink: 0, width: 84 }}>
          <img src={p.url} alt="" style={ds.photoThumb} onError={e => { e.target.style.visibility = 'hidden' }} />
          <div style={ds.photoCap}>{caption(p)}</div>
        </div>
      ))}
    </div>
  )
}

function Section({ icon, title, hint, children }) {
  return (
    <div style={ds.section}>
      <div style={ds.sectionHead}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={ds.sectionTitle}>{title}</span>
        {hint && <span style={ds.sectionHint}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function _addDays(dateStr, n) {
  const dt = new Date(dateStr)
  dt.setDate(dt.getDate() + n)
  return dt.toISOString().slice(0, 10)
}

function AvatarModal({ user, onClose }) {
  const [history, setHistory] = useState(null)
  const [idx, setIdx] = useState(0)
  const [histErr, setHistErr] = useState(null)
  const [d, setD] = useState(null)
  const [detErr, setDetErr] = useState(null)

  useEffect(() => {
    fetch(`/admin/user-avatars/${user.user_id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(h => { setHistory(h); setIdx(0) })
      .catch(e => setHistErr(e.message))
  }, [user.user_id])

  const current = history?.[idx]
  const total = history?.length || 0

  useEffect(() => {
    const created = current?.avatar_created_at
    if (!created) { setD(null); return }
    const start = created.slice(0, 10)
    const end = _addDays(start, 6)
    setD(null); setDetErr(null)
    fetch(`/admin/avatar-detail/${user.user_id}?start=${start}&end=${end}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setD)
      .catch(e => setDetErr(e.message))
  }, [current?.avatar_created_at, user.user_id])

  const genderKo = user.gender?.toLowerCase() === 'm' ? '남' : user.gender?.toLowerCase() === 'f' ? '여' : '-'

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
        <button style={styles.close} onClick={onClose}>✕</button>

        {histErr && <p style={{ color: 'red', fontSize: 13 }}>오류: {histErr}</p>}
        {!history && !histErr && <p style={{ color: '#aaa', fontSize: 13 }}>불러오는 중...</p>}
        {history && total === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>아바타 없음</p>}

        {current && (
          <>
            <div style={{ position: 'relative', textAlign: 'center', marginBottom: 8 }}>
              {total > 1 && (
                <>
                  <button onClick={() => setIdx(i => Math.min(total - 1, i + 1))} disabled={idx >= total - 1}
                    style={{ ...styles.arrow, position: 'absolute', left: 0, top: 44, opacity: idx >= total - 1 ? 0.3 : 1 }}>← 이전</button>
                  <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx <= 0}
                    style={{ ...styles.arrow, position: 'absolute', right: 0, top: 44, opacity: idx <= 0 ? 0.3 : 1 }}>다음 →</button>
                </>
              )}
              <img src={current.avatar_img_url || soBee} alt={current.avatar_name}
                style={{ width: 130, height: 130, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }}
                onError={e => { e.target.src = soBee }} />
              <div style={{ fontWeight: 800, fontSize: 18 }}>{current.avatar_name || '-'}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                {user.name} · {user.age}세 · {genderKo} · {LIFE_STAGE[user.life_stage_code] || '미분류'}
              </div>
              <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>
                {current.avatar_created_at
                  ? `${current.avatar_created_at.slice(0, 10)} ~ ${_addDays(current.avatar_created_at.slice(0, 10), 6)}`
                  : '-'}
                {total > 1 && <span style={{ marginLeft: 8, color: '#ccc' }}>총 {total}개</span>}
              </div>
            </div>
            {current.avatar_explain && <p style={ds.explain}>{current.avatar_explain}</p>}

            {detErr && <p style={{ color: 'red', fontSize: 13 }}>근거 로드 오류: {detErr}</p>}
            {!d && !detErr && <p style={ds.empty}>근거 데이터 불러오는 중...</p>}
            {d && d.evidence.total_tx === 0 && (
              <p style={ds.empty}>이 주차에 결제·사진 데이터가 없어 근거를 표시할 수 없습니다.</p>
            )}
            {d && d.evidence.total_tx > 0 && (() => {
              const ev = d.evidence
              const catMax = Math.max(1, ...ev.category_spend.map(c => c.amount))
              const slotMax = Math.max(1, ...ev.time_distribution.map(s => s.count))
              const emoMax = Math.max(1, ...ev.emotion_distribution.map(e => e.count))
              const emotionPhotos = ev.photos.filter(p => p.emotion).slice(0, 8)
              const itemPhotos = ev.photos.filter(p => p.vlm_item_name).slice(0, 8)
              return (
                <>
                  <Section icon="😀" title="표정" hint="사진 감정 기반">
                    {d.persona.top_emotion && (
                      <div style={ds.bigPick}>
                        <span style={{ fontSize: 24 }}>{d.persona.top_emotion.emoji}</span>
                        <span style={{ fontWeight: 700 }}>{d.persona.top_emotion.ko}</span>
                        <span style={{ color: '#aaa', fontSize: 12 }}>대표 감정</span>
                      </div>
                    )}
                    {ev.emotion_distribution.map(e => (
                      <Bar key={e.name} label={`${e.emoji} ${e.ko}`} value={e.count} max={emoMax}
                        color="#f59e0b" suffix="건" highlight={d.persona.top_emotion?.name === e.name} />
                    ))}
                    <PhotoStrip photos={emotionPhotos} caption={p => p.emotion_emoji || ''} />
                  </Section>

                  <Section icon="🛍️" title="소품 (들고 있는 것)" hint="VLM 분석 아이템">
                    <div style={ds.chipRow}>
                      {d.persona.top_items.map((it, i) => <span key={i} style={ds.chipPurple}>{it}</span>)}
                    </div>
                    <PhotoStrip photos={itemPhotos} caption={p => p.vlm_item_name} />
                  </Section>

                  <Section icon="👕" title="옷·라이프스타일" hint={`주 소비: ${d.persona.top_category}`}>
                    {ev.category_spend.slice(0, 6).map(c => (
                      <Bar key={c.category} label={c.category} value={c.amount} max={catMax}
                        color={categoryColor(c.category)} suffix="원" highlight={c.category === d.persona.top_category} />
                    ))}
                    {ev.category_transactions.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={ds.subLabel}>{d.persona.top_category} 실제 결제내역</div>
                        {ev.category_transactions.slice(0, 8).map((t, i) => (
                          <div key={i} style={ds.txRow}>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.place}</span>
                            <span style={{ color: '#aaa', fontSize: 12 }}>{t.date?.slice(5)}</span>
                            <span style={{ fontWeight: 700, color: '#6c63ff', minWidth: 72, textAlign: 'right' }}>{t.amount.toLocaleString()}원</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Section>

                  <Section icon="🌃" title="배경 (활동 시간대)" hint={`주 활동: ${d.persona.dominant_slot} ${d.persona.dominant_slot_emoji}`}>
                    {ev.time_distribution.map(s => (
                      <Bar key={s.slot} label={`${s.emoji} ${s.slot}`} value={s.count} max={slotMax}
                        color="#0ea5e9" suffix="건" highlight={s.slot === d.persona.dominant_slot} />
                    ))}
                  </Section>

                  <Section icon="🐝" title="페르소나">
                    <div style={ds.subLabel}>생애주기</div>
                    <p style={ds.vibe}>{d.life_stage.label} — {d.life_stage.vibe}</p>
                    {ev.top_places.length > 0 && (
                      <>
                        <div style={ds.subLabel}>자주 방문 가맹점</div>
                        <div style={ds.chipRow}>
                          {ev.top_places.map((p, i) => <span key={i} style={ds.chip}>{p.place} ({p.count})</span>)}
                        </div>
                      </>
                    )}
                    <div style={ds.statRow}>
                      <span>총 결제 <strong>{ev.total_tx}</strong>건</span>
                      <span>총 소비 <strong>{ev.total_spend.toLocaleString()}</strong>원</span>
                    </div>
                  </Section>
                </>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}

export default function AvatarGallery() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [sortField, setSortField] = useState('avatar_created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [lifecycleFilter, setLifecycleFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/admin/avatars')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => {
        if (!Array.isArray(d)) throw new Error('응답이 배열이 아님: ' + JSON.stringify(d))
        const unique = Object.values(
          d.reduce((acc, item) => {
            if (!acc[item.user_id] || item.avatar_created_at > acc[item.user_id].avatar_created_at)
              acc[item.user_id] = item
            return acc
          }, {})
        )
        setData(unique)
      })
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => { setPage(1) }, [sortField, sortDir, lifecycleFilter])

  if (error) return <p style={{ color: 'red', padding: 24 }}>오류: {error}</p>
  if (!data) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  const filtered = lifecycleFilter === 'ALL' ? data : data.filter(u => u.life_stage_code === lifecycleFilter)
  const sorted = applyFavorites(sortData(filtered, sortField, sortDir))
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ ...styles.heading, marginBottom: 0 }}>
          아바타 갤러리 <span style={{ fontSize: 14, color: '#aaa', fontWeight: 400 }}>{filtered.length}명</span>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select value={sortField} onChange={e => setSortField(e.target.value)} style={styles.select}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            style={styles.dirBtn}
            title={sortDir === 'desc' ? '내림차순' : '오름차순'}
          >
            {sortDir === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {LIFECYCLE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setLifecycleFilter(f.value)}
            style={lifecycleFilter === f.value ? styles.filterBtnActive : styles.filterBtn}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={styles.grid}>
        {paginated.map(u => {
          const isFav = FAVORITES.has(u.user_id)
          return (
            <div key={u.user_id} style={{ ...styles.card, ...(isFav ? styles.favCard : {}) }} onClick={() => setSelected(u)}>
              {isFav && <span style={styles.favBadge}>★</span>}
              {u.avatar_img_url ? (
                <img src={u.avatar_img_url} alt={u.avatar_name} style={styles.img} onError={e => { e.target.style.display='none' }} />
              ) : (
                <img src={soBee} alt="default" style={styles.img} />
              )}
              <div style={styles.name}>{u.avatar_name || u.name}</div>
              <div style={styles.meta}>{u.name} · {u.age}세 · {u.gender?.toLowerCase() === 'm' ? '남' : u.gender?.toLowerCase() === 'f' ? '여' : '-'}</div>
              <div style={styles.badge}>{LIFE_STAGE[u.life_stage_code] || u.life_stage_code || '미분류'}</div>
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={styles.pageBtn}>←</button>
          <span style={styles.pageInfo}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={styles.pageBtn}>→</button>
        </div>
      )}

      {selected && <AvatarModal user={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  filterBtn: {
    padding: '5px 14px', borderRadius: 20, border: '1px solid #ddd',
    background: '#fff', fontSize: 13, color: '#555', cursor: 'pointer',
  },
  filterBtnActive: {
    padding: '5px 14px', borderRadius: 20, border: '1px solid #6c63ff',
    background: '#6c63ff', fontSize: 13, color: '#fff', cursor: 'pointer', fontWeight: 600,
  },
  select: {
    padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd',
    fontSize: 13, color: '#444', cursor: 'pointer', background: '#fff',
  },
  dirBtn: {
    width: 34, height: 34, borderRadius: 8, border: '1px solid #ddd',
    background: '#fff', fontSize: 16, cursor: 'pointer', color: '#444',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  card: {
    background: '#fff', borderRadius: 12, padding: 20, textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,.06)', cursor: 'pointer',
    transition: 'transform .15s', position: 'relative',
  },
  favCard: {
    border: '2px solid #f59e0b',
    boxShadow: '0 2px 12px rgba(245,158,11,.2)',
  },
  favBadge: {
    position: 'absolute', top: 10, right: 12,
    fontSize: 14, color: '#f59e0b',
  },
  img: { width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 10 },
  name: { fontWeight: 700, fontSize: 15, marginBottom: 4 },
  meta: { fontSize: 12, color: '#888', marginBottom: 6 },
  badge: {
    display: 'inline-block', padding: '2px 10px', borderRadius: 12,
    background: '#ede9fe', color: '#6c63ff', fontSize: 12, marginBottom: 6,
  },
  pagination: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 16, marginTop: 28,
  },
  pageBtn: {
    width: 36, height: 36, borderRadius: 8, border: '1px solid #ddd',
    background: '#fff', fontSize: 16, cursor: 'pointer', color: '#444',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  pageInfo: { fontSize: 14, color: '#555', minWidth: 60, textAlign: 'center' },
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modalBox: {
    background: '#fff', borderRadius: 16, padding: 32, maxWidth: 680, width: '92%',
    position: 'relative', textAlign: 'left', maxHeight: '90vh', overflowY: 'auto',
  },
  close: {
    position: 'absolute', top: 12, right: 16, background: 'none',
    border: 'none', fontSize: 18, cursor: 'pointer', color: '#888',
  },
  arrow: {
    padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd',
    background: '#fff', fontSize: 12, cursor: 'pointer', color: '#555',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  catRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '6px 12px', background: '#f8f9fa', borderRadius: 8, marginBottom: 6, fontSize: 14,
  },
}

const ds = {
  explain: { fontSize: 13, lineHeight: 1.6, color: '#444', background: '#f8f9fa', borderRadius: 10, padding: '12px 14px', margin: '0 0 16px' },
  empty: { fontSize: 13, color: '#aaa', padding: '8px 0' },
  section: { borderTop: '1px solid #f0f0f0', padding: '16px 0' },
  sectionHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontWeight: 700, fontSize: 15 },
  sectionHint: { marginLeft: 'auto', fontSize: 12, color: '#999' },
  bigPick: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  barRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 },
  barLabel: { width: 96, fontSize: 12, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  barTrack: { flex: 1, height: 14, background: '#f1f3f5', borderRadius: 7, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 7 },
  barVal: { width: 78, textAlign: 'right', fontSize: 12, color: '#555', flexShrink: 0 },
  photoStrip: { display: 'flex', gap: 8, overflowX: 'auto', marginTop: 10, paddingBottom: 4 },
  photoThumb: { width: 84, height: 84, borderRadius: 8, objectFit: 'cover', background: '#f0f0f0' },
  photoCap: { fontSize: 11, color: '#666', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { padding: '3px 10px', borderRadius: 14, background: '#f1f3f5', color: '#555', fontSize: 12 },
  chipPurple: { padding: '3px 10px', borderRadius: 14, background: '#ede9fe', color: '#6c63ff', fontSize: 12, fontWeight: 600 },
  subLabel: { fontSize: 12, fontWeight: 600, color: '#888', margin: '10px 0 6px' },
  txRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 },
  vibe: { fontSize: 13, color: '#555', lineHeight: 1.6, margin: '0 0 4px' },
  statRow: { display: 'flex', gap: 20, marginTop: 12, fontSize: 13, color: '#555' },
}
