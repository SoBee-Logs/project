import React, { useEffect, useState } from 'react'

const KEY_LABELS = {
  vlm_extraction: 'VLM 사진 분석',
  diary_system: '일기 생성 (시스템)',
  diary_user_matched: '일기 생성 (매핑됨)',
  diary_user_unmatched: '일기 생성 (미매핑)',
  group_mapping: '결제 매핑',
  avatar_image: '아바타 이미지',
  avatar_analysis: '아바타 분석 (VLM 있음)',
  avatar_analysis_no_vlm: '아바타 분석 (VLM 없음)',
}

function HistoryModal({ promptKey, currentValue, onRestore, onClose }) {
  const [history, setHistory] = useState(null)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    fetch(`/admin/prompts/${promptKey}/history`)
      .then(r => r.json())
      .then(setHistory)
  }, [promptKey])

  return (
    <div style={hs.overlay} onClick={onClose}>
      <div style={hs.box} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>변경 이력 — {KEY_LABELS[promptKey] || promptKey}</h3>
          <button style={hs.closeBtn} onClick={onClose}>✕</button>
        </div>
        {!history && <p style={{ color: '#888' }}>불러오는 중...</p>}
        {history && history.length === 0 && <p style={{ color: '#aaa', fontSize: 14 }}>변경 이력이 없어요.</p>}
        {history && history.map((h, i) => (
          <div key={i} style={hs.item}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#888' }}>{h.saved_at}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setPreview(preview === i ? null : i)} style={hs.previewBtn}>
                  {preview === i ? '접기' : '미리보기'}
                </button>
                <button onClick={() => { onRestore(h.value); onClose() }} style={hs.restoreBtn}>복원</button>
              </div>
            </div>
            {preview === i && (
              <pre style={hs.pre}>{h.value}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PromptManager() {
  const [prompts, setPrompts] = useState([])
  const [selected, setSelected] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: 'success' })
  const [showHistory, setShowHistory] = useState(false)
  const [charCount, setCharCount] = useState(0)

  const load = () =>
    fetch('/admin/prompts').then(r => r.json()).then(data => {
      setPrompts(data)
      if (!selected && data.length) selectPrompt(data[0])
    })

  useEffect(() => { load() }, [])

  const selectPrompt = (p) => {
    setSelected(p.key)
    setEditValue(p.value)
    setCharCount(p.value.length)
    setMsg({ text: '', type: 'success' })
  }

  const save = async () => {
    setSaving(true)
    await fetch(`/admin/prompts/${selected}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: editValue }),
    })
    setMsg({ text: '✓ 저장됐어요.', type: 'success' })
    setSaving(false)
    load()
  }

  const reset = async () => {
    if (!window.confirm('기본값으로 초기화할까요?')) return
    await fetch(`/admin/prompts/${selected}`, { method: 'DELETE' })
    setMsg({ text: '✓ 초기화됐어요.', type: 'info' })
    load()
  }

  const restore = (value) => {
    setEditValue(value)
    setCharCount(value.length)
    setMsg({ text: '⏪ 이전 버전을 불러왔어요. 저장 버튼을 눌러 적용하세요.', type: 'warn' })
  }

  const current = prompts.find(p => p.key === selected)

  return (
    <div>
      <h2 style={s.heading}>프롬프트 관리</h2>
      <div style={s.layout}>
        <div style={s.sidebar}>
          {prompts.map(p => (
            <button
              key={p.key}
              onClick={() => selectPrompt(p)}
              style={{ ...s.item, ...(p.key === selected ? s.itemActive : {}) }}
            >
              <span style={s.itemLabel}>{KEY_LABELS[p.key] || p.key}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {p.history_count > 0 && (
                  <span style={s.histBadge}>{p.history_count}</span>
                )}
                {p.is_modified && <span style={s.badge}>수정됨</span>}
              </div>
            </button>
          ))}
        </div>

        <div style={s.editor}>
          {current ? (
            <>
              <div style={s.editorHeader}>
                <div>
                  <div style={s.editorTitle}>{KEY_LABELS[current.key] || current.key}</div>
                  <div style={s.editorKey}>{current.key}</div>
                </div>
                <div style={s.actions}>
                  <button onClick={() => setShowHistory(true)} style={s.histBtn}>
                    📋 이력 ({current.history_count})
                  </button>
                  {current.is_modified && (
                    <button onClick={reset} style={s.resetBtn}>초기화</button>
                  )}
                  <button onClick={save} disabled={saving} style={s.saveBtn}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>

              {msg.text && (
                <div style={{
                  ...s.msg,
                  background: msg.type === 'warn' ? '#fffbeb' : msg.type === 'info' ? '#f0fdf4' : '#f0fdf4',
                  color: msg.type === 'warn' ? '#92400e' : '#065f46',
                  border: `1px solid ${msg.type === 'warn' ? '#fde68a' : '#a7f3d0'}`,
                }}>{msg.text}</div>
              )}

              <textarea
                style={s.textarea}
                value={editValue}
                onChange={e => { setEditValue(e.target.value); setCharCount(e.target.value.length); setMsg({ text: '', type: 'success' }) }}
                spellCheck={false}
              />
              <div style={s.charCount}>{charCount.toLocaleString()}자</div>

              {current.is_modified && (
                <details style={s.details}>
                  <summary style={s.summary}>기본값 보기</summary>
                  <pre style={s.pre}>{current.default}</pre>
                </details>
              )}
            </>
          ) : (
            <p style={{ color: '#888', padding: 24 }}>왼쪽에서 프롬프트를 선택하세요.</p>
          )}
        </div>
      </div>

      {showHistory && current && (
        <HistoryModal
          promptKey={selected}
          currentValue={editValue}
          onRestore={restore}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}

const s = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  layout: { display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' },
  sidebar: {
    background: '#fff', borderRadius: 12, padding: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  item: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 12px', borderRadius: 8, border: 'none',
    background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%',
  },
  itemActive: { background: '#ede9fe' },
  itemLabel: { fontSize: 13, color: '#333', fontWeight: 500 },
  badge: {
    fontSize: 10, background: '#6c63ff', color: '#fff',
    borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap',
  },
  histBadge: {
    fontSize: 10, background: '#e2e8f0', color: '#64748b',
    borderRadius: 6, padding: '2px 5px',
  },
  editor: {
    background: '#fff', borderRadius: 12, padding: 24,
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
  },
  editorHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  editorTitle: { fontSize: 16, fontWeight: 700, color: '#222' },
  editorKey: { fontSize: 12, color: '#888', marginTop: 2 },
  actions: { display: 'flex', gap: 8 },
  histBtn: {
    padding: '7px 14px', background: '#f8f9fa', color: '#444',
    border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  saveBtn: {
    padding: '7px 20px', background: '#6c63ff', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  resetBtn: {
    padding: '7px 16px', background: '#fff', color: '#ef4444',
    border: '1px solid #ef4444', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  msg: { fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 10 },
  textarea: {
    width: '100%', minHeight: 380, fontFamily: 'monospace', fontSize: 13,
    padding: 12, border: '1px solid #e5e7eb', borderRadius: 8,
    resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6,
    outline: 'none', color: '#333',
  },
  charCount: { fontSize: 12, color: '#aaa', textAlign: 'right', marginTop: 4, marginBottom: 8 },
  details: { marginTop: 12 },
  summary: { fontSize: 13, color: '#888', cursor: 'pointer' },
  pre: {
    marginTop: 8, padding: 12, background: '#f8f8f8', borderRadius: 8,
    fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    color: '#666', maxHeight: 300, overflowY: 'auto',
  },
}

const hs = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  },
  box: {
    background: '#fff', borderRadius: 16, padding: 28,
    width: '90%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto',
    position: 'relative',
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888',
  },
  item: {
    background: '#f8f9fa', borderRadius: 10, padding: '12px 14px', marginBottom: 10,
  },
  previewBtn: {
    padding: '3px 10px', borderRadius: 6, border: '1px solid #ddd',
    background: '#fff', cursor: 'pointer', fontSize: 12, color: '#666',
  },
  restoreBtn: {
    padding: '3px 10px', borderRadius: 6, border: '1px solid #6c63ff',
    background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6c63ff',
  },
  pre: {
    marginTop: 10, padding: 10, background: '#f0f0f0', borderRadius: 6,
    fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    color: '#444', maxHeight: 200, overflowY: 'auto',
  },
}
