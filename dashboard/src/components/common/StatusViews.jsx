import React from 'react'

export function Skeleton({ width = '100%', height = 20, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: 6,
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  )
}

export function CardSkeleton() {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
      <Skeleton height={36} style={{ marginBottom: 8 }} />
      <Skeleton height={14} width="60%" />
    </div>
  )
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div style={{
      background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 12,
      padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontSize: 20 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: '#c53030', marginBottom: 2 }}>데이터를 불러오지 못했어요</div>
        <div style={{ fontSize: 13, color: '#742a2a' }}>{message}</div>
      </div>
      {onRetry && (
        <button onClick={onRetry} style={{
          padding: '6px 14px', background: '#e53e3e', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
        }}>재시도</button>
      )}
    </div>
  )
}

// shimmer 애니메이션 삽입
if (typeof document !== 'undefined' && !document.getElementById('skeleton-style')) {
  const style = document.createElement('style')
  style.id = 'skeleton-style'
  style.textContent = `@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`
  document.head.appendChild(style)
}
