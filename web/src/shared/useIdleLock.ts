import { useEffect } from 'react'

// Không thao tác `minutes` phút → gọi onIdle (khoá màn hình về PIN, SPEC §4.1)
export function useIdleLock(minutes: number | null | undefined, onIdle: () => void) {
  useEffect(() => {
    if (!minutes) return
    let timer = window.setTimeout(onIdle, minutes * 60_000)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(onIdle, minutes * 60_000)
    }
    const events = ['pointerdown', 'keydown', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      window.clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [minutes, onIdle])
}
