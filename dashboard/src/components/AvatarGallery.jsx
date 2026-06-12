import React, { useEffect, useState } from 'react'
import soBee from '../assets/so-bee.png'

const LIFE_STAGE = {
  UNI: '대학생', CHILD_BABY: '영유아 자녀', NEW_WED: '신혼부부',
  SINGLE: '1인 가구', SENIOR: '시니어',
}

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

function AvatarModal({ user, onClose }) {
  const [history, setHistory] = useState(null)
  const [idx, setIdx] = useState(0)
  const [histError, setHistError] = useState(null)

  useEffect(() => {
    fetch(`/admin/user-avatars/${user.user_id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => setHistory(d))
      .catch(e => setHistError(e.message))
  }, [user.user_id])

  const current = history?.[idx]
  const total = history?.length || 0

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
        <button style={styles.close} onClick={onClose}>✕</button>

        <p style={{ color: '#666', fontSize: 13, margin: '0 0 16px' }}>
          {user.name} · {user.age}세 · {user.gender?.toLowerCase() === 'm' ? '남' : user.gender?.toLowerCase() === 'f' ? '여' : '-'} · {LIFE_STAGE[user.life_stage_code] || '미분류'}
        </p>

        {histError && <p style={{ color: 'red', fontSize: 13 }}>오류: {histError}</p>}

        {!history && !histError && <p style={{ color: '#aaa', fontSize: 13 }}>불러오는 중...</p>}

        {history && total === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>아바타 없음</p>}

        {current && (
          <>
            <button
              onClick={() => setIdx(i => i + 1)}
              disabled={idx >= total - 1}
              style={{ ...styles.arrow, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: idx >= total - 1 ? 0.3 : 1 }}
            >←</button>

            <button
              onClick={() => setIdx(i => i - 1)}
              disabled={idx <= 0}
              style={{ ...styles.arrow, position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', opacity: idx <= 0 ? 0.3 : 1 }}
            >→</button>

            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              {current.avatar_img_url ? (
                <img src={current.avatar_img_url} alt={current.avatar_name}
                  style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }}
                  onError={e => { e.target.src = soBee }} />
              ) : (
                <img src={soBee} alt="default" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }} />
              )}
              <div style={{ fontWeight: 700, fontSize: 16 }}>{current.avatar_name || '-'}</div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                {current.avatar_created_at ? current.avatar_created_at.slice(0, 10) : '-'}
              </div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>{idx + 1} / {total}</div>
            </div>

            {current.avatar_explain && (
              <p style={{ fontSize: 13, lineHeight: 1.6, color: '#444', textAlign: 'left' }}>{current.avatar_explain}</p>
            )}
          </>
        )}

        {user.top_categories?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>상위 소비 카테고리</p>
            {user.top_categories.map((c, i) => (
              <div key={i} style={styles.catRow}>
                <span>{c.category}</span>
                <span style={{ fontWeight: 700, color: '#6c63ff' }}>{c.amount.toLocaleString()}원</span>
              </div>
            ))}
          </div>
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

  if (error) return <p style={{ color: 'red', padding: 24 }}>오류: {error}</p>
  if (!data) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  const sorted = sortData(data, sortField, sortDir)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ ...styles.heading, marginBottom: 0 }}>아바타 갤러리 <span style={{ fontSize: 14, color: '#aaa', fontWeight: 400 }}>{data.length}명</span></h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

      <div style={styles.grid}>
        {sorted.map(u => (
          <div key={u.user_id} style={styles.card} onClick={() => setSelected(u)}>
            {u.avatar_img_url ? (
              <img src={u.avatar_img_url} alt={u.avatar_name} style={styles.img} onError={e => { e.target.style.display='none' }} />
            ) : (
              <img src={soBee} alt="default" style={styles.img} />
            )}
            <div style={styles.name}>{u.avatar_name || u.name}</div>
            <div style={styles.meta}>{u.name} · {u.age}세 · {u.gender?.toLowerCase() === 'm' ? '남' : u.gender?.toLowerCase() === 'f' ? '여' : '-'}</div>
            <div style={styles.badge}>{LIFE_STAGE[u.life_stage_code] || u.life_stage_code || '미분류'}</div>
          </div>
        ))}
      </div>

      {selected && <AvatarModal user={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
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
    transition: 'transform .15s',
  },
  img: { width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 10 },
  name: { fontWeight: 700, fontSize: 15, marginBottom: 4 },
  meta: { fontSize: 12, color: '#888', marginBottom: 6 },
  badge: {
    display: 'inline-block', padding: '2px 10px', borderRadius: 12,
    background: '#ede9fe', color: '#6c63ff', fontSize: 12, marginBottom: 6,
  },
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modalBox: {
    background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, width: '90%',
    position: 'relative', textAlign: 'center', maxHeight: '90vh', overflowY: 'auto',
  },
  close: {
    position: 'absolute', top: 12, right: 16, background: 'none',
    border: 'none', fontSize: 18, cursor: 'pointer', color: '#888',
  },
  arrow: {
    width: 36, height: 36, borderRadius: '50%', border: '1px solid #ddd',
    background: '#fff', fontSize: 18, cursor: 'pointer', color: '#444',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  catRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '6px 12px', background: '#f8f9fa', borderRadius: 8, marginBottom: 6, fontSize: 14,
  },
}
