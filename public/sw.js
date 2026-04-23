/* eslint-disable no-restricted-globals */

const IDB_DB = 'todox'
const IDB_STORE = 'kv'
const IDB_STATE_KEY = 'state'
const IDB_REMINDED_KEY = 'reminded'

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function readKeyFromIdb(key) {
  const db = await openIdb()
  const val = await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return val
}

async function loadReminded() {
  const m = await readKeyFromIdb(IDB_REMINDED_KEY)
  return m && typeof m === 'object' ? m : {}
}

async function saveReminded(m) {
  const db = await openIdb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(m, IDB_REMINDED_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

function cleanupReminded(m, now) {
  const week = 7 * 24 * 60 * 60 * 1000
  const next = {}
  for (const k of Object.keys(m || {})) {
    if (now - m[k] <= week) next[k] = m[k]
  }
  return next
}

function parseISODate(s) {
  const parts = String(s).split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function pad2(n) {
  return n < 10 ? `0${n}` : String(n)
}

function toLocalISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function parseHM(hm) {
  const [hs, ms] = String(hm).split(':')
  const h = Number(hs)
  const m = Number(ms)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return { h, m }
}

function scheduledKey(task, hm) {
  return `${task.id}:${task.dueDate || ''}:${hm}`
}

function computeReminderAt(task, settings) {
  if (!task.dueDate) return null
  const hm = task.dueTime || settings.defaultReminderTime
  const parsed = parseHM(hm)
  if (!parsed) return null
  const d = parseISODate(task.dueDate)
  d.setHours(parsed.h, parsed.m, 0, 0)
  return d
}

async function fireRemindersOnce() {
  const perm = self.Notification ? self.Notification.permission : 'denied'
  if (perm !== 'granted') return

  const state = await readKeyFromIdb(IDB_STATE_KEY)
  if (!state || !state.tasks || !state.settings) return

  const settings = state.settings
  if (!settings.notificationsEnabled) return

  const now = new Date()
  const nowMs = now.getTime()
  let reminded = cleanupReminded(await loadReminded(), nowMs)
  let changed = false

  for (const t of state.tasks) {
    if (!t || t.completed || !t.dueDate) continue
    const at = computeReminderAt(t, settings)
    if (!at) continue
    const delta = nowMs - at.getTime()
    if (delta < 0 || delta > 60 * 60 * 1000) continue

    const hm = t.dueTime || settings.defaultReminderTime
    const key = scheduledKey(t, hm)
    if (reminded[key]) continue

    const body = `${t.title}${t.dueDate === toLocalISODate(new Date()) ? '' : ` (${t.dueDate})`}`
    // eslint-disable-next-line no-new
    new self.Notification('todox 알림', { body })
    reminded[key] = nowMs
    changed = true
  }

  if (changed) await saveReminded(reminded)
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// 지원 브라우저에서 주기 동기화로 백그라운드 알림
self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'todox-reminders') return
  event.waitUntil(fireRemindersOnce())
})

// 일부 브라우저 폴백(온라인이 되는 시점 등)
self.addEventListener('sync', (event) => {
  if (event.tag !== 'todox-reminders') return
  event.waitUntil(fireRemindersOnce())
})

