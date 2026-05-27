import { useNavigate } from 'react-router-dom'

export default function AppBar({ title }) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="flex-shrink-0 flex items-center h-14 px-4 bg-white border-b border-gray-100">
      <button
        onClick={handleBack}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="flex-1 text-center text-base font-semibold text-gray-800 -ml-8 pointer-events-none">
        {title}
      </span>
    </div>
  )
}