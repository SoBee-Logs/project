export default function StatusBar({ dark = false }) {
  return (
    <header
      className={`flex items-center justify-between px-5 pt-2.5 pb-1 text-[15px] font-semibold tracking-tight ${
        dark ? 'text-white' : 'text-gray-900'
      }`}
    >
      <span>9:41</span>
      <span className="flex items-center gap-1.5">
        <span className={`flex gap-0.5 ${dark ? 'opacity-90' : ''}`}>
          <span className="w-[3px] h-[10px] bg-current rounded-sm" />
          <span className="w-[3px] h-[12px] bg-current rounded-sm" />
          <span className="w-[3px] h-[14px] bg-current rounded-sm" />
          <span className="w-[3px] h-[10px] bg-current rounded-sm" />
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
