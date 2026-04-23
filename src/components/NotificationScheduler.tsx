import { useEffect } from 'react'
import { markAndFireReminders } from '../notifications'
import { registerServiceWorker, tryRegisterBackgroundReminder, tryRegisterOneOffSync } from '../pwa'
import { useTodo } from '../TodoContext'

export function NotificationScheduler() {
  const { tasks, settings } = useTodo()

  useEffect(() => {
    // 최초 1회 + 이후 30초마다 체크 (앱이 열려 있을 때만 동작)
    markAndFireReminders(tasks, settings)
    const id = window.setInterval(() => {
      markAndFireReminders(tasks, settings)
    }, 30_000)
    return () => window.clearInterval(id)
  }, [tasks, settings])

  useEffect(() => {
    // 알림 설정이 켜져 있고 권한이 있는 경우: 백그라운드 스케줄 등록 시도
    if (!settings.notificationsEnabled) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    let cancelled = false
    ;(async () => {
      const reg = await registerServiceWorker()
      if (!reg || cancelled) return
      // 1) 주기 동기화(지원 브라우저)
      await tryRegisterBackgroundReminder(reg)
      // 2) 폴백: one-off sync
      await tryRegisterOneOffSync(reg)
    })()

    return () => {
      cancelled = true
    }
  }, [settings.notificationsEnabled])

  return null
}

