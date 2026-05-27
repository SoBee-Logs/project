import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import StatusBar from '../../common/components/StatusBar'

const MOOD_EMOJIS = ['☺️', '😭', '😮', '😍', '😡']
const MOOD_TYPES = ['HAPPY', 'SAD', 'SURPRISED', 'LOVE', 'ANGRY']

export default function CameraPage() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [selectedMood, setSelectedMood] = useState(0)
  const [selectedRooms, setSelectedRooms] = useState([])
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')  // 'upload' | 'analyze'
  const [rooms, setRooms] = useState([])
  // VLM 분석 상태 — 사진 선택 즉시 백그라운드 분석
  const [vlmData, setVlmData] = useState(null)
  const [vlmLoading, setVlmLoading] = useState(false)
  // GPS 위치 정보 상태 — 실제 기기 좌표를 업로드 시 함께 전달하기 위해 사용
  const [gpsCoords, setGpsCoords] = useState(null)   // { latitude, longitude } 또는 null
  const [gpsLoading, setGpsLoading] = useState(false) // 위치 수집 중 여부
  const [gpsError, setGpsError] = useState(null)      // 오류 메시지 또는 null
  // VLM Promise 참조 — handleNext에서 분석 완료까지 실제로 await하기 위해 사용
  const vlmPromiseRef = useRef(null)
  const fileInputRef = useRef(null)

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
          setRooms(data.map((group) => ({
            id: group.groupId,
            label: group.groupName,
          })))
        }
      } catch (err) {
        console.error('모임 목록 조회 실패', err)
      }
    }
    fetchMyGroups()
  }, [])

  // 컴포넌트 마운트 시 실제 기기 GPS 위치 요청
  useEffect(() => {
    if (!navigator.geolocation) {
      // GPS 자체를 지원하지 않는 환경 — 폴백 좌표(서울시청)로 대체
      setGpsError('이 기기는 위치 정보를 지원하지 않아요. 기본 위치로 대체합니다.')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 성공: 실제 기기 좌표 저장
        setGpsCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        })
        setGpsLoading(false)
      },
      (err) => {
        // 실패: 권한 거부(code 1) 또는 타임아웃 — 폴백 좌표 사용 + 사용자 안내
        let msg = '위치 정보를 가져올 수 없어요. 기본 위치로 대체합니다.'
        if (err.code === 1) msg = '위치 권한이 거부되었어요. 기본 위치로 대체합니다.'
        setGpsError(msg)
        setGpsLoading(false)
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    )
  }, [])

  const toggleRoom = (roomId) => {
    setSelectedRooms((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    )
  }

  // 사진 선택 즉시 VLM 분석 실행 — 사용자가 기분/모임 선택하는 동안 백그라운드 처리
  // Promise를 ref에 저장해 handleNext에서 완료될 때까지 실제로 await 가능하게 함
  const runVlmAnalysis = (file) => {
    setVlmLoading(true)
    setVlmData(null)

    const promise = (async () => {
      try {
        const formData = new FormData()
        formData.append('image', file)
        const res = await fetch('/api/vlm/analyze', { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          setVlmData(data)
          return data   // handleNext에서 await 시 결과값으로 받음
        }
        return null
      } catch {
        // VLM 실패해도 사진 선택/업로드는 계속 진행
        return null
      } finally {
        setVlmLoading(false)
      }
    })()

    vlmPromiseRef.current = promise  // Promise 보존
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    // 사진 선택과 동시에 VLM 분석 시작
    runVlmAnalysis(file)
  }

  const handleNext = async () => {
    if (selectedRooms.length === 0 || !imageFile) return

    setIsLoading(true)
    try {
      const token = localStorage.getItem("token")

      // ① 사진 업로드
      setLoadingStep('upload')
      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('takenAt', new Date().toISOString())
      // 실제 GPS 좌표 사용 — GPS 실패 시 서울시청 폴백 좌표 사용
      formData.append('latitude', String(gpsCoords?.latitude ?? 37.5665))
      formData.append('longitude', String(gpsCoords?.longitude ?? 126.9780))
      if (text) formData.append('text', text)
      formData.append('emoji', MOOD_TYPES[selectedMood])
      formData.append('groupId', selectedRooms.join(','))

      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) throw new Error('업로드 실패')
      const result = await res.json()

      // ② VLM 결과 저장 + 결제 내역 매핑 (persona_transaction 생성)
      // VLM이 아직 분석 중이면 Promise가 resolve될 때까지 실제로 대기
      let finalVlmData = vlmData
      if (vlmLoading && vlmPromiseRef.current) {
        setLoadingStep('analyze')
        finalVlmData = await vlmPromiseRef.current  // 진짜로 완료까지 기다림
      }

      // 디버그: VLM 데이터 확인
      console.log('[VLM] finalVlmData:', finalVlmData)
      console.log('[VLM] photoId:', result.photoId)

      if (result.photoId && finalVlmData?.category) {
        try {
          const vlmSaveRes = await fetch(`/api/photos/${result.photoId}/vlm-result`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(finalVlmData),
          })
          // 디버그: VLM 저장 응답 확인
          const vlmSaveBody = await vlmSaveRes.json().catch(() => null)
          console.log('[VLM] 저장 응답 status:', vlmSaveRes.status, '| body:', vlmSaveBody)
        } catch (e) {
          console.error('[VLM] 저장 요청 실패:', e)
        }
      } else {
        console.warn('[VLM] skip 이유 — photoId:', result.photoId, '| category:', finalVlmData?.category)
      }

      navigate('/consumption-log', {
        state: {
          text,
          mood: MOOD_EMOJIS[selectedMood],
          imageUrl: result.imageUrl,
          selectedRooms: [],  // ← 빈 배열로 변경 (LoadingPage에서 전체 그룹 조회)
          photoId: result.photoId,
          imageFile,
        },
      })
    } catch (err) {
      alert('사진 업로드에 실패했어요. 다시 시도해주세요.')
      console.error(err)
    } finally {
      setIsLoading(false)
      setLoadingStep('')
    }
  }

  return (
    <main className="flex flex-col min-h-full bg-white">
      <StatusBar />

      <header className="px-5 py-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-2xl text-gray-800 leading-none w-8 h-8 flex items-center"
          aria-label="뒤로"
        >
          ‹
        </button>
      </header>

      <section className="flex-1 overflow-y-auto px-5 pb-8 space-y-6">
        <figure
          className="w-full aspect-square rounded-3xl bg-[#E8E8E8] m-0 relative flex flex-col justify-end items-center pb-6 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="선택한 사진"
              className="absolute inset-0 w-full h-full object-cover rounded-3xl"
            />
          ) : (
            <span className="relative flex items-center gap-8 text-2xl z-10">
              <span>⚡</span>
              <span>📷</span>
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageChange}
          />
        </figure>

        {/* GPS 위치 수집 상태 배지 — 로딩 중 또는 오류 시만 표시 */}
        {gpsLoading && (
          <div className="flex items-center gap-2 text-gray-500 text-[12px] px-1">
            <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>위치 정보를 가져오는 중...</span>
          </div>
        )}
        {gpsError && (
          <div className="flex items-center gap-2 text-amber-600 text-[12px] px-1">
            <span>⚠️</span>
            <span>{gpsError}</span>
          </div>
        )}

        {/* VLM 분석 결과 카드 — 사진 선택 직후 표시 */}
        {(vlmLoading || vlmData) && (
          <div className="rounded-2xl bg-[#F0F7FF] border border-sky-100 px-4 py-3">
            {vlmLoading ? (
              <div className="flex items-center gap-2 text-sky-500">
                <span className="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="text-[12px] font-medium">AI가 사진 분석 중...</span>
              </div>
            ) : (
              <>
                <p className="text-[11px] font-bold text-sky-600 mb-2">🤖 AI 분석 결과</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {vlmData.category && (
                    <div className="text-[11px] text-gray-600">
                      <span className="text-gray-400">카테고리</span>
                      <span className="block font-semibold text-gray-800">{vlmData.category}</span>
                    </div>
                  )}
                  {vlmData.item_name && (
                    <div className="text-[11px] text-gray-600">
                      <span className="text-gray-400">품목</span>
                      <span className="block font-semibold text-gray-800">{vlmData.item_name}</span>
                    </div>
                  )}
                  {vlmData.price && (
                    <div className="text-[11px] text-gray-600">
                      <span className="text-gray-400">추정 가격</span>
                      <span className="block font-semibold text-gray-800">{vlmData.price.toLocaleString()}원</span>
                    </div>
                  )}
                  {(vlmData.store_name || vlmData.location_type) && (
                    <div className="text-[11px] text-gray-600">
                      <span className="text-gray-400">장소</span>
                      <span className="block font-semibold text-gray-800">
                        {[vlmData.location_type, vlmData.store_name].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  )}
                  {vlmData.taken_at && (
                    <div className="text-[11px] text-gray-600">
                      <span className="text-gray-400">촬영 시각</span>
                      <span className="block font-semibold text-gray-800">{vlmData.taken_at}</span>
                    </div>
                  )}
                  {vlmData.address && (
                    <div className="text-[11px] text-gray-600 col-span-2">
                      <span className="text-gray-400">위치</span>
                      <span className="block font-semibold text-gray-800 line-clamp-1">{vlmData.address}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <label className="block text-left">
          <span className="text-[15px] font-bold text-gray-900 mb-2 block">텍스트</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="사진에 대해 설명해주세요!"
            className="w-full px-4 py-3.5 rounded-2xl bg-[#F0F0F0] border-0 text-[14px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
        </label>

        <section className="text-left">
          <p className="text-[15px] font-bold text-gray-900 mb-4">소비 기분</p>
          <ul className="flex justify-between list-none p-0 m-0 px-1">
            {MOOD_EMOJIS.map((emoji, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setSelectedMood(i)}
                  className={`text-[28px] transition-transform ${
                    selectedMood === i ? 'scale-110' : 'opacity-50'
                  }`}
                >
                  {emoji}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="text-left">
          <p className="text-[15px] font-bold text-gray-900 mb-3">모임 선택</p>
          <ul className="flex gap-3 overflow-x-auto list-none p-0 m-0 pb-1">
            {rooms.length === 0 ? (
              <p className="text-[13px] text-gray-400">모임이 없어요. 먼저 모임을 만들어주세요!</p>
            ) : (
              rooms.map((room) => {
                const checked = selectedRooms.includes(room.id)
                return (
                  <li key={room.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleRoom(room.id)}
                      className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#F0F0F0] min-w-[100px]"
                    >
                      <span className="text-[14px] font-bold text-[#3B82F6]">{room.label}</span>
                      <span
                        className={`w-5 h-5 rounded border-2 border-dashed flex items-center justify-center ${
                          checked ? 'border-[#3B82F6] bg-sky-50' : 'border-[#3B82F6]/50'
                        }`}
                      >
                        {checked && (
                          <span className="text-[10px] text-[#3B82F6] font-bold">✓</span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </section>

        <button
          type="button"
          onClick={handleNext}
          disabled={selectedRooms.length === 0 || !imageFile || isLoading}
          className="w-full py-3.5 rounded-2xl bg-[#38BDF8] text-white font-bold text-[15px] disabled:opacity-40 mt-2"
        >
          {isLoading
            ? (loadingStep === 'analyze' ? '분석 중...' : '업로드 중...')
            : '다음'}
        </button>
      </section>
    </main>
  )
}