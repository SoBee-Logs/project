import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { jwtDecode } from 'jwt-decode'
import calendarIcon from '../../assets/calendar_icon.png'


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
  const myGroups = location.state?.myGroups ?? []
  const [photos, setPhotos] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCalendar, setShowCalendar] = useState(false)
  const [openGroupPhotoId, setOpenGroupPhotoId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(new Date()))
  const [tempDate, setTempDate] = useState(new Date())
  const [joinedAt, setJoinedAt] = useState(null)
  const isToday = selectedDate === toLocalDateStr(new Date())

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  // 가입일 fetch — 달력 minDate 설정용
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    let userId
    try {
      userId = jwtDecode(token).sub
    } catch {
      return
    }
    fetch(`/api/users/${userId}/persona`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.createdAt) {
          // 시간 부분 제거 후 Date 객체 생성
          setJoinedAt(new Date(data.createdAt.substring(0, 10) + 'T00:00:00'))
        }
      })
      .catch(() => {})
  }, [])

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
    const date = new Date(2000, 0, 1, hour, minute, 0)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

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

  const getGroupNames = (groupIds) => {
    if (!Array.isArray(groupIds)) return []

    return groupIds
      .map((gid) => {
        const group = myGroups.find((g) => Number(g.groupId) === Number(gid))
        return group ? group.groupName : null
      })
      .filter(Boolean)
  }

  const handleDateChange = (date) => {
    if (date > today) return
    setTempDate(date)
  }

  const handleConfirmDate = () => {
    setSelectedDate(toLocalDateStr(tempDate))
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
      <header className="px-5 pt-2 pb-3 shrink-0">
        <div className="flex items-center gap-2 mb-2">
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
          <p className="text-[14px] font-semibold text-gray-900 m-0 mt-0.5 leading-snug">
            나의 소비 로그
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setTempDate(new Date(selectedDate + 'T00:00:00'))
            setShowCalendar(true)
          }}
          className="mt-2 flex items-center rounded-full border"
          style={{
            width: 'fit-content',
            padding: '5px 14px 5px 10px',
            gap: '10px',
            background: '#F3F8FF',
            borderColor: '#DCEBFF',
            boxShadow: '0 4px 12px rgba(31, 122, 224, 0.06)',
          }}
        >
          <img
            src={calendarIcon}
            alt="날짜 선택"
            className="w-[28px] h-[28px] object-contain shrink-0"
          />

          <span
            style={{
              width: '1px',
              height: '20px',
              background: '#D6E8FF',
              flexShrink: 0,
            }}
          />

          <span
            className="text-[12px] font-semibold"
            style={{
              color: '#253858',
              letterSpacing: '-0.3px',
              whiteSpace: 'nowrap',
            }}
          >
            {toKoreanLabel(selectedDate)}
          </span>
        </button>
      </header>

      {showCalendar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0, 0, 0, 0.42)' }}
          onClick={() => setShowCalendar(false)}
        >
          <div
            className="calendar-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="calendar-modal-header">
              <div className="calendar-title-wrap">
                <div className="calendar-icon">
                  <img
                    src={calendarIcon}
                    alt="날짜 선택"
                    className="w-[40px] h-[40px] object-contain"
                  />
                </div>
                <div>
                  <h2 className="calendar-title">날짜 선택</h2>
                  <p className="calendar-desc">
                    소비 로그를 확인할 날짜를 선택하세요
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="calendar-close"
                onClick={() => setShowCalendar(false)}
                aria-label="닫기"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M18 6L6 18" />
                  <path d="M6 6L18 18" />
                </svg>
              </button>
            </div>

            <Calendar
              onChange={handleDateChange}
              value={tempDate}
              maxDate={new Date()}
              minDate={joinedAt ?? undefined}
              locale="ko-KR"
              calendarType="gregory"
              formatDay={(locale, date) => date.getDate()}
              prev2Label={null}
              next2Label={null}
              prevLabel={
                <svg
                  className="calendar-arrow-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18L9 12L15 6" />
                </svg>
              }
              nextLabel={
                <svg
                  className="calendar-arrow-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18L15 12L9 6" />
                </svg>
              }
              navigationLabel={({ date }) => (
                <span className="calendar-month-label">
                  {date.getFullYear()}년 {date.getMonth() + 1}월
                </span>
              )}
            />

            <div className="calendar-actions">
              <button
                type="button"
                className="calendar-cancel"
                onClick={() => setShowCalendar(false)}
              >
                취소
              </button>

              <button
                type="button"
                className="calendar-confirm"
                onClick={handleConfirmDate}
              >
                선택 완료
              </button>
            </div>
          </div>

          <style>{`
            .calendar-modal {
              width: 100%;
              max-width: 340px;
              background: #FFFFFF;
              border-radius: 28px;
              padding: 24px 22px 22px;
              box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
            }

            .calendar-modal-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              margin-bottom: 22px;
            }

            .calendar-title-wrap {
              display: flex;
              align-items: flex-start;
              gap: 10px;
            }

            .calendar-icon {
              width: 45px;
              height: 45px;
              border-radius: 12px;
              background: #EBF5FF;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }

            .calendar-title {
              margin: 0;
              font-size: 22px;
              font-weight: 800;
              color: #111827;
              line-height: 1.15;
              letter-spacing: -0.8px;
            }

            .calendar-desc {
              margin: 8px 0 0;
              font-size: 12px;
              font-weight: 500;
              color: #6B7280;
              line-height: 1.3;
              letter-spacing: -0.3px;
            }

            .calendar-close {
              width: 38px;
              height: 38px;
              border: 0;
              border-radius: 18px;
              background: #F3F6FA;
              color: #7B8494;
              font-size: 30px;
              line-height: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              padding: 0;
              transform: translateY(0);
            }

            .calendar-modal .react-calendar {
              width: 100%;
              border: none;
              font-family: inherit;
              background: transparent;
            }

            .calendar-modal .react-calendar__navigation {
              height: 54px;
              display: grid;
              grid-template-columns: 50px 1fr 50px;
              align-items: center;
              margin-bottom: 12px;
            }

            .calendar-modal .react-calendar__navigation button {
              min-width: 0;
              height: 44px;
              border: none;
              border-radius: 14px;
              background: #EEF6FF;
              color: #93C5FD;
              font-size: 22px;
              font-weight: 800;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0;
            }

            .calendar-arrow {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              height: 100%;
              font-size: 24px;
              font-weight: 800;
              line-height: 1;
              transform: translateY(-1px);
            }

            .calendar-modal .react-calendar__navigation button:enabled:hover,
            .calendar-modal .react-calendar__navigation button:enabled:focus {
              background: #DBEAFE;
            }

            .calendar-modal .react-calendar__navigation button:disabled {
              background: #F5F7FA;
              color: #CBD5E1;
            }

            .calendar-modal .react-calendar__navigation__label {
              background: transparent !important;
              color: #111827 !important;
              pointer-events: none;
            }

            .calendar-month-label {
              font-size: 21px;
              font-weight: 800;
              color: #111827;
              letter-spacing: -0.7px;
            }

            .calendar-modal .react-calendar__month-view__weekdays {
              margin-bottom: 8px;
            }

            .calendar-modal .react-calendar__month-view__weekdays__weekday {
              padding: 0;
              text-align: center;
              font-size: 13px;
              font-weight: 800;
              color: #6B7280;
            }

            .calendar-modal .react-calendar__month-view__weekdays__weekday abbr {
              text-decoration: none;
            }

            .calendar-modal .react-calendar__month-view__weekdays__weekday:first-child {
              color: #EF4444;
            }

            .calendar-modal .react-calendar__month-view__weekdays__weekday:last-child {
              color: #93C5FD;
            }

            .calendar-modal .react-calendar__month-view__days {
              row-gap: 6px;
            }

            .calendar-modal .react-calendar__tile {
              height: 44px;
              padding: 0;
              background: transparent;
              border: none;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #111827;
              font-size: 15px;
              font-weight: 700;
            }

            .calendar-modal .react-calendar__tile abbr {
              width: 36px;
              height: 36px;
              border-radius: 9999px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #FFFFFF;
              border: 1.5px solid #DBEAFE;
              box-shadow: 0 2px 8px rgba(147, 197, 253, 0.15);
            }

            .calendar-modal .react-calendar__tile:enabled:hover,
            .calendar-modal .react-calendar__tile:enabled:focus {
              background: transparent;
            }

            .calendar-modal .react-calendar__tile:enabled:hover abbr,
            .calendar-modal .react-calendar__tile:enabled:focus abbr {
              background: #EEF6FF;
              color: #60A5FA;
              border-color: #BFDBFE;
            }

            .calendar-modal .react-calendar__tile--active {
              background: transparent !important;
            }

            .calendar-modal .react-calendar__tile--active abbr {
              background: #00BFFF !important;
              color: #FFFFFF !important;
              border-color: #00BFFF !important;
              box-shadow: 0 8px 18px rgba(0, 191, 255, 0.35);
            }

            .calendar-modal .react-calendar__tile--now {
              background: transparent;
            }

            .calendar-modal .react-calendar__tile--now abbr {
              border-color: #BFDBFE;
              color: #60A5FA;
            }

            .calendar-modal .react-calendar__month-view__days__day--neighboringMonth abbr {
              background: transparent !important;
              border: 1.5px solid transparent !important;
              box-shadow: none !important;
              color: #CBD5E1 !important;
            }

            .calendar-modal .react-calendar__month-view__days__day--weekend {
              color: #111827;
            }

            .calendar-modal .react-calendar__month-view__days__day--weekend:nth-child(7n + 1) {
              color: #EF4444;
            }

            .calendar-modal .react-calendar__month-view__days__day--weekend:nth-child(7n) {
              color: #93C5FD;
            }

            .calendar-modal .react-calendar__tile:disabled abbr {
              background: #F3F5F7 !important;
              color: #C1C7D0 !important;
              border-color: #F3F5F7 !important;
              box-shadow: none !important;
            }

            .calendar-actions {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-top: 22px;
            }

            .calendar-cancel,
            .calendar-confirm {
              height: 54px;
              border: none;
              border-radius: 22px;
              font-size: 15px;
              font-weight: 800;
              cursor: pointer;
            }

            .calendar-cancel {
              background: #F3F5F7;
              color: #334155;
            }

            .calendar-confirm {
              background: #00BFFF;
              color: #FFFFFF;
              box-shadow: 0 8px 18px rgba(0, 191, 255, 0.3);
            }
          `}</style>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-[140px] relative">
        {photos.length > 0 && (
          <span
            className="absolute left-[108px] top-2 bottom-4 w-[1.5px] bg-gray-200 rounded-full"
            aria-hidden
          />
        )}

        {isLoading ? (
          <p className="text-center text-gray-400 text-[13px] mt-10">불러오는 중...</p>
        ) : photos.length === 0 ? (
          <p className="text-center text-gray-400 text-[13px] mt-10">
            해당 날짜의 소비 로그가 없어요
          </p>
        ) : (
          <ul className="list-none m-0 p-0 pb-4">
            {photos.map((photo) => {
              const groups = getGroupNames(photo.group)
              const firstGroup = groups[0]
              const extraCount = Math.max(groups.length - 1, 0)
              const isGroupOpen = openGroupPhotoId === photo.id

              return (
                <li key={photo.id} className="flex gap-0 mb-6 relative items-start">
                  <div className="w-[90px] shrink-0 text-left pt-1">
                    <span className="block text-[12px] font-semibold text-gray-900 leading-tight">
                      {toKoreanTime(photo.time)}
                    </span>
                    <span className="block text-[18px] mt-1">{photo.emoji}</span>

                    {groups.length > 0 && (
                      <div className="relative mt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenGroupPhotoId((prev) => (prev === photo.id ? null : photo.id))
                          }
                          className="inline-flex items-center justify-center rounded-full border"
                          style={{
                            width: 'fit-content',
                            padding: '3px 6px',
                            gap: '3px',
                            background: '#F3F8FF',
                            borderColor: '#DCEBFF',
                            color: '#1F5FAE',
                            boxShadow: isGroupOpen
                              ? '0 4px 10px rgba(31, 122, 224, 0.10)'
                              : 'none',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              letterSpacing: '-0.3px',
                              lineHeight: 1.1,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {firstGroup}
                          </span>

                          {extraCount > 0 && (
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 800,
                                lineHeight: 1,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              +{extraCount}
                            </span>
                          )}

                          {groups.length > 1 && (
                            <svg
                              width="9"
                              height="9"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{
                                flexShrink: 0,
                                transform: isGroupOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.16s ease',
                              }}
                            >
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          )}
                        </button>

                        {isGroupOpen && groups.length > 1 && (
                          <div
                            className="absolute left-0 top-[28px] z-20 rounded-2xl border bg-white"
                            style={{
                              width: '92px',
                              padding: '6px',
                              borderColor: '#DCEBFF',
                              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.10)',
                            }}
                          >
                            {groups.map((groupName, i) => (
                              <div
                                key={`${photo.id}-${groupName}-${i}`}
                                className="flex items-center gap-1.5"
                                style={{
                                  padding: '5px 3px',
                                  borderBottom:
                                    i === groups.length - 1 ? 'none' : '1px solid #EEF4FF',
                                }}
                              >
                                <span
                                  className="flex items-center justify-center shrink-0"
                                  style={{
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '5px',
                                    background: '#EBF5FF',
                                    color: '#1F7AE0',
                                  }}
                                >
                                  <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M4 10.5L12 4l8 6.5" />
                                    <path d="M6.5 9.5V20h11V9.5" />
                                    <path d="M10 20v-5h4v5" />
                                  </svg>
                                </span>

                                <span
                                  className="truncate"
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    color: '#253858',
                                    letterSpacing: '-0.3px',
                                  }}
                                >
                                  {groupName}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
                    {/* 수정: 텍스트 굵기 강화 */}
                    {photo.text && (
                      <p className="text-[12px] font-medium text-gray-600 mt-1.5 mb-0 leading-relaxed line-clamp-2 whitespace-pre-wrap break-words break-keep">
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
          // TODO: 테스트 완료 후 disabled={!isToday} 로 되돌리기
          disabled={false}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white text-[14px] font-bold bg-[#00BFFF]"
        >
          <span className="text-[11px]">▶</span> LLM 일기 생성
        </button>
      </footer>
    </main>
  )
}