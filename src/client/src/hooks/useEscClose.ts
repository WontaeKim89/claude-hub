import { useEffect } from 'react'

/**
 * ESC 키를 누르면 onClose를 호출하는 hook.
 * 모든 모달/팝업에서 사용.
 */
export function useEscClose(onClose: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
}
