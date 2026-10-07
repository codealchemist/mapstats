import { useEffect } from 'react'

// While `open`, a pointer down outside `ref` or Escape calls onClose (popovers, menus).
export function useDismiss(ref, open, onClose) {
  useEffect(() => {
    if (!open) return
    const onPointer = (e) => !ref.current?.contains(e.target) && onClose()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); window.removeEventListener('keydown', onKey) }
  }, [ref, open, onClose])
}
