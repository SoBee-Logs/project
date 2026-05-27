import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const NAVY = '#042C53'
const GREEN = '#1D9E75'
const BLUE = '#1A6FBF'

export default function ProductDetail() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const item = state?.item
  const [expanded, setExpanded] = useState(null)

  if (!item) {
    navigate(-1)
    return null
  }

  const { product_name, product_company, product_img_url, product_type, content } = item

  const sections = [
    content?.header && { label: product_type === 'card' ? '주요 혜택' : '금리 정보', icon: '💡', detail: content.header },
    content?.middle && { label: product_type === 'card' ? '혜택 조건' : '상품 구분', icon: '📋', detail: content.middle },
    content?.small && { label: product_type === 'card' ? '연회비' : '우대 조건', icon: '📌', detail: content.small },
  ].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#F4F7FB', fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}>

      {/* 헤더 */}
      <div style={{ padding: '16px 20px', background: '#fff', borderBottom: '1px solid #EEF1F5', flexShrink: 0 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: NAVY, padding: 0 }}
        >
          ←
        </button>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {/* 상품 헤더 배너 */}
        <div style={{
          background: 'linear-gradient(135deg, #042C53, #1A6FBF)',
          borderRadius: 18, padding: '20px',
          display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20,
        }}>
          <div style={{ width: 52, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            {product_img_url ? (
              <img src={product_img_url} alt={product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 24 }}>{product_type === 'card' ? '💳' : '🏦'}</span>
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{product_company}</p>
            <p style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800, color: '#fff', wordBreak: 'keep-all' }}>{product_name}</p>
            {content?.header && (
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{content.header}</p>
            )}
            {content?.url && (
              <a
                href={content.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  background: GREEN, border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  padding: '8px 20px', textDecoration: 'none',
                }}
              >
                신청하기
              </a>
            )}
          </div>
        </div>

        {/* 상세 섹션 */}
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: NAVY }}>상품 상세</h3>
        {sections.map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #EEF1F5', marginBottom: 8, overflow: 'hidden' }}>
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{ width: '100%', background: 'none', border: 'none', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{s.label}</span>
              </span>
              <span style={{ fontSize: 12, color: '#8494A8', display: 'inline-block', transform: expanded === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </button>
            {expanded === i && (
              <div style={{ padding: '10px 16px 14px', fontSize: 13, color: '#4A5F75', lineHeight: 1.7, borderTop: '1px solid #EEF1F5', whiteSpace: 'pre-line' }}>
                {s.detail}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
