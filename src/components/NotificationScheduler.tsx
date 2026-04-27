import { useEffect, useRef } from 'react'
import { computeNextReminderDelayMs, markAndFireReminders } from '../notifications'
import { registerServiceWorker, tryRegisterBackgroundReminder, tryRegisterOneOffSync } from '../pwa'
import { useTodo } from '../TodoContext'

export function NotificationScheduler() {
  const { tasks, settings } = useTodo()
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    // 1) 정확한 시각 알림: 다음 알림 시각까지 setTimeout
    // 2) 폴백: 브라우저가 타이머를 지연시키는 경우를 대비해 30초 폴링도 유지
    const clearTimer = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const scheduleNext = () => {
      clearTimer()
      const delay = computeNextReminderDelayMs(tasks, settings)
      if (delay == null) return
      // setTimeout은 아주 긴 지연이 불안정할 수 있어 상한을 둠(최대 24h)
      const capped = Math.min(delay, 24 * 60 * 60 * 1000)
      timerRef.current = window.setTimeout(() => {
        markAndFireReminders(tasks, settings)
        scheduleNext()
      }, capped)
    }

    markAndFireReminders(tasks, settings)
    scheduleNext()
    const id = window.setInterval(() => {
      markAndFireReminders(tasks, settings)
      scheduleNext()
    }, 30_000)

    return () => {
      window.clearInterval(id)
      clearTimer()
    }
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

