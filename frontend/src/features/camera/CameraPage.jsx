import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import StatusBar from '../../common/components/StatusBar'
import heic2any from 'heic2any'
import exifr from 'exifr'

const MOOD_EMOJIS = ['☺️', '😭', '😮', '😍', '😡']
const MOOD_TYPES = ['HAPPY', 'SAD', 'SURPRISED', 'LOVE', 'ANGRY']

export default function CameraPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [text, setText] = useState('')
  const [selectedMood, setSelectedMood] = useState(0)
  const [selectedRooms, setSelectedRooms] = useState([])
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  // 고친 것
  const groupsFromState = location.state?.myGroups ?? []  // ← 먼저 선언
  const [rooms, setRooms] = useState(
    groupsFromState.map(g => ({ id: g.groupId, label: g.groupName }))
  )
  // VLM 분석 상태 — 사진 선택 즉시 백그라운드 분석

  const [vlmData, setVlmData] = useState(null)
  const [vlmLoading, setVlmLoading] = useState(false)
  const [gpsCoords, setGpsCoords] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState(null)
  const vlmPromiseRef = useRef(null)
  const fileInputRef = useRef(null)

 // 홈에서 group 정보 못 받아왔을때 groups api 호출해서 방 정보 가져오기
  useEffect(() => {
    if (groupsFromState.length > 0) return  // 이미 있으면 스킵
    
    // 없을 때만 API 호출
    const token = localStorage.getItem('token')
    fetch('/api/groups', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(groups => setRooms(groups.map(g => ({ id: g.groupId, label: g.groupName }))))
      .catch(() => {})
  }, [])

   // 컴포넌트 마운트 시 실제 기기 GPS 위치 요청
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError('이 기기는 위치 정보를 지원하지 않아요. 기본 위치로 대체합니다.')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        })
        setGpsLoading(false)
      },
      (err) => {
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
          return data
        }
        return null
      } catch {
        return null
      } finally {
        setVlmLoading(false)
      }
    })()

    vlmPromiseRef.current = promise
  }

  const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const ext = file.name.toLowerCase().split('.').pop()
    if (ext === 'heic' || ext === 'heif') {
      try {

        const blob = await heic2any({ blob: file, toType: 'image/jpeg' })
        const convertedFile = new File(
          [blob],
          file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'),
          { type: 'image/jpeg' }
        )
        setImageFile(convertedFile)
        setPreviewUrl(URL.createObjectURL(blob))
        runVlmAnalysis(file)  // ← 원본 HEIC 전송 (EXIF 있음)
      } catch {
        setImageFile(file)
        setPreviewUrl(null)
        runVlmAnalysis(file)
      }
    } else {
      setImageFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      runVlmAnalysis(file)
    }
  }

  const handleNext = async () => {
    if (selectedRooms.length === 0 || !imageFile) return

    setIsLoading(true)
    try {
      const token = localStorage.getItem("token")

      setLoadingStep('upload')

      // EXIF에서 촬영 시각 추출 — 여러 태그를 순서대로 탐색
      let takenAt = null
      try {
        const exif = await exifr.parse(imageFile)
        console.log("🔍 파일에서 찾아낸 전체 EXIF 데이터:", exif)
        if (exif) {
          const extractedDate = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate
          if (extractedDate) {
            takenAt = new Date(extractedDate).toISOString()
            console.log("✅ 최종 결정된 촬영 시간:", takenAt)
          }
        }
      } catch (error) {
        console.log("EXIF 데이터가 없거나 읽을 수 없습니다.", error)
      }

      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('takenAt', takenAt ?? new Date().toISOString())
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

      // ② VLM 결과 저장 (매핑은 일기 생성 시점으로 지연)
      let finalVlmData = vlmData
      if (vlmLoading && vlmPromiseRef.current) {
        setLoadingStep('analyze')
        finalVlmData = await vlmPromiseRef.current
      }

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
          const vlmSaveBody = await vlmSaveRes.json().catch(() => null)
          console.log('[VLM] 저장 응답 status:', vlmSaveRes.status, '| body:', vlmSaveBody)
        } catch (e) {
          console.error('[VLM] 저장 요청 실패:', e)
        }
      }

      navigate('/consumption-log', {
        state: {
          text,
          mood: MOOD_EMOJIS[selectedMood],
          imageUrl: result.imageUrl,
          selectedRooms: [],
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
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                  {vlmData.category && (
                    <div className="text-[11px] text-gray-600">
                      <span className="text-gray-400">카테고리</span>
                      <span className="block font-semibold text-gray-800">{vlmData.category}</span>
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
                  {vlmData.reasoning && (
                    <div className="text-[11px] text-gray-600 col-span-2">
                      <span className="text-gray-400">판단 근거</span>
                      <span className="block font-semibold text-gray-800">{vlmData.reasoning}</span>
                    </div>
                  )}
                  {vlmData._elapsed_ms && (
                    <div className="text-[11px] text-gray-600 col-span-2">
                      <span className="text-gray-400">응답 시간</span>
                      <span className="block font-semibold text-gray-800">{vlmData._elapsed_ms}ms</span>
                    </div>
                  )}
                </div>

                {vlmData.groups && vlmData.groups.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-sky-600 mb-1.5">📦 소비 그룹</p>
                    <div className="flex flex-col gap-2">
                      {vlmData.groups.map((group, i) => (
                        <div
                          key={i}
                          className="rounded-xl bg-white px-3 py-2 border border-sky-100"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-[#0073BC]">
                              #{group.group_id} {group.store ?? '가게 미상'}
                            </span>
                            <span className="text-[10px] font-bold text-gray-500">
                              {group.category}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {group.items.map((item, j) => (
                              <span
                                key={j}
                                className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#EBF5FF] text-[#0073BC]"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] font-semibold text-gray-700 text-right">
                            {group.price.toLocaleString()}원
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <label className="block text-left mt-2">
          <span className="text-[15px] font-bold text-gray-900 mb-2 block">텍스트</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="사진에 대해 설명해주세요!"
            maxLength={50}
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
          disabled={selectedRooms.length === 0 || !imageFile || isLoading || vlmLoading}
          className="w-full py-3.5 rounded-2xl bg-[#38BDF8] text-white font-bold text-[15px] disabled:opacity-40 mt-2"
        >
          {isLoading
            ? (loadingStep === 'analyze' ? '분석 중...' : '업로드 중...')
            : vlmLoading
              ? 'AI 분석 중...'
              : '다음'}
        </button>
      </section>
    </main>
  )
}