import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import StatusBar from '../../common/components/StatusBar'


const toLocalDateStr = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function ConsumptionLog() {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedRooms = location.state?.selectedRooms ?? []
  const [photos, setPhotos] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(new Date()))
  const [myGroups, setMyGroups] = useState([])
  const isToday = selectedDate === toLocalDateStr(new Date())

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const toKoreanLabel = (dateStr) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const toKoreanTime = (timeStr) => {
    if (!timeStr) return ''
    const [hour, minute] = timeStr.split(':').map(Number)
    const date = new Date()
    date.setUTCHours(hour, minute, 0, 0)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  useEffect(() => {
    const fetchMyGroups = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) return
        const res = await fetch('/api/groups', {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        const data = await res.json()
        setMyGroups(data)
      } catch (err) {
        console.error('모임 목록 조회 실패', err)
      }
    }
    fetchMyGroups()
  }, [])

  useEffect(() => {
    const fetchPhotos = async () => {
      setIsLoading(true)
      try {
        const token = localStorage.getItem("token")
        const res = await fetch(`/api/photos?date=${selectedDate}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('조회 실패')
        const data = await res.json()
        setPhotos([...(data.photos ?? [])].reverse())
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchPhotos()
  }, [selectedDate])

  const getGroupHashtags = (groupIds) => {
    return groupIds
      .map((gid) => {
        const group = myGroups.find((g) => Number(g.groupId) === Number(gid))
        return group ? `#${group.groupName}` : null
      })
      .filter(Boolean)
  }

  const handleDateChange = (date) => {
    setSelectedDate(toLocalDateStr(date))
    setShowCalendar(false)
  }

  const handleGenerate = () => {
    navigate('/loading', {
      state: {
        ...location.state,
        selectedRooms,
      },
    })
  }

  return (
    <main className="flex flex-col min-h-full bg-white">
      <StatusBar />

      <header className="px-5 pt-1 pb-3 text-left shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-8 h-8 -ml-1 mb-2 text-gray-800"
          aria-label="뒤로가기"
        >
          <span className="text-[22px] leading-none">‹</span>
        </button>
        <p className="text-[13px] font-semibold text-gray-900 m-0 leading-snug">
          나의 소비 로그
        </p>
        <button
          type="button"
          onClick={() => setShowCalendar(true)}
          className="mt-1.5 inline-flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1 border border-gray-200"
        >
          <span className="text-[11px]">📅</span>
          <span className="text-[11px] text-gray-500">{toKoreanLabel(selectedDate)}</span>
        </button>
      </header>

      {showCalendar && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6"
          onClick={() => setShowCalendar(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-[340px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[15px] font-bold text-gray-900 mb-4 text-center">📅 날짜 선택</p>
            <Calendar
              onChange={handleDateChange}
              value={new Date(selectedDate + 'T00:00:00')}
              maxDate={today}
              locale="ko-KR"
              calendarType="gregory"
            />
            <button
              type="button"
              onClick={() => setShowCalendar(false)}
              className="w-full mt-4 py-3 rounded-2xl bg-gray-100 text-[13px] text-gray-600 font-semibold"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-[140px] relative">
        <span
          className="absolute left-[75px] top-2 bottom-4 w-[1.5px] bg-gray-200 rounded-full"
          aria-hidden
        />

        {isLoading ? (
          <p className="text-center text-gray-400 text-[13px] mt-10">불러오는 중...</p>
        ) : photos.length === 0 ? (
          <p className="text-center text-gray-400 text-[13px] mt-10">
            해당 날짜의 소비 로그가 없어요
          </p>
        ) : (
          <ul className="list-none m-0 p-0 pb-4">
            {photos.map((photo) => {
              const tags = getGroupHashtags(photo.group)
              return (
                <li key={photo.id} className="flex gap-0 mb-6 relative items-start">
                  <div className="w-[58px] shrink-0 text-left pt-1">
                    <span className="block text-[12px] font-semibold text-gray-900 leading-tight">
                      {toKoreanTime(photo.time)}
                    </span>
                    <span className="block text-[18px] mt-1">{photo.emoji}</span>
                    <span className="block text-[10px] text-[#185FA5] mt-1 leading-relaxed break-keep">
                      {tags.join(' ')}
                    </span>
                  </div>

                  <div className="w-[18px] shrink-0 flex justify-center pt-[5px]">
                    <span className="w-2 h-2 rounded-full bg-[#00BFFF] border-2 border-white z-10 block" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <figure className={`m-0 rounded-xl overflow-hidden aspect-[5/3] bg-gray-100 relative ${photo.mapped ? 'border-2 border-emerald-400' : 'border border-gray-200'}`}>
                      <img
                        src={photo.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {photo.mapped ? (
                        <span className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                          💳 매핑됨
                        </span>
                      ) : (
                        <span className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-gray-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                          🔍 미매핑
                        </span>
                      )}
                    </figure>
                    {photo.text && (
                      <p className="text-[11px] text-gray-500 mt-1.5 mb-0 leading-relaxed line-clamp-2">
                        {photo.text}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[375px] px-5 py-3 bg-white border-t border-gray-100 z-10">
        {!isToday && (
          <p className="text-center text-[11px] text-gray-400 mb-2">
            과거 날짜의 일기는 생성할 수 없어요
          </p>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!isToday}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white text-[14px] font-bold ${
            isToday ? 'bg-[#00BFFF]' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          <span className="text-[11px]">▶</span> LLM 일기 생성
        </button>
      </footer>
    </main>
  )
}