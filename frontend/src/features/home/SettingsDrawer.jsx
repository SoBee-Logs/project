import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { removeToken, getUserId } from '../../common/hooks/useAuth'

// 로그아웃 시 지워야 할 localStorage 키
function clearLocalStorage(userId) {
  removeToken()
  localStorage.removeItem('user_id')
  localStorage.removeItem('alertSeenKey')
  if (userId) localStorage.removeItem(`mydataConnected_${userId}`)
}

export default function SettingsDrawer({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // 로그아웃
  const handleLogout = () => {
    const userId = getUserId()
    clearLocalStorage(userId)
    navigate('/login', { replace: true })
  }

  // 회원 탈퇴 — API 호출 후 localStorage 초기화
  const handleDeleteAccount = async () => {
    const userId = getUserId()
    if (!userId) return
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // 네트워크 오류여도 클라이언트 정리는 진행
    }
    clearLocalStorage(userId)
    navigate('/login', { replace: true })
  }

  // 마이데이터 연동 해제 — 로컬 상태만 초기화
  const handleDisconnectSync = () => {
    const userId = getUserId()
    localStorage.removeItem(`mydataConnected_${userId}`)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* 드로어 본체 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl max-w-[430px] mx-auto">
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pb-8 pt-2">
          <p className="text-xs font-semibold text-gray-400 mb-3 tracking-wide">설정</p>

          {/* 로그아웃 */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 py-3.5 text-left active:bg-gray-50 rounded-xl"
          >
            <span className="text-lg">🚪</span>
            <span className="text-sm font-medium text-gray-700">로그아웃</span>
          </button>

          {/* 마이데이터 연동 해제 */}
          <button
            type="button"
            onClick={handleDisconnectSync}
            className="w-full flex items-center gap-3 py-3.5 text-left active:bg-gray-50 rounded-xl"
          >
            <span className="text-lg">🔗</span>
            <span className="text-sm font-medium text-gray-700">마이데이터 연동 해제</span>
          </button>

          {/* 이용약관 */}
          <button
            type="button"
            onClick={() => window.open('https://www.notion.so/FISA-3475e2536d9280f2848ccd00bc91c648?source=copy_link', '_blank')}
            className="w-full flex items-center gap-3 py-3.5 text-left active:bg-gray-50 rounded-xl"
          >
            <span className="text-lg">📄</span>
            <span className="text-sm font-medium text-gray-700">이용약관 / 개인정보처리방침</span>
          </button>

          <div className="border-t border-gray-100 mt-1 mb-3" />

          {/* 회원 탈퇴 */}
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center gap-3 py-3.5 text-left active:bg-red-50 rounded-xl"
          >
            <span className="text-lg">⚠️</span>
            <span className="text-sm font-medium text-red-500">회원 탈퇴</span>
          </button>
        </div>
      </div>

      {/* 회원 탈퇴 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <p className="text-sm font-semibold text-gray-800 mb-1">정말 탈퇴하시겠어요?</p>
            <p className="text-xs text-gray-400 mb-6">탈퇴 후에는 계정을 복구할 수 없습니다.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-medium text-white"
              >
                탈퇴하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
