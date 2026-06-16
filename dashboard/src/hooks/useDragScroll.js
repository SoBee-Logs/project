import { useRef, useEffect } from 'react'

export function useDragScroll() {
  const ref = useRef(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)
  const hasMoved = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onMouseDown = (e) => {
      isDragging.current = true
      hasMoved.current = false
      startX.current = e.pageX - el.offsetLeft
      scrollLeft.current = el.scrollLeft
    }
    const onMouseMove = (e) => {
      if (!isDragging.current) return
      const dx = (e.pageX - el.offsetLeft) - startX.current
      if (Math.abs(dx) > 3) hasMoved.current = true
      el.scrollLeft = scrollLeft.current - dx
    }
    const onMouseUp = () => { isDragging.current = false }

    const startY = { current: 0 }
    const onTouchStart = (e) => {
      isDragging.current = true
      hasMoved.current = false
      startX.current = e.touches[0].pageX
      startY.current = e.touches[0].pageY
      scrollLeft.current = el.scrollLeft
    }
    const onTouchMove = (e) => {
      if (!isDragging.current) return
      const dx = e.touches[0].pageX - startX.current
      const dy = e.touches[0].pageY - startY.current
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 3) {
        hasMoved.current = true
        if (e.cancelable) e.preventDefault()
        el.scrollLeft = scrollLeft.current - dx
      }
    }
    const onTouchEnd = () => { isDragging.current = false }

    const onClickCapture = (e) => {
      if (hasMoved.current) { e.stopPropagation(); hasMoved.current = false }
    }

    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseup', onMouseUp)
    el.addEventListener('mouseleave', onMouseUp)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('click', onClickCapture, true)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('mouseleave', onMouseUp)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('click', onClickCapture, true)
    }
  }, [])

  return { ref }
}
