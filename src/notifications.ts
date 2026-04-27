import { parseISODate, todayISO } from './dateUtils'
import type { AppSettings, Task } from './types'

const REMINDED_KEY = 'todox-reminded-v1'

type RemindedMap = Record<string, number>

function loadReminded(): RemindedMap {
  try {
    const raw = localStorage.getItem(REMINDED_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as RemindedMap
  } catch {
    return {}
  }
}

function saveReminded(m: RemindedMap): void {
  localStorage.setItem(REMINDED_KEY, JSON.stringify(m))
}

function cleanupReminded(m: RemindedMap, now: number): RemindedMap {
  const week = 7 * 24 * 60 * 60 * 1000
  const next: RemindedMap = {}
  for (const [k, ts] of Object.entries(m)) {
    if (now - ts <= week) next[k] = ts
  }
  return next
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

function parseHM(hm: string): { h: number; m: number } | null {
  const [hs, ms] = hm.split(':')
  const h = Number(hs)
  const m = Number(ms)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return { h, m }
}

export function scheduledReminderKey(task: Task, hm: string): string {
  return `${task.id}:${task.dueDate ?? ''}:${hm}`
}

export function computeReminderAt(task: Task, settings: AppSettings): Date | null {
  if (!task.dueDate) return null
  const hm = task.dueTime ?? settings.defaultReminderTime
  const parsed = parseHM(hm)
  if (!parsed) return null
  const d = parseISODate(task.dueDate)
  d.setHours(parsed.h, parsed.m, 0, 0)
  return d
}

export function shouldFireReminder(now: Date, task: Task, settings: AppSettings): { key: string } | null {
  if (task.completed) return null
  if (!task.dueDate) return null

  const hm = task.dueTime ?? settings.defaultReminderTime
  const at = computeReminderAt(task, settings)
  if (!at) return null

  const delta = now.getTime() - at.getTime()
  // 앱을 늦게 열었을 때 너무 오래 지난 알림은 건너뜀(1시간)
  if (delta < 0 || delta > 60 * 60 * 1000) return null

  return { key: scheduledReminderKey(task, hm) }
}

export function computeNextReminderDelayMs(tasks: Task[], settings: AppSettings): number | null {
  if (!settings.notificationsEnabled) return null
  const perm = getNotificationPermission()
  if (perm !== 'granted') return null

  const now = new Date()
  const nowMs = now.getTime()
  const reminded = cleanupReminded(loadReminded(), nowMs)

  let bestAt: number | null = null
  for (const t of tasks) {
    if (!t || t.completed || !t.dueDate) continue
    const hm = t.dueTime ?? settings.defaultReminderTime
    const key = scheduledReminderKey(t, hm)
    if (reminded[key]) continue

    const at = computeReminderAt(t, settings)
    if (!at) continue
    const atMs = at.getTime()
    if (atMs <= nowMs) continue
    if (bestAt === null || atMs < bestAt) bestAt = atMs
  }

  if (bestAt === null) return null
  return Math.max(0, bestAt - nowMs)
}

export function markAndFireReminders(tasks: Task[], settings: AppSettings): void {
  if (!settings.notificationsEnabled) return
  const perm = getNotificationPermission()
  if (perm !== 'granted') return

  const now = new Date()
  let reminded = cleanupReminded(loadReminded(), now.getTime())
  let changed = false

  for (const t of tasks) {
    const fire = shouldFireReminder(now, t, settings)
    if (!fire) continue
    if (reminded[fire.key]) continue

    const title = 'todox 알림'
    const bodyParts: string[] = [t.title]
    if (t.dueDate && t.dueDate !== todayISO()) bodyParts.push(`(${t.dueDate})`)
    const body = bodyParts.join(' ')

    // eslint-disable-next-line no-new
    new Notification(title, { body })

    reminded[fire.key] = now.getTime()
    changed = true
  }

  if (changed) saveReminded(reminded)
}

