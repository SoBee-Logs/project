import React, { useState, useRef } from 'react'
import Overview from './components/Overview.jsx'
import AvatarGallery from './components/AvatarGallery.jsx'
import UserDataStats from './components/UserDataStats.jsx'
import DiaryMapping from './components/DiaryMapping.jsx'
import VlmStats from './components/VlmStats.jsx'
import Lifecycle from './components/Lifecycle.jsx'
import PromptManager from './components/PromptManager.jsx'
import SystemHealth from './components/SystemHealth.jsx'

const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'avatar', label: '아바타' },
  { id: 'user-data', label: '사용자 데이터' },
  { id: 'vlm', label: 'VLM 분석' },
  { id: 'diary', label: '사진·일기 매핑' },
  { id: 'lifecycle', label: '생애주기' },
  { id: 'prompts', label: '프롬프트 관리' },
  { id: 'health', label: '🩺 시스템' },
]

export default function App() {
  const [tab, setTab] = useState('overview')
  const overviewReloadRef = useRef(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={styles.header}>
        <h1 style={styles.title}>🗂 SobeeLog 관리자 대시보드</h1>
        <nav style={{ ...styles.nav, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{ ...styles.tab, ...(tab === t.id ? styles.activeTab : {}) }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#888' }}>30초마다 자동갱신 · 마지막: {lastRefresh.toLocaleTimeString()}</span>
            <button onClick={() => overviewReloadRef.current?.()} style={styles.refreshBtn}>
              ↻ 새로고침
            </button>
          </div>
        </nav>
      </header>
      <main style={styles.main}>
        {tab === 'overview' && <Overview onReloadRef={overviewReloadRef} onRefresh={setLastRefresh} />}
        {tab === 'avatar' && <AvatarGallery />}
        {tab === 'user-data' && <UserDataStats />}
        {tab === 'diary' && <DiaryMapping />}
        {tab === 'vlm' && <VlmStats />}
        {tab === 'lifecycle' && <Lifecycle />}

        {tab === 'prompts' && <PromptManager />}
        {tab === 'health' && <SystemHealth />}
      </main>
    </div>
  )
}

const styles = {
  header: { background: '#1a1a2e', color: '#fff', padding: '16px 32px' },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 12 },
  nav: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: {
    padding: '6px 16px', borderRadius: 20, border: '1px solid #444',
    background: 'transparent', color: '#ccc', cursor: 'pointer', fontSize: 14,
  },
  activeTab: { background: '#6c63ff', color: '#fff', border: '1px solid #6c63ff' },
  refreshBtn: {
    padding: '5px 14px', background: '#6c63ff', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
  },
  main: { padding: '24px 32px', maxWidth: 1400, margin: '0 auto' },
}
