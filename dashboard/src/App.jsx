import React, { useState } from 'react'
import Overview from './components/Overview.jsx'
import AvatarGallery from './components/AvatarGallery.jsx'
import UserDataStats from './components/UserDataStats.jsx'
import DiaryMapping from './components/DiaryMapping.jsx'
import VlmStats from './components/VlmStats.jsx'
import Lifecycle from './components/Lifecycle.jsx'
import SpendingTrends from './components/SpendingTrends.jsx'
import PromptManager from './components/PromptManager.jsx'

const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'avatar', label: '아바타' },
  { id: 'user-data', label: '사용자 데이터' },
  { id: 'diary', label: '사진·일기 매핑' },
  { id: 'vlm', label: 'VLM 분석' },
  { id: 'lifecycle', label: '생애주기' },
  { id: 'spending', label: '소비 트렌드' },
  { id: 'prompts', label: '프롬프트 관리' },
]

export default function App() {
  const [tab, setTab] = useState('overview')

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={styles.header}>
        <h1 style={styles.title}>🗂 SobeeLog 관리자 대시보드</h1>
        <nav style={styles.nav}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ ...styles.tab, ...(tab === t.id ? styles.activeTab : {}) }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main style={styles.main}>
        {tab === 'overview' && <Overview />}
        {tab === 'avatar' && <AvatarGallery />}
        {tab === 'user-data' && <UserDataStats />}
        {tab === 'diary' && <DiaryMapping />}
        {tab === 'vlm' && <VlmStats />}
        {tab === 'lifecycle' && <Lifecycle />}
        {tab === 'spending' && <SpendingTrends />}
        {tab === 'prompts' && <PromptManager />}
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
  main: { padding: '24px 32px', maxWidth: 1400, margin: '0 auto' },
}
