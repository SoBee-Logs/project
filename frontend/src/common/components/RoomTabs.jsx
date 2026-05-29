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
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`/api/groups/join?code=${joinCode}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('참여 실패')
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
    } catch (err) {
      alert('존재하지 않는 코드예요.')
      console.error(err)
    }
  }

  const handleLeaveRoom = async () => {
    if (!window.confirm('정말 이 모임에서 나가시겠어요?')) return
    try {
      const token = localStorage.getItem('token')
      const groupId = currentRoomId.replace('room_', '')
      const res = await fetch(`/api/groups/${groupId}/leave`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('나가기 실패')
      const updatedRooms = rooms.filter((r) => r.id !== currentRoomId)
      setRooms(updatedRooms)
      setShowCodePopup(false)
      onChange?.(updatedRooms[0]?.id ?? null)
    } catch (err) {
      alert('모임 나가기에 실패했어요.')
      console.error(err)
    }
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
      <nav className="flex items-center bg-white border-b border-gray-100">
        <div
          ref={scrollRef}
          className={`flex flex-1 overflow-x-auto scrollbar-hide ${dragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
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
                className={`shrink-0 px-4 py-2.5 text-sm font-medium relative ${
                  active ? 'text-[#0083CA]' : 'text-gray-400'
                }`}
              >
                {room.label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#0083CA] rounded-full" />
                )}
              </button>
            )
          })}
        </div>
        {showAdd && (
          <div className="relative shrink-0 pr-2">
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-8 h-8 shrink-0 flex items-center justify-center text-gray-500 text-xl font-light"
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
        <div style={popupStyle}>
          <div style={cardStyle}>
            <h3 style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>모임 만들기</h3>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>함께 소비를 기록해봐요!</p>
            <input
              placeholder="모임 이름 (5자 이내)"
              value={newRoomName}
              onChange={(e) => {
                if (e.target.value.length <= 5) setNewRoomName(e.target.value)
              }}
              style={inputStyle}
            />
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '12px', textAlign: 'right' }}>
              {newRoomName.length}/5
            </p>
            <input
              placeholder="모임 소개 (15자 이내)"
              value={newRoomDesc}
              onChange={(e) => {
                if (e.target.value.length <= 15) setNewRoomDesc(e.target.value)
              }}
              style={inputStyle}
            />
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '16px', textAlign: 'right' }}>
              {newRoomDesc.length}/15
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setShowCreatePopup(false); setNewRoomName(''); setNewRoomDesc('') }}
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