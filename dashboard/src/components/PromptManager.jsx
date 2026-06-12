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

const PROMPT_META = {
  vlm_extraction: { location: 'VLM 분석 파이프라인', input: '이미지', output: 'JSON', model: 'GPT-4o' },
  diary_system: { location: '일기 생성 > 시스템 프롬프트', input: '사용자 데이터', output: '텍스트', model: 'GPT-4o' },
  diary_user_matched: { location: '일기 생성 > 매핑됨', input: '결제 + VLM 결과', output: '텍스트', model: 'GPT-4o' },
  diary_user_unmatched: { location: '일기 생성 > 미매핑', input: '결제 데이터', output: '텍스트', model: 'GPT-4o' },
  group_mapping: { location: '사진·일기 매핑 > 결제 후보 선택', input: 'VLM 분석 결과 + 결제 내역 후보', output: 'JSON', model: 'GPT-4o' },
  avatar_image: { location: '아바타 생성 > 이미지 프롬프트', input: '사용자 프로필', output: '텍스트', model: 'DALL-E 3' },
  avatar_analysis: { location: '아바타 생성 > VLM 분석', input: '사용자 이미지 + VLM', output: 'JSON', model: 'GPT-4o' },
  avatar_analysis_no_vlm: { location: '아바타 생성 > 프로필 기반', input: '사용자 프로필', output: 'JSON', model: 'GPT-4o' },
}

const GROUPS = [
  {
    label: '아바타 분석',
    keys: ['avatar_analysis', 'avatar_analysis_no_vlm'],
    shortLabels: { avatar_analysis: 'VLM 있음', avatar_analysis_no_vlm: 'VLM 없음' },
  },
  {
    label: '일기 생성',
    keys: ['diary_system', 'diary_user_matched', 'diary_user_unmatched'],
    shortLabels: { diary_system: '시스템', diary_user_matched: '매핑됨', diary_user_unmatched: '미매핑' },
  },
  { label: '아바타 이미지', keys: ['avatar_image'] },
  { label: '결제 매핑', keys: ['group_mapping'] },
  { label: 'VLM 사진 분석', keys: ['vlm_extraction'] },
]

