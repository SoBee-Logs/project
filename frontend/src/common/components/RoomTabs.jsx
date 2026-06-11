import { useState, useEffect } from 'react'
import { ROOMS } from '../utils/rooms'
import { useDragScroll } from '../hooks/useDragScroll'

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase()

export default function RoomTabs({ activeRoom, onChange, showAdd = false }) {
  const [rooms, setRooms] = useState([])
  const [showCreatePopup, setShowCreatePopup] = useState(false)
  const [showJoinPopup, setShowJoinPopup] = useState(false)
  const [showCodePopup, setShowCodePopup] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)

  const { ref: scrollRef, dragging, onMouseDown, onMouseMove, onMouseUp, onMouseLeave } = useDragScroll()
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDesc, setNewRoomDesc] = useState('')
  const [newRoomCategory, setNewRoomCategory] = useState('')
  const [newTargetBudget, setNewTargetBudget] = useState('')
  const [newTargetDiaryCount, setNewTargetDiaryCount] = useState('')
  const [noBudgetLimit, setNoBudgetLimit] = useState(false)
  const [newSpendingCategoryId, setNewSpendingCategoryId] = useState(null)
  const [openSection, setOpenSection] = useState(null) // 'roomCategory' | 'spendingCategory' | 'weeklyGoal'
  const toggleSection = (section) => setOpenSection(prev => prev === section ? null : section)
  const [joinCode, setJoinCode] = useState('')
  const [currentCode, setCurrentCode] = useState('')
  const [currentRoomId, setCurrentRoomId] = useState(null)

  useEffect(() => {
    const fetchMyGroups = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) return
        const res = await fetch('/api/groups', {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        const data = await res.json()
        if (data && data.length > 0) {
          const fetchedRooms = data.map((group) => ({
            id: `room_${group.groupId}`,
            label: group.groupName,
            hashtag: `#${group.groupName}`,
            diaryTab: group.groupName,
            desc: group.groupDescription,
            code: group.groupCode,
          }))
          setRooms(fetchedRooms)
          if (!activeRoom) {
            onChange?.(fetchedRooms[0].id)
          }
        }
      } catch (err) {
        console.error('모임 목록 조회 실패', err)
      }
    }
    fetchMyGroups()
  }, [activeRoom])

  const handleTabClick = (roomId) => {
    if (activeRoom === roomId) {
      const room = rooms.find((r) => r.id === roomId)
      setCurrentCode(room.code)
      setCurrentRoomId(room.id)  // ← 추가
      setShowCodePopup(true)
    } else {
      onChange?.(roomId)
    }
  }
  const handleCreate = async () => {
    if (!newRoomName.trim()) return alert('모임 이름을 입력해주세요!')
    try {
      const token = localStorage.getItem("token")
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          groupName: newRoomName,
          groupDescription: newRoomDesc,
          category: newRoomCategory || null,
          targetBudget: noBudgetLimit ? null : (newTargetBudget ? parseInt(newTargetBudget) : null),
          targetDiaryCount: newTargetDiaryCount ? parseInt(newTargetDiaryCount) : null,
          spendingCategoryId: newSpendingCategoryId,
        }),
      })
      const data = await res.json()
      const newRoom = {
        id: `room_${data.groupId}`,
        label: data.groupName,
        hashtag: `#${data.groupName}`,
        diaryTab: data.groupName,
        desc: data.groupDescription,
        code: data.groupCode,
      }
      setRooms([...rooms, newRoom])
      setNewRoomName('')
      setNewRoomDesc('')
      setNewRoomCategory('')
      setNewTargetBudget('')
      setNewTargetDiaryCount('')
      setNoBudgetLimit(false)
      setNewSpendingCategoryId(null)
      setShowCreatePopup(false)
      setCurrentCode(data.groupCode)
      setShowCodePopup(true)
      onChange?.(newRoom.id)
    } catch (err) {
      alert('모임 생성에 실패했어요.')
      console.error(err)
    }
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return alert('초대 코드를 입력해주세요!')
    const token = localStorage.getItem("token")
    const res = await fetch(`/api/groups/join?code=${joinCode}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => null)

    // 네트워크 오류
    if (!res) {
      alert('네트워크 오류가 발생했어요. 다시 시도해주세요.')
      return
    }
    // API 에러 — 서버 응답 메시지로 분기 처리
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.message || '존재하지 않는 코드예요.')
      return
    }

    const data = await res.json()
    const newRoom = {
      id: `room_${data.groupId}`,
      label: data.groupName,
      hashtag: `#${data.groupName}`,
      diaryTab: data.groupName,
      desc: data.groupDescription,
      code: data.groupCode,
    }
    setRooms([...rooms, newRoom])
    setJoinCode('')
    setShowJoinPopup(false)
    onChange?.(newRoom.id)
  }

  const handleLeaveRoom = async () => {
    if (!window.confirm('정말 이 모임에서 나가시겠어요?')) return

    // fetch 성공 여부만 판별 — 성공 후 상태 갱신은 try 밖에서 처리
    const token = localStorage.getItem('token')
    const groupId = currentRoomId.replace('room_', '')
    let success = false
    try {
      const res = await fetch(`/api/groups/${groupId}/leave`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      success = res.ok
    } catch {
      success = false
    }

    if (!success) {
      alert('모임 나가기에 실패했어요.')
      return
    }

    // API 성공 후 클라이언트 상태 갱신
    const updatedRooms = rooms.filter((r) => r.id !== currentRoomId)
    setRooms(updatedRooms)
    setShowCodePopup(false)
    onChange?.(updatedRooms[0]?.id ?? null)
  }

  const popupStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  }

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '24px',
    width: '90%',
    maxWidth: '300px',
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1.5px solid #e5e7eb',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    marginTop: '8px',
    marginBottom: '4px',
  }

  return (
    <>
      <nav className="flex items-center bg-white border-b border-gray-100 px-4 py-2 gap-2">
        <div
          ref={scrollRef}
          className={`flex flex-1 gap-2 overflow-x-auto scrollbar-hide ${dragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
        >
          {rooms.map((room) => {
            const active = activeRoom === room.id
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => handleTabClick(room.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  active
                    ? 'font-bold'
                    : 'bg-gray-100 text-gray-400 border-transparent'
                }`}
                style={active ? {
                  background: '#F3F8FF',
                  borderColor: '#DCEBFF',
                  color: '#1F5FAE',
                  boxShadow: '0 3px 10px rgba(31, 122, 224, 0.05)',
                } : {}}
              >
                {room.label}
              </button>
            )
          })}
        </div>

        {showAdd && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-xl font-light"
            >+</button>
            {showAddMenu && (
              <div style={{
                position: 'absolute', top: '36px', right: 0,
                backgroundColor: 'white', borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                padding: '8px', zIndex: 100, width: '120px',
              }}>
                <button
                  onClick={() => { setShowCreatePopup(true); setShowAddMenu(false) }}
                  style={{ width: '100%', padding: '8px', textAlign: 'left', fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px' }}
                >✨모임 만들기</button>
                <button
                  onClick={() => { setShowJoinPopup(true); setShowAddMenu(false) }}
                  style={{ width: '100%', padding: '8px', textAlign: 'left', fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px' }}
                >🔗모임 참여하기</button>
              </div>
            )}
          </div>
        )}
      </nav>

      {showCreatePopup && (
        <div style={popupStyle} onClick={() => setShowCreatePopup(false)}>
          <div style={{ ...cardStyle, maxWidth: '320px', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>모임 만들기</h3>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>함께 소비를 기록해봐요!</p>

            {/* 모임 이름 */}
            <input
              placeholder="모임 이름 (5자 이내)"
              value={newRoomName}
              onChange={(e) => { if (e.target.value.length <= 5) setNewRoomName(e.target.value) }}
              style={inputStyle}
            />
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '12px', textAlign: 'right' }}>
              {newRoomName.length}/5
            </p>

            {/* 모임 소개 */}
            <input
              placeholder="모임 소개 (15자 이내)"
              value={newRoomDesc}
              onChange={(e) => { if (e.target.value.length <= 15) setNewRoomDesc(e.target.value) }}
              style={inputStyle}
            />
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '16px', textAlign: 'right' }}>
              {newRoomDesc.length}/15
            </p>

            {/* 카테고리 (선택) — 아코디언 */}
            <button
              type="button"
              onClick={() => toggleSection('roomCategory')}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px 0' }}
            >
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                모임 카테고리 (선택){newRoomCategory && <span style={{ color: '#0083CA', marginLeft: '6px', fontSize: '11px' }}>✓</span>}
              </span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>{openSection === 'roomCategory' ? '▲' : '▼'}</span>
            </button>
            {openSection === 'roomCategory' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '16px' }}>
                {[
                  { value: 'EXERCISE', label: '🏃운동' },
                  { value: 'HOBBY',    label: '🎨취미' },
                  { value: 'TRAVEL',   label: '✈️여행' },
                  { value: 'FAMILY',   label: '👨‍👩‍👧가족' },
                  { value: 'DAILY',    label: '☀️일상' },
                  { value: 'FOOD',     label: '🍜음식' },
                  { value: 'PET',      label: '🐾반려' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setNewRoomCategory(prev => prev === value ? '' : value)}
                    style={{
                      padding: '6px 2px', borderRadius: '8px',
                      border: newRoomCategory === value ? '2px solid #0083CA' : '1.5px solid #e5e7eb',
                      background: newRoomCategory === value ? '#E8F4FD' : 'white',
                      color: newRoomCategory === value ? '#0083CA' : '#6b7280',
                      fontSize: '10px', fontWeight: newRoomCategory === value ? '700' : '400', cursor: 'pointer',
                    }}
                  >{label}</button>
                ))}
              </div>
            )}
            {openSection !== 'roomCategory' && <div style={{ marginBottom: '12px' }} />}

            {/* 절약 카테고리 + 소비한도 (선택) — 아코디언 */}
            <button
              type="button"
              onClick={() => toggleSection('spendingCategory')}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px 0' }}
            >
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                절약 카테고리 · 소비한도 (선택){(newSpendingCategoryId || noBudgetLimit) && <span style={{ color: '#0083CA', marginLeft: '6px', fontSize: '11px' }}>✓</span>}
              </span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>{openSection === 'spendingCategory' ? '▲' : '▼'}</span>
            </button>
            {openSection === 'spendingCategory' && (
              <div style={{ marginBottom: '16px' }}>
                {/* 카테고리 선택 */}
                <select
                  value={newSpendingCategoryId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null
                    setNewSpendingCategoryId(val)
                    if (!val) { setNewTargetBudget(''); setNoBudgetLimit(false) }
                  }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: newSpendingCategoryId ? '2px solid #0083CA' : '1.5px solid #e5e7eb',
                    background: newSpendingCategoryId ? '#E8F4FD' : 'white',
                    color: newSpendingCategoryId ? '#0083CA' : '#9ca3af',
                    fontSize: '14px', fontWeight: newSpendingCategoryId ? '700' : '400',
                    outline: 'none', cursor: 'pointer', appearance: 'auto',
                    marginBottom: '12px',
                  }}
                >
                  <option value="">카테고리 선택</option>
                  {[
                    { id: 1,  label: '🍚 식비' },
                    { id: 2,  label: '☕ 카페간식' },
                    { id: 3,  label: '🛒 온라인쇼핑' },
                    { id: 4,  label: '👗 패션쇼핑' },
                    { id: 5,  label: '🚌 교통' },
                    { id: 6,  label: '✈️ 여행숙박' },
                    { id: 7,  label: '🎬 문화여가' },
                    { id: 8,  label: '🍺 술유흥' },
                    { id: 9,  label: '🏥 의료건강' },
                    { id: 10, label: '💄 뷰티미용' },
                    { id: 11, label: '🏠 주거통신' },
                    { id: 12, label: '📚 교육학습' },
                    { id: 13, label: '💳 금융' },
                    { id: 14, label: '🎁 경조선물' },
                    { id: 15, label: '🛍️ 생활' },
                    { id: 16, label: '📦 기타' },
                  ].map(({ id, label }) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>

                {/* 소비한도 입력 */}
                {noBudgetLimit ? (
                  <div style={{ ...inputStyle, marginTop: 0, marginBottom: '8px', background: '#f3f4f6', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                    한도 없음
                  </div>
                ) : (
                  <input
                    type="number"
                    placeholder={newSpendingCategoryId ? '소비 한도 (원)' : '카테고리를 먼저 선택해주세요'}
                    value={newTargetBudget}
                    min="0"
                    disabled={!newSpendingCategoryId}
                    onChange={(e) => { const val = e.target.value; if (val === '' || parseInt(val) >= 0) setNewTargetBudget(val) }}
                    style={{ ...inputStyle, marginTop: 0, marginBottom: '8px', background: !newSpendingCategoryId ? '#f3f4f6' : 'white', color: !newSpendingCategoryId ? '#9ca3af' : 'inherit', cursor: !newSpendingCategoryId ? 'not-allowed' : 'text' }}
                  />
                )}
                <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>💸 주간 소비 한도</p>

                {/* 소비한도 없음 체크박스 */}
                <label
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    cursor: newSpendingCategoryId ? 'pointer' : 'not-allowed',
                    padding: '8px 10px', borderRadius: '8px',
                    border: noBudgetLimit ? '2px solid #0083CA' : '1.5px solid #e5e7eb',
                    background: noBudgetLimit ? '#E8F4FD' : (!newSpendingCategoryId ? '#f3f4f6' : 'white'),
                    opacity: newSpendingCategoryId ? 1 : 0.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={noBudgetLimit}
                    disabled={!newSpendingCategoryId}
                    onChange={(e) => { setNoBudgetLimit(e.target.checked); if (e.target.checked) setNewTargetBudget('') }}
                    style={{ width: '16px', height: '16px', accentColor: '#0083CA', cursor: newSpendingCategoryId ? 'pointer' : 'not-allowed' }}
                  />
                  <span style={{ fontSize: '12px', color: noBudgetLimit ? '#0083CA' : '#6b7280', fontWeight: noBudgetLimit ? '700' : '400' }}>
                    소비한도 없음 (일기만 올리기)
                  </span>
                </label>
              </div>
            )}
            {openSection !== 'spendingCategory' && <div style={{ marginBottom: '12px' }} />}

            {/* 주간 일기 목표 (선택) — 아코디언 */}
            <button
              type="button"
              onClick={() => toggleSection('weeklyGoal')}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px 0' }}
            >
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                주간 일기 목표 (선택){newTargetDiaryCount && <span style={{ color: '#0083CA', marginLeft: '6px', fontSize: '11px' }}>✓</span>}
              </span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>{openSection === 'weeklyGoal' ? '▲' : '▼'}</span>
            </button>
            {openSection === 'weeklyGoal' && (
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="number"
                  placeholder="횟수"
                  value={newTargetDiaryCount}
                  min="0"
                  onChange={(e) => { const val = e.target.value; if (val === '' || parseInt(val) >= 0) setNewTargetDiaryCount(val) }}
                  style={{ ...inputStyle, marginTop: 0, marginBottom: '4px' }}
                />
                <p style={{ fontSize: '10px', color: '#9ca3af' }}>✍️ 이번 주 일기 작성 목표 횟수</p>
              </div>
            )}
            {openSection !== 'weeklyGoal' && <div style={{ marginBottom: '12px' }} />}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setShowCreatePopup(false)
                  setNewRoomName('')
                  setNewRoomDesc('')
                  setNewRoomCategory('')
                  setNewTargetBudget('')
                  setNewTargetDiaryCount('')
                  setNoBudgetLimit(false)
                  setNewSpendingCategoryId(null)
                }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '14px' }}
              >취소</button>
              <button
                onClick={handleCreate}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#0083CA', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
              >생성</button>
            </div>
          </div>
        </div>
      )}

      {showJoinPopup && (
        <div style={popupStyle}>
          <div style={cardStyle}>
            <h3 style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>모임 참여하기</h3>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>함께 소비를 기록해봐요!</p>
            <input
              placeholder="모임 코드 입력"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={() => setShowJoinPopup(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '14px' }}
              >취소</button>
              <button
                onClick={handleJoin}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#0083CA', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
              >참여</button>
            </div>
          </div>
        </div>
      )}

      {showCodePopup && (
        <div style={popupStyle}>
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <h3 style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>방 초대코드</h3>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>친구에게 코드를 공유하세요!</p>
            <div style={{
              backgroundColor: '#E8F4FD', borderRadius: '12px',
              padding: '16px', marginBottom: '16px',
            }}>
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#0083CA', letterSpacing: '6px' }}>
                {currentCode}
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentCode)
                alert('복사됐어요!')
              }}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: '#0083CA', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}
            >코드 복사</button>
            <button
              onClick={handleLeaveRoom}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
            >모임 나가기</button>
            <button
              onClick={() => setShowCodePopup(false)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '14px', marginBottom: '8px' }}
            >닫기</button>
          </div>
        </div>
      )}
    </>
  )
}