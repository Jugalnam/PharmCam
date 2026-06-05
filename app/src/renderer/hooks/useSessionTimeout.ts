import { useEffect } from 'react'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const
const THROTTLE_MS = 30_000

export function useSessionTimeout(isLoggedIn: boolean): void {
  useEffect(() => {
    if (!isLoggedIn) {
      return
    }

    let lastTouch = 0

    const touch = (): void => {
      const now = Date.now()
      if (now - lastTouch < THROTTLE_MS) {
        return
      }
      lastTouch = now
      window.api.auth.touchActivity().catch(() => {})
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, touch, { passive: true })
    }

    const interval = window.setInterval(() => {
      window.api.auth.currentUser().then((user) => {
        if (!user) {
          window.location.reload()
        }
      })
    }, 60_000)

    touch()

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, touch)
      }
      window.clearInterval(interval)
    }
  }, [isLoggedIn])
}
