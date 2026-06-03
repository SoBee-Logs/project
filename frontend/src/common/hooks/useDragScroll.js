import { useRef, useState } from 'react'

export function useDragScroll() {
  const ref = useRef(null)
  const isDraggingRef = useRef(false)
  const hasMoved = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)
  const [dragging, setDragging] = useState(false)

  const onMouseDown = (e) => {
    isDraggingRef.current = true
    hasMoved.current = false
    setDragging(true)
    startX.current = e.pageX - ref.current.offsetLeft
    scrollLeft.current = ref.current.scrollLeft
  }

  const onMouseMove = (e) => {
    if (!isDraggingRef.current) return
    e.preventDefault()
    const x = e.pageX - ref.current.offsetLeft
    const dx = x - startX.current
    if (Math.abs(dx) > 5) hasMoved.current = true
    ref.current.scrollLeft = scrollLeft.current - dx
  }

  const stopDrag = () => {
    isDraggingRef.current = false
    setDragging(false)
  }

  const onClickCapture = (e) => {
    if (hasMoved.current) {
      e.stopPropagation()
      hasMoved.current = false
    }
  }

  return { ref, dragging, onMouseDown, onMouseMove, onMouseUp: stopDrag, onMouseLeave: stopDrag, onClickCapture }
}
