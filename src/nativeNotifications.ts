import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { AppSettings, Task } from './types'
import { computeReminderAt, scheduledReminderKey } from './notifications'

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

function stableIdFromKey(key: string): number {
  // JS 문자열 해시(충돌 가능하지만 충분히 낮음)
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // LocalNotifications id는 int
  return Math.abs(h) % 2_000_000_000
}

function keyForTask(t: Task, settings: AppSettings): string | null {
  if (!t.dueDate) return null
  const hm = t.dueTime ?? settings.defaultReminderTime
  return scheduledReminderKey(t, hm)
}

export async function requestNativeNotificationPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!isNative()) return 'unsupported'
  try {
    const res = await LocalNotifications.requestPermissions()
    return res.display === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

export async function rescheduleNativeNotifications(tasks: Task[], settings: AppSettings): Promise<void> {
  if (!isNative()) return
  if (!settings.notificationsEnabled) {
    try {
      const pending = await LocalNotifications.getPending()
      const ids = (pending.notifications ?? []).map((n) => ({ id: n.id }))
      if (ids.length) await LocalNotifications.cancel({ notifications: ids })
    } catch {
      // ignore
    }
    return
  }

  const now = Date.now()
  const horizonMs = 14 * 24 * 60 * 60 * 1000 // 2주치만 스케줄(너무 멀면 OS가 정리/드랍 가능)

  const desired = new Map<number, { id: number; atMs: number; at: Date; title: string; body: string }>()
  for (const t of tasks) {
    if (!t || t.completed) continue
    const at = computeReminderAt(t, settings)
    if (!at) continue
    const atMs = at.getTime()
    if (atMs <= now) continue
    if (atMs > now + horizonMs) continue

    const key = keyForTask(t, settings)
    if (!key) continue
    const id = stableIdFromKey(key)
    desired.set(id, {
      id,
      atMs,
      at,
      title: 'todox 알림',
      body: t.title || '제목 없음',
    })
  }

  // pending과 desired를 비교해서 변경분만 반영 (전체 취소/재등록은 비효율적)
  let pendingIds: number[] = []
  try {
    const pending = await LocalNotifications.getPending()
    pendingIds = (pending.notifications ?? []).map((n) => n.id).filter((x): x is number => typeof x === 'number')
  } catch {
    pendingIds = []
  }

  const cancel: { id: number }[] = []
  for (const id of pendingIds) {
    if (!desired.has(id)) cancel.push({ id })
  }

  // time 변경 감지는 pending에서 schedule 정보를 못 얻는 경우가 많아서,
  // "desired에 없는 것만" 취소하고, desired 전체를 다시 schedule()로 등록(중복은 무시되는 편).
  // 하지만 일부 플랫폼에서 중복이 생길 수 있어, 기존 pending 중 desired에 있는 것들도 한 번 취소 후 재등록한다.
  const alsoCancelAndReschedule: { id: number }[] = []
  for (const id of pendingIds) {
    if (desired.has(id)) alsoCancelAndReschedule.push({ id })
  }

  const toCancel = [...cancel, ...alsoCancelAndReschedule]
  if (toCancel.length) {
    try {
      await LocalNotifications.cancel({ notifications: toCancel })
    } catch {
      // ignore
    }
  }

  if (desired.size === 0) return

  await LocalNotifications.schedule({
    notifications: [...desired.values()].map((x) => ({
      id: x.id,
      title: x.title,
      body: x.body,
      schedule: { at: x.at },
    })),
  })
}