function HistoryModal({ promptKey, onRestore, onClose }) {
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
            {preview === i && <pre style={hs.pre}>{h.value}</pre>}
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
  const [openGroups, setOpenGroups] = useState({ '아바타 분석': true, '일기 생성': true })
  const [activeTab, setActiveTab] = useState('edit')
  const [testInput, setTestInput] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)

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
    setTestResult(null)
    setActiveTab('edit')
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

  const runTest = async () => {
    if (!testInput.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/admin/prompts/${selected}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: testInput, prompt: editValue }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch (e) {
      setTestResult({ error: '테스트 실행 중 오류가 발생했습니다.' })
    }
    setTesting(false)
  }

  const loadSampleInput = () => {
    const samples = {
      group_mapping: `{\n  "vlm_result": {\n    "title": "카페에서 커피를 마시는 사진",\n    "category": "카페/디저트",\n    "time": "2024-05-20 14:15",\n    "amount": 5500\n  },\n  "payment_candidates": [\n    { "payment_id": "p123", "store": "스타벅스 강남점", "time": "2024-05-20 14:10", "amount": 5500 },\n    { "payment_id": "p124", "store": "이디야 커피", "time": "2024-05-20 16:45", "amount": 4500 }\n  ]\n}`,
      vlm_extraction: `{\n  "image_url": "https://example.com/sample.jpg"\n}`,
      diary_system: `{\n  "user_id": "u001",\n  "date": "2024-05-20",\n  "payments": [{ "store": "스타벅스", "amount": 5500, "category": "카페" }]\n}`,
    }
    setTestInput(samples[selected] || '{\n  "input": "테스트 입력값을 입력하세요"\n}')
  }

  const toggleGroup = (label) =>
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))

  const current = prompts.find(p => p.key === selected)
  const meta = PROMPT_META[selected] || {}

  const isJsonOutput = meta.output === 'JSON'

  const renderTestResult = () => {
    if (!testResult) return null
    if (testResult.error) return (
      <div style={{ color: '#ef4444', fontSize: 13, padding: 12 }}>{testResult.error}</div>
    )
    const raw = testResult.result || testResult.output || JSON.stringify(testResult, null, 2)
    let parsed = null
    let isJson = false
    try { parsed = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)); isJson = true } catch {}
    return (
      <>
        <div style={ts.resultBox}>
          <pre style={ts.resultPre}>{typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)}</pre>
        </div>
        {isJson && parsed && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>설명</div>
            {Object.entries(parsed).map(([k, v]) => (
              <div key={k} style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
                - <strong>{k}</strong>: {String(v)}
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <div>
      <h2 style={s.heading}>프롬프트 관리</h2>
      <div style={s.layout}>

        {/* 사이드바 */}
        <div style={s.sidebar}>
          {GROUPS.map(group => {
            const groupPrompts = prompts.filter(p => group.keys.includes(p.key))
            const isMulti = group.keys.length > 1
            const isOpen = openGroups[group.label]
            const anyModified = groupPrompts.some(p => p.is_modified)
            const isGroupSelected = groupPrompts.some(p => p.key === selected)

            if (groupPrompts.length === 0) return null

            if (!isMulti) {
              const p = groupPrompts[0]
              return (
                <button
                  key={p.key}
                  onClick={() => selectPrompt(p)}
                  style={{ ...s.item, ...(p.key === selected ? s.itemActive : {}) }}
                >
                  <span style={s.itemLabel}>{group.label}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {p.history_count > 0 && <span style={s.histBadge}>{p.history_count}</span>}
                    {p.is_modified && <span style={s.badge}>수정됨</span>}
                  </div>
                </button>
              )
            }

            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  style={{ ...s.item, ...(isGroupSelected && !isOpen ? s.itemActive : {}) }}
                >
                  <span style={s.itemLabel}>{group.label}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {anyModified && <span style={s.badge}>수정됨</span>}
                    <span style={{ fontSize: 11, color: '#999', marginLeft: 2 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isOpen && groupPrompts.map(p => (
                  <button
                    key={p.key}
                    onClick={() => selectPrompt(p)}
                    style={{ ...s.subItem, ...(p.key === selected ? s.itemActive : {}) }}
                  >
                    <span style={{ ...s.itemLabel, color: '#555' }}>
                      {group.shortLabels?.[p.key] || KEY_LABELS[p.key]}
                    </span>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {p.history_count > 0 && <span style={s.histBadge}>{p.history_count}</span>}
                      {p.is_modified && <span style={s.badge}>수정됨</span>}
                    </div>
                  </button>
                ))}
              </div>
            )
          })}

          <div style={s.sidebarFooter}>
            <button style={s.addBtn} disabled>+ 새 프롬프트 추가</button>
          </div>
        </div>

        {/* 메인 에디터 영역 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {current ? (
            <>
              {/* 상단 메타 카드 */}
              <div style={s.metaCard}>
                <div style={s.metaCardTop}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={s.metaTitle}>{KEY_LABELS[current.key] || current.key}</span>
                    {current.is_modified
                      ? <span style={s.badgeUsing}>수정됨</span>
                      : <span style={s.badgeUsing}>사용 중</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowHistory(true)} style={s.histBtn}>
                      🕐 수정 이력 ({current.history_count})
                    </button>
                    {current.is_modified && (
                      <button onClick={reset} style={s.resetBtn}>초기화</button>
                    )}
                    <button onClick={save} disabled={saving} style={s.saveBtn}>
                      {saving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
                <div style={s.metaRow}>
                  <MetaField label="사용 위치" value={meta.location || '-'} />
                  <MetaField label="입력" value={meta.input || '-'} />
                  <MetaField label="출력 형식" value={meta.output || '-'} />
                  <MetaField label="모델" value={meta.model || '-'} />
                  <MetaField label="마지막 수정" value={current.last_modified || '-'} />
                  <MetaField label="수정자" value="관리자" />
                </div>
              </div>

              {/* 에디터 카드 */}
              <div style={s.editor}>
                {msg.text && (
                  <div style={{
                    ...s.msg,
                    background: msg.type === 'warn' ? '#fffbeb' : '#f0fdf4',
                    color: msg.type === 'warn' ? '#92400e' : '#065f46',
                    border: `1px solid ${msg.type === 'warn' ? '#fde68a' : '#a7f3d0'}`,
                    marginBottom: 12,
                  }}>{msg.text}</div>
                )}

                {/* 탭 */}
                <div style={s.tabs}>
                  <button
                    style={{ ...s.tab, ...(activeTab === 'edit' ? s.tabActive : {}) }}
                    onClick={() => setActiveTab('edit')}
                  >프롬프트 편집</button>
                  <button
                    style={{ ...s.tab, ...(activeTab === 'raw' ? s.tabActive : {}) }}
                    onClick={() => setActiveTab('raw')}
                  >원문 보기</button>
                </div>

                {activeTab === 'edit' ? (
                  <textarea
                    style={s.textarea}
                    value={editValue}
                    onChange={e => {
                      setEditValue(e.target.value)
                      setCharCount(e.target.value.length)
                      setMsg({ text: '', type: 'success' })
                    }}
                    spellCheck={false}
                    placeholder="프롬프트를 입력하세요..."
                  />
                ) : (
                  <pre style={s.rawPre}>{current.default || editValue}</pre>
                )}
                <div style={s.charCount}>{charCount.toLocaleString()}자</div>
              </div>

              {/* 테스트 패널 */}
              <div style={ts.wrapper}>
                {/* 프롬프트 테스트 */}
                <div style={ts.panel}>
                  <div style={ts.panelHeader}>
                    <span style={ts.panelTitle}>프롬프트 테스트</span>
                    {isJsonOutput && (
                      <span style={ts.badge}>JSON 유효성 검사 포함</span>
                    )}
                    <button style={ts.sampleBtn} onClick={loadSampleInput}>샘플 입력 불러오기</button>
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>테스트 입력</div>
                  <textarea
                    style={ts.textarea}
                    value={testInput}
                    onChange={e => setTestInput(e.target.value)}
                    placeholder='{"key": "value"}'
                    spellCheck={false}
                  />
                  <button
                    style={{ ...ts.runBtn, opacity: testing ? 0.7 : 1 }}
                    onClick={runTest}
                    disabled={testing}
                  >
                    {testing ? '실행 중...' : '테스트 실행'}
                  </button>
                </div>

                {/* 실행 결과 */}
                <div style={ts.panel}>
                  <div style={ts.panelHeader}>
                    <span style={ts.panelTitle}>실행 결과</span>
                    {testResult && !testResult.error && (
                      <span style={ts.badgeOk}>JSON 유효</span>
                    )}
                    {testResult && !testResult.error && (
                      <button
                        style={ts.copyBtn}
                        onClick={() => navigator.clipboard.writeText(
                          JSON.stringify(testResult.result ?? testResult, null, 2)
                        )}
                      >결과 복사</button>
                    )}
                  </div>
                  {!testResult && (
                    <div style={{ color: '#bbb', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
                      테스트를 실행하면 결과가 표시됩니다.
                    </div>
                  )}
                  {renderTestResult()}
                </div>
              </div>

              <p style={{ fontSize: 12, color: '#aaa', marginTop: -8 }}>
                ⓘ 변경 사항은 저장 후 즉시 반영됩니다. 이력이 자동으로 기록됩니다.
              </p>
            </>
          ) : (
            <div style={s.editor}>
              <p style={{ color: '#888', padding: 24 }}>왼쪽에서 프롬프트를 선택하세요.</p>
            </div>
          )}
        </div>
      </div>

      {showHistory && current && (
        <HistoryModal
          promptKey={selected}
          onRestore={(v) => { restore(v); setShowHistory(false) }}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}

function MetaField({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: '#999' }}>{label}</span>
      <span style={{ fontSize: 12, color: '#444', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  )
}

const s = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  layout: { display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start' },
  sidebar: {
    background: '#fff', borderRadius: 12, padding: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
    display: 'flex', flexDirection: 'column', gap: 2,
    position: 'sticky', top: 16,
  },
  item: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 12px', borderRadius: 8, border: 'none',
    background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%',
  },
  subItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px 8px 24px', borderRadius: 8, border: 'none',
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
  sidebarFooter: { marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' },
  addBtn: {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px dashed #d1d5db', background: 'transparent',
    color: '#9ca3af', fontSize: 12, cursor: 'not-allowed',
  },
  metaCard: {
    background: '#fff', borderRadius: 12, padding: '16px 20px',
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
  },
  metaCardTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  metaTitle: { fontSize: 17, fontWeight: 700, color: '#1a1a1a' },
  badgeUsing: {
    fontSize: 11, background: '#dcfce7', color: '#16a34a',
    borderRadius: 6, padding: '3px 8px', fontWeight: 600,
  },
  metaRow: {
    display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 12, padding: '12px 0 0', borderTop: '1px solid #f0f0f0',
  },
  editor: {
    background: '#fff', borderRadius: 12, padding: 20,
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
  },
  tabs: { display: 'flex', gap: 0, marginBottom: 14, borderBottom: '2px solid #f0f0f0' },
  tab: {
    padding: '8px 16px', border: 'none', background: 'none',
    cursor: 'pointer', fontSize: 14, color: '#888', fontWeight: 500,
    borderBottom: '2px solid transparent', marginBottom: -2,
  },
  tabActive: { color: '#6c63ff', borderBottom: '2px solid #6c63ff' },
  histBtn: {
    padding: '7px 14px', background: '#f8f9fa', color: '#444',
    border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 4,
  },
  saveBtn: {
    padding: '7px 20px', background: '#6c63ff', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  resetBtn: {
    padding: '7px 16px', background: '#fff', color: '#ef4444',
    border: '1px solid #ef4444', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  msg: { fontSize: 13, padding: '8px 12px', borderRadius: 8 },
  textarea: {
    width: '100%', minHeight: 340, fontFamily: 'monospace', fontSize: 13,
    padding: 12, border: '1px solid #e5e7eb', borderRadius: 8,
    resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6,
    outline: 'none', color: '#333',
  },
  rawPre: {
    margin: 0, padding: 12, background: '#f8f9fa', borderRadius: 8,
    fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    color: '#555', minHeight: 340, overflowY: 'auto', lineHeight: 1.6,
  },
  charCount: { fontSize: 12, color: '#aaa', textAlign: 'right', marginTop: 6 },
}

const ts = {
  wrapper: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
  },
  panel: {
    background: '#fff', borderRadius: 12, padding: 20,
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap',
  },
  panelTitle: { fontSize: 15, fontWeight: 700, color: '#1a1a1a' },
  badge: {
    fontSize: 11, background: '#fef3c7', color: '#92400e',
    borderRadius: 6, padding: '2px 8px', fontWeight: 500,
  },
  badgeOk: {
    fontSize: 11, background: '#dcfce7', color: '#16a34a',
    borderRadius: 6, padding: '2px 8px', fontWeight: 500,
  },
  sampleBtn: {
    marginLeft: 'auto', padding: '4px 12px', borderRadius: 6,
    border: '1px solid #e2e8f0', background: '#f8f9fa',
    color: '#555', fontSize: 12, cursor: 'pointer',
  },
  copyBtn: {
    marginLeft: 'auto', padding: '4px 12px', borderRadius: 6,
    border: '1px solid #e2e8f0', background: '#f8f9fa',
    color: '#555', fontSize: 12, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4,
  },
  textarea: {
    flex: 1, minHeight: 200, fontFamily: 'monospace', fontSize: 12,
    padding: 12, border: '1px solid #e5e7eb', borderRadius: 8,
    resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
    outline: 'none', color: '#333', background: '#1e1e2e',
    color: '#e2e8f0',
  },
  runBtn: {
    padding: '10px', background: '#6c63ff', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer',
    fontSize: 14, fontWeight: 600, textAlign: 'center',
  },
  resultBox: {
    background: '#1e1e2e', borderRadius: 8, padding: 12,
    minHeight: 120, flex: 1,
  },
  resultPre: {
    margin: 0, fontSize: 12, fontFamily: 'monospace',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    color: '#e2e8f0', lineHeight: 1.5,
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
  },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' },
  item: { background: '#f8f9fa', borderRadius: 10, padding: '12px 14px', marginBottom: 10 },
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
