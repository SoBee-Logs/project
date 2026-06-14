import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import heic2any from 'heic2any'
import exifr from 'exifr'
import cameraPageImg from '../../assets/camerapage.png'

const MOOD_EMOJIS = ['☺️', '😭', '😮', '😍', '😡']
const MOOD_TYPES = ['HAPPY', 'SAD', 'SURPRISED', 'LOVE', 'ANGRY']

async function correctOrientation(file, orientation) {
  if (!orientation || orientation === 1) return file
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const { width: w, height: h } = img
      const swap = orientation >= 5
      canvas.width  = swap ? h : w
      canvas.height = swap ? w : h
      const transforms = {
        2: () => { ctx.translate(w, 0); ctx.scale(-1, 1) },
        3: () => { ctx.translate(w, h); ctx.rotate(Math.PI) },
        4: () => { ctx.translate(0, h); ctx.scale(1, -1) },
        5: () => { ctx.rotate(0.5 * Math.PI); ctx.scale(1, -1) },
        6: () => { ctx.translate(h, 0); ctx.rotate(0.5 * Math.PI) },
        7: () => { ctx.translate(h, w); ctx.rotate(0.5 * Math.PI); ctx.scale(1, -1) },
        8: () => { ctx.translate(0, w); ctx.rotate(-0.5 * Math.PI) },
      }
      transforms[orientation]?.()
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', 0.95
      )
    }
    img.src = URL.createObjectURL(file)
  })
}

