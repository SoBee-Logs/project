import React, { useEffect } from 'react'

export default function DrillDownModal({ title, onClose, children, width = 600 }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.box, maxWidth: width }} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={s.title}>{title}</h3>
          <button style={s.close} onClick={onClose}>✕</button>
        </div>
        <div style={s.body}>{children}</div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  },
  box: {
    background: '#fff', borderRadius: 16, width: '92%',
    maxHeight: '88vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,.2)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: '1px solid #f0f0f0', flexShrink: 0,
  },
  title: { margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1a2e' },
  close: {
    background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
    color: '#999', lineHeight: 1, padding: '0 4px',
  },
  body: { overflowY: 'auto', padding: '20px 24px', flex: 1 },
}
