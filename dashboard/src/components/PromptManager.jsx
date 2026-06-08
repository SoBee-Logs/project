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

export default function PromptManager() {
  const [prompts, setPrompts] = useState([])
  const [selected, setSelected] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () =>
    fetch('/admin/prompts').then(r => r.json()).then(data => {
      setPrompts(data)
      if (!selected && data.length) select(data[0])
    })

  useEffect(() => { load() }, [])

  const select = (p) => {
    setSelected(p.key)
    setEditValue(p.value)
    setMsg('')
  }

  const save = async () => {
    setSaving(true)
    await fetch(`/admin/prompts/${selected}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: editValue }),
    })
    setMsg('저장됐어요.')
    setSaving(false)
    load()
  }

  const reset = async () => {
    if (!window.confirm('기본값으로 초기화할까요?')) return
    await fetch(`/admin/prompts/${selected}`, { method: 'DELETE' })
    setMsg('초기화됐어요.')
    load()
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
              onClick={() => select(p)}
              style={{ ...s.item, ...(p.key === selected ? s.itemActive : {}) }}
            >
              <span style={s.itemLabel}>{KEY_LABELS[p.key] || p.key}</span>
              {p.is_modified && <span style={s.badge}>수정됨</span>}
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
                  {current.is_modified && (
                    <button onClick={reset} style={s.resetBtn}>초기화</button>
                  )}
                  <button onClick={save} disabled={saving} style={s.saveBtn}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
              {msg && <div style={s.msg}>{msg}</div>}
              <textarea
                style={s.textarea}
                value={editValue}
                onChange={e => { setEditValue(e.target.value); setMsg('') }}
                spellCheck={false}
              />
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
  editor: {
    background: '#fff', borderRadius: 12, padding: 24,
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
  },
  editorHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  editorTitle: { fontSize: 16, fontWeight: 700, color: '#222' },
  editorKey: { fontSize: 12, color: '#888', marginTop: 2 },
  actions: { display: 'flex', gap: 8 },
  saveBtn: {
    padding: '7px 20px', background: '#6c63ff', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  resetBtn: {
    padding: '7px 16px', background: '#fff', color: '#ef4444',
    border: '1px solid #ef4444', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  msg: { fontSize: 13, color: '#10b981', marginBottom: 8 },
  textarea: {
    width: '100%', minHeight: 420, fontFamily: 'monospace', fontSize: 13,
    padding: 12, border: '1px solid #e5e7eb', borderRadius: 8,
    resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6,
    outline: 'none', color: '#333',
  },
  details: { marginTop: 12 },
  summary: { fontSize: 13, color: '#888', cursor: 'pointer' },
  pre: {
    marginTop: 8, padding: 12, background: '#f8f8f8', borderRadius: 8,
    fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    color: '#666', maxHeight: 300, overflowY: 'auto',
  },
}