async function resizeImage(file, maxWidth = 1024) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', 0.85
      )
    }
    img.src = URL.createObjectURL(file)
  })
}

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
  const groupsFromState = location.state?.myGroups ?? []
  const [rooms, setRooms] = useState(
    groupsFromState.map(g => ({ id: g.groupId, label: g.groupName }))
  )
  const [vlmData, setVlmData] = useState(null)
  const [vlmLoading, setVlmLoading] = useState(false)
  const [gpsCoords, setGpsCoords] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState(null)
  const vlmPromiseRef = useRef(null)
  const fileInputRef = useRef(null)
  const albumInputRef = useRef(null)
  const originalFileRef = useRef(null)  // ← 원본 파일 저장용
  const hasUploaded = useRef(false)

  useEffect(() => {
    if (groupsFromState.length > 0) return
    const token = localStorage.getItem('token')
    fetch('/api/groups', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(groups => setRooms(groups.map(g => ({ id: g.groupId, label: g.groupName }))))
      .catch(() => {})
  }, [])

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

    originalFileRef.current = file  // ← 원본 저장 (EXIF 추출용)

    const exifData = await exifr.parse(file, ['Orientation']).catch(() => null)
    const orientation = exifData?.Orientation ?? 1

    const ext = file.name.toLowerCase().split('.').pop()
    if (ext === 'heic' || ext === 'heif') {
      try {
        const blob = await heic2any({ blob: file, toType: 'image/jpeg' })
        const convertedFile = new File(
          [blob],
          file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'),
          { type: 'image/jpeg' }
        )
        const corrected = await correctOrientation(convertedFile, orientation)
        setImageFile(corrected)
        setPreviewUrl(URL.createObjectURL(corrected))
        runVlmAnalysis(corrected)
      } catch {
        setImageFile(file)
        setPreviewUrl(null)
        runVlmAnalysis(file)
      }
    } else {
      const corrected = await correctOrientation(file, orientation)
      const resized = await resizeImage(corrected)
      setImageFile(resized)
      setPreviewUrl(URL.createObjectURL(resized))
      runVlmAnalysis(resized)
    }
  }

  const handleNext = async () => {
    if (hasUploaded.current) return
    hasUploaded.current = true

    if (selectedRooms.length === 0 || !imageFile) return

    setIsLoading(true)
    try {
      const token = localStorage.getItem("token")
      setLoadingStep('upload')

      // EXIF는 원본 파일에서 추출 — resized 파일은 EXIF 없음
      let takenAt = null
      try {
        const sourceFile = originalFileRef.current ?? imageFile
        const exif = await exifr.parse(sourceFile)
        console.log("🔍 원본 파일 EXIF 데이터:", exif)
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
          selectedRooms,
          photoId: result.photoId,
          imageFile,
          myGroups: rooms.map(r => ({ groupId: r.id, groupName: r.label })),
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
      <header className="px-5 pt-1 pb-3 shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-8 h-8 -ml-2 text-gray-800"
          aria-label="뒤로가기"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </header>

      <section className="flex-1 overflow-y-auto px-5 pb-8 space-y-6">
        <figure
          className={`w-full rounded-[28px] m-0 relative overflow-hidden ${
            previewUrl ? 'bg-gray-100' : ''
          }`}
          style={{
            height: '300px',
            background: previewUrl
              ? '#F3F4F6'
              : 'linear-gradient(180deg, #F3F8FF 0%, #EAF3FF 100%)',
            border: previewUrl ? '0' : '1.5px solid #DCEBFF',
            boxShadow: previewUrl
              ? 'none'
              : '0 8px 22px rgba(31, 122, 244, 0.08)',
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="선택한 사진"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageChange}
              />

              <img
                src={cameraPageImg}
                alt="카메라"
                className="w-[118px] h-auto object-contain mb-1"
              />

              <p
                className="m-0 text-[17px] font-extrabold tracking-[-0.4px]"
                style={{ color: '#0F2A4D' }}
              >
                소비 사진 찍기
              </p>

              <p
                className="mt-2 mb-5 text-[12px] font-medium text-center leading-snug tracking-[-0.3px]"
                style={{ color: '#7B8BA3' }}
              >
                오늘의 소비 순간을<br />
                카메라로 기록해보세요
              </p>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-[44px] px-7 rounded-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                style={{
                  minWidth: '220px',
                  background: '#2F7DF6',
                  color: '#FFFFFF',
                  boxShadow: '0 8px 18px rgba(47, 125, 246, 0.25)',
                }}
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.4-1.8A2 2 0 0 1 11 3.5h2a2 2 0 0 1 1.6.7L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
                  <circle cx="12" cy="12.5" r="3.2" />
                </svg>

                <span className="text-[14px] font-extrabold tracking-[-0.3px]">
                  카메라 열기
                </span>
              </button>
            </div>
          )}
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
          <div className="mt-2">
            <div className="relative">
              <div
                className="rounded-2xl bg-[#F0F7FF] border border-sky-100 px-4 pt-2 pb-3 overflow-hidden"
                style={{
                  maxHeight: vlmLoading ? '44px' : '400px',
                  transition: 'max-height 0.5s ease-out',
                }}
              >
                {vlmLoading && (
                  <div className="flex items-center gap-2.5 text-sky-500 pl-2">
                    <span className="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span className="text-[12px] font-medium translate-y-px">AI가 사진 분석 중...</span>
                  </div>
                )}
                {vlmData && (
                  <>
                    <p className="text-[11px] font-bold text-sky-600 mb-2 mt-1">🤖 AI가 분석한 소비 항목</p>
                    {vlmData.groups && vlmData.groups.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const counts = vlmData.groups.flatMap(g => g.items)
                            .reduce((acc, item) => { acc[item] = (acc[item] || 0) + 1; return acc }, {})
                          return Object.entries(counts).map(([item, count], i) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-sky-100 text-[#0073BC] font-semibold">
                              {item}{count > 1 ? `×${count}` : ''}
                            </span>
                          ))
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <label className="block text-left mt-4">
          <span className="text-[15px] font-bold text-gray-900 mb-2 block">텍스트</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="사진에 대해 설명해주세요!"
            maxLength={50}
            className="w-full px-4 py-2.5 rounded-2xl border text-[14px] text-gray-700 placeholder:text-[#8EA4C2] focus:outline-none focus:ring-2 focus:ring-[#BBD8FF]"
            style={{
              background: '#F3F8FF',
              borderColor: '#DCEBFF',
            }}
          />
        </label>

        <section className="text-left">
          <p className="text-[15px] font-bold text-gray-900 mb-4">소비 기분</p>
          <ul className="flex justify-between list-none p-0 m-0">
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
                      className="flex items-center gap-2 px-4 py-3 rounded-2xl border min-w-[100px]"
                      style={{
                        background: checked ? '#E7F1FF' : '#F3F8FF',
                        borderColor: checked ? '#8CBFFF' : '#DCEBFF',
                        boxShadow: checked
                          ? '0 4px 12px rgba(31, 122, 224, 0.10)'
                          : 'none',
                      }}
                    >
                      <span
                        className="text-[14px] font-bold"
                        style={{ color: '#1F7AE0' }}
                      >
                        {room.label}
                      </span>

                      <span
                        className="w-5 h-5 rounded-md border-2 border-dashed flex items-center justify-center"
                        style={{
                          borderColor: checked ? '#1F7AE0' : 'rgba(31, 122, 224, 0.45)',
                          background: checked ? '#FFFFFF' : 'transparent',
                        }}
                      >
                        {checked && (
                          <span className="text-[10px] text-[#1F7AE0] font-bold">✓</span>
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
          className="w-full py-3.5 rounded-2xl bg-[#2F7DF6] text-white font-bold text-[15px] disabled:opacity-40 mt-2"
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