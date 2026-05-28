import { useRef, useState } from 'react'

export function useDragScroll() {
  const ref = useRef(null)
  const isDraggingRef = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)
  const [dragging, setDragging] = useState(false)

  const onMouseDown = (e) => {
    isDraggingRef.current = true
    setDragging(true)
    startX.current = e.pageX - ref.current.offsetLeft
    scrollLeft.current = ref.current.scrollLeft
  }

  const onMouseMove = (e) => {
    if (!isDraggingRef.current) return
    e.preventDefault()
    const x = e.pageX - ref.current.offsetLeft
    ref.current.scrollLeft = scrollLeft.current - (x - startX.current)
  }

  const stopDrag = () => {
    isDraggingRef.current = false
    setDragging(false)
  }

  return { ref, dragging, onMouseDown, onMouseMove, onMouseUp: stopDrag, onMouseLeave: stopDrag }
}
