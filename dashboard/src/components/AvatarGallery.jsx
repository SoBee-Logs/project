import React, { useEffect, useState } from 'react'

const LIFE_STAGE = {
  UNI: '대학생', CHILD_BABY: '영유아 자녀', NEW_WED: '신혼부부',
  SINGLE: '1인 가구', SENIOR: '시니어',
}

export default function AvatarGallery() {
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch('/admin/avatars').then(r => r.json()).then(d => {
      const unique = Object.values(
        d.reduce((acc, item) => {
          if (!acc[item.user_id] || item.avatar_created_at > acc[item.user_id].avatar_created_at)
            acc[item.user_id] = item
          return acc
        }, {})
      )
      setData(unique)
    })
  }, [])

  if (!data) return <p style={{ color: '#888', padding: 24 }}>불러오는 중...</p>

  return (
    <div>
      <h2 style={styles.heading}>아바타 갤러리</h2>
      <div style={styles.grid}>
        {data.map(u => (
          <div key={u.user_id} style={styles.card} onClick={() => setSelected(u)}>
            {u.avatar_img_url ? (
              <img src={u.avatar_img_url} alt={u.avatar_name} style={styles.img} onError={e => { e.target.style.display='none' }} />
            ) : (
              <div style={styles.placeholder}>🧬</div>
            )}
            <div style={styles.name}>{u.avatar_name || u.name}</div>
            <div style={styles.meta}>{u.name} · {u.age}세 · {u.gender?.toLowerCase() === 'm' ? '남' : u.gender?.toLowerCase() === 'f' ? '여' : '-'}</div>
            <div style={styles.badge}>{LIFE_STAGE[u.life_stage_code] || u.life_stage_code || '미분류'}</div>
            <div style={styles.txCount}>persona 거래 {u.persona_tx_count}건</div>
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
