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

      {selected && (
        <div style={styles.modal} onClick={() => setSelected(null)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <button style={styles.close} onClick={() => setSelected(null)}>✕</button>
            {selected.avatar_img_url && (
              <img src={selected.avatar_img_url} alt="" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', marginBottom: 12 }} />
            )}
            <h3>{selected.avatar_name || selected.name}</h3>
            <p style={{ color: '#666', fontSize: 13, margin: '4px 0 12px' }}>
              {selected.name} · {selected.age}세 · {selected.gender?.toLowerCase() === 'm' ? '남' : selected.gender?.toLowerCase() === 'f' ? '여' : '-'} · {LIFE_STAGE[selected.life_stage_code] || '미분류'}
            </p>
            {selected.avatar_explain && (
              <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12, color: '#444' }}>{selected.avatar_explain}</p>
            )}
            {selected.top_categories?.length > 0 && (
              <div>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>상위 소비 카테고리</p>
                {selected.top_categories.map((c, i) => (
                  <div key={i} style={styles.catRow}>
                    <span>{c.category}</span>
                    <span style={{ fontWeight: 700, color: '#6c63ff' }}>{c.amount.toLocaleString()}원</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
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
    transition: 'transform .15s', ':hover': { transform: 'translateY(-2px)' },
  },
  img: { width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 10 },
  placeholder: { fontSize: 48, marginBottom: 10 },
  name: { fontWeight: 700, fontSize: 15, marginBottom: 4 },
  meta: { fontSize: 12, color: '#888', marginBottom: 6 },
  badge: {
    display: 'inline-block', padding: '2px 10px', borderRadius: 12,
    background: '#ede9fe', color: '#6c63ff', fontSize: 12, marginBottom: 6,
  },
  txCount: { fontSize: 12, color: '#aaa' },
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modalBox: {
    background: '#fff', borderRadius: 16, padding: 32, maxWidth: 400, width: '90%',
    position: 'relative', textAlign: 'center',
  },
  close: {
    position: 'absolute', top: 12, right: 16, background: 'none',
    border: 'none', fontSize: 18, cursor: 'pointer', color: '#888',
  },
  catRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '6px 12px', background: '#f8f9fa', borderRadius: 8, marginBottom: 6, fontSize: 14,
  },
}
