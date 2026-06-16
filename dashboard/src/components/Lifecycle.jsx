import React, { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { ErrorBox, CardSkeleton } from './common/StatusViews'

const COLORS = ['#6c63ff', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#64748b', '#f97316', '#8b5cf6', '#14b8a6', '#e11d48']

function StagePanel({ stage }) {
  const { data, error, loading } = useFetch(`/admin/lifecycle/${encodeURIComponent(stage)}`)

  if (loading) return <div style={{ padding: 32, color: '#aaa' }}>불러오는 중...</div>
  if (error) return <div style={{ padding: 32, color: '#e53e3e' }}>{error}</div>
  if (!data) return null

  const max = data.top_categories[0]?.total || 1

  return (
    <div className="dash-sidebar-layout" style={ps.wrap}>
      {/* 유저 수 */}
      <div style={ps.statBox}>
        <div style={ps.statNum}>{data.users.length}<span style={ps.statUnit}>명</span></div>
        <div style={ps.statLabel}>이 그룹 유저 수</div>
      </div>

      {/* 소비 TOP 5 */}
      <div style={ps.topBox}>
        <div style={ps.topTitle}>소비 카테고리 TOP 5</div>
        {data.top_categories.length === 0 ? (
          <div style={{ color: '#aaa', fontSize: 13 }}>데이터 없음</div>
        ) : (
          data.top_categories.map((c, i) => (
            <div key={i} style={ps.catRow}>
              <div style={ps.rank}>{i + 1}</div>
              <div className="dash-cat-name" style={ps.catName}>{c.category || '기타'}</div>
              <div style={ps.barWrap}>
                <div style={{ ...ps.bar, width: `${(c.total / max) * 100}%`, background: COLORS[i] }} />
              </div>
              <div className="dash-cat-amt" style={ps.catAmt}>{c.total.toLocaleString()}원</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function Lifecycle() {
  const { data, error, loading, reload } = useFetch('/admin/lifecycle')
  const [activeStage, setActiveStage] = useState(null)

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading) return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>{Array(10).fill(0).map((_, i) => <CardSkeleton key={i} />)}</div>

  // 전체 탭을 맨 앞에 추가 (모든 생애주기 합산)
  const total = (data || []).reduce((s, d) => s + (d.count || 0), 0)
  const tabs = [{ stage: 'ALL', label: '전체', count: total }, ...(data || [])]

  if (!activeStage) {
    setActiveStage('ALL')
    return null
  }

  const active = tabs.find(d => d.stage === activeStage)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>생애주기 예측 분포</h2>
      </div>

      {/* 탭 */}
      <div style={styles.tabWrap}>
        {tabs.map((d, i) => (
          <button
            key={d.stage}
            onClick={() => setActiveStage(d.stage)}
            style={{
              ...styles.tab,
              ...(activeStage === d.stage ? { ...styles.tabActive, borderBottom: `3px solid ${COLORS[i % COLORS.length]}`, color: COLORS[i % COLORS.length] } : {}),
            }}
          >
            <div style={styles.tabLabel}>{d.label}</div>
            <div style={{ ...styles.tabCount, color: activeStage === d.stage ? COLORS[i % COLORS.length] : '#aaa' }}>{d.count}명</div>
          </button>
        ))}
      </div>

      {/* 패널 */}
      {active && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <span style={styles.panelTitle}>{active.label}</span>
            <span style={styles.panelCode}>{active.stage}</span>
          </div>
          <StagePanel stage={activeStage} key={activeStage} />
        </div>
      )}
    </div>
  )
}

const styles = {
  refreshBtn: {
    padding: '5px 14px', background: '#6c63ff', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  tabWrap: {
    display: 'flex', flexWrap: 'wrap', gap: 0,
    background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.06)',
    marginBottom: 16, overflow: 'hidden',
  },
  tab: {
    flex: '1 1 auto', padding: '14px 12px', border: 'none', borderBottom: '3px solid transparent',
    background: 'transparent', cursor: 'pointer', textAlign: 'center',
    transition: 'background .15s',
  },
  tabActive: { background: '#fafafe' },
  tabLabel: { fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 2 },
  tabCount: { fontSize: 12, fontWeight: 700 },
  panel: {
    background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.06)', overflow: 'hidden',
  },
  panelHeader: {
    padding: '16px 24px', borderBottom: '1px solid #f0f0f0',
    display: 'flex', alignItems: 'center', gap: 10,
  },
  panelTitle: { fontSize: 16, fontWeight: 700 },
  panelCode: { fontSize: 12, color: '#aaa', background: '#f5f5f5', padding: '2px 8px', borderRadius: 6 },
}

const ps = {
  wrap: { display: 'grid', gridTemplateColumns: '200px 1fr', gap: 0 },
  statBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: 32, borderRight: '1px solid #f0f0f0', background: '#fafafe',
  },
  statNum: { fontSize: 52, fontWeight: 800, color: '#6c63ff', lineHeight: 1 },
  statUnit: { fontSize: 20, fontWeight: 600, marginLeft: 4 },
  statLabel: { fontSize: 13, color: '#888', marginTop: 8 },
  topBox: { padding: '24px 28px' },
  topTitle: { fontSize: 13, fontWeight: 700, color: '#6c63ff', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' },
  catRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  rank: { width: 20, height: 20, borderRadius: '50%', background: '#f0f0f0', fontSize: 11, fontWeight: 700, color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catName: { width: 110, fontSize: 13, color: '#444', flexShrink: 0 },
  barWrap: { flex: 1, background: '#f0f0f0', borderRadius: 4, height: 18, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4, transition: 'width .4s ease' },
  catAmt: { width: 110, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#333', flexShrink: 0 },
}
