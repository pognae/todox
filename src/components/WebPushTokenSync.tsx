import { useEffect, useRef } from 'react'
import { syncWebPushToken } from '../pushWeb'

/**
 * 한 번 알림 권한을 허용하고 토큰을 등록한 뒤에도 FCM 토큰이 갱신되므로,
 * 앱 로드·주기·탭 포커스 시 서버(Supabase)에 조용히 재동기화합니다.
 */
export function WebPushTokenSync() {
  const busyRef = useRef(false)

  useEffect(() => {
    const run = async () => {
      if (busyRef.current) return
      if (typeof window === 'undefined' || !('Notification' in window)) return
      if (Notification.permission !== 'granted') return
      busyRef.current = true
      try {
        await syncWebPushToken({ requestPermission: false, force: false })
      } finally {
        busyRef.current = false
      }
    }

    void run()

    const sixHours = 6 * 60 * 60 * 1000
    const intervalId = window.setInterval(() => void run(), sixHours)

    let visTimer: number | null = null
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      if (visTimer !== null) window.clearTimeout(visTimer)
      visTimer = window.setTimeout(() => void run(), 1500)
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVis)
      if (visTimer !== null) window.clearTimeout(visTimer)
    }
  }, [])

  return null
}
