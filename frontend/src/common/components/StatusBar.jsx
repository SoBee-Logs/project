import { useState, useEffect } from 'react'

export default function StatusBar({ dark = false }) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }))
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header
      className={`flex items-center justify-between px-5 pt-2.5 pb-1 text-[15px] font-semibold tracking-tight ${
        dark ? 'text-white' : 'text-gray-900'
      }`}
    >
      <span>{time}</span>
      <span className="flex items-center gap-1.5">
        <span className={`flex items-end gap-0.5 ${dark ? 'opacity-90' : ''}`}>
          <span className="w-[3px] h-[6px] bg-current rounded-sm" />
          <span className="w-[3px] h-[8px] bg-current rounded-sm" />
          <span className="w-[3px] h-[11px] bg-current rounded-sm" />
          <span className="w-[3px] h-[14px] bg-current rounded-sm" />
        </span>
        <span
          className={`w-6 h-3 border rounded-sm relative ${
            dark ? 'border-white' : 'border-gray-900'
          }`}
        >
          <span
            className={`absolute inset-y-0.5 left-0.5 right-1 rounded-[1px] ${
              dark ? 'bg-white' : 'bg-gray-900'
            }`}
          />
        </span>
      </span>
    </header>
  )
}