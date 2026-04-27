import type { AppSettings, Project, Task } from './types'
import { ensureSignedInAnonymously, getSupabaseClient } from './supabaseClient'

const KEY = 'todox-v1'
const IDB_DB = 'todox'
const IDB_STORE = 'kv'
const IDB_STATE_KEY = 'state'

export interface PersistedState {
  tasks: Task[]
  projects: Project[]
  settings?: AppSettings
}

export type SyncStatus =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved'; at: number }
  | { state: 'error'; message: string }

export type ConflictStatus =
  | { state: 'none' }
  | { state: 'detected'; remoteUpdatedAt: string; localChangedAt: number }

type SyncErrorDetails = {
  name?: string
  message?: string
  code?: string
  details?: string
  hint?: string
  status?: number
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

let remoteSaveTimer: number | null = null
let lastRemoteSaveJson = ''
let syncStatus: SyncStatus = { state: 'idle' }
const syncListeners = new Set<(s: SyncStatus) => void>()
let conflictStatus: ConflictStatus = { state: 'none' }
const conflictListeners = new Set<(s: ConflictStatus) => void>()
let lastSeenRemoteUpdatedAt: string | null = null
let localDirtySinceLastPull = false
let localLastChangedAt = 0

function setSyncStatus(next: SyncStatus) {
  syncStatus = next
  for (const fn of syncListeners) fn(next)
}

function setConflictStatus(next: ConflictStatus) {
  conflictStatus = next
  for (const fn of conflictListeners) fn(next)
}

function extractErrorDetails(e: unknown): SyncErrorDetails {
  if (!e) return { message: 'unknown error' }
  if (e instanceof Error) {
    const anyE = e as unknown as Record<string, unknown>
    return {
      name: e.name,
      message: e.message,
      code: typeof anyE.code === 'string' ? anyE.code : undefined,
      details: typeof anyE.details === 'string' ? anyE.details : undefined,
      hint: typeof anyE.hint === 'string' ? anyE.hint : undefined,
      status: typeof anyE.status === 'number' ? anyE.status : undefined,
    }
  }
  if (typeof e === 'string') return { message: e }
  try {
    return { message: JSON.stringify(e) }
  } catch {
    return { message: String(e) }
  }
}

function formatErrorMessage(d: SyncErrorDetails): string {
  const parts: string[] = []
  if (d.message) parts.push(d.message)
  if (d.code) parts.push(`code=${d.code}`)
  if (typeof d.status === 'number') parts.push(`status=${d.status}`)
  if (d.details) parts.push(d.details)
  return parts.join(' | ') || 'sync failed'
}

async function devServerLog(payload: unknown): Promise<void> {
  try {
    if (!(import.meta as unknown as { env?: Record<string, string | undefined> }).env?.DEV) return
    await fetch('/__todox_log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // ignore
  }
}

export function getSyncStatus(): SyncStatus {
  return syncStatus
}

export function subscribeSyncStatus(fn: (s: SyncStatus) => void): () => void {
  syncListeners.add(fn)
  fn(syncStatus)
  return () => syncListeners.delete(fn)
}

export function getConflictStatus(): ConflictStatus {
  return conflictStatus
}

export function subscribeConflictStatus(fn: (s: ConflictStatus) => void): () => void {
  conflictListeners.add(fn)
  fn(conflictStatus)
  return () => conflictListeners.delete(fn)
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
  void saveStateToIdb(state)
  void scheduleRemoteSave(state)
}

export async function loadStateFromRemote(): Promise<PersistedState | null> {
  const r = await loadStateFromRemoteWithMeta()
  return r?.state ?? null
}

export async function loadStateFromRemoteWithMeta(): Promise<
  | {
      state: PersistedState | null
      updatedAt: string | null
    }
  | null
> {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return null

    const auth = await ensureSignedInAnonymously()
    if (!auth) return null

    const { data, error } = await supabase
      .from('todox_user_states')
      .select('state, updated_at')
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (error) return null
    const updatedAt = (data?.updated_at as string | null) ?? null
    lastSeenRemoteUpdatedAt = updatedAt
    localDirtySinceLastPull = false
    setConflictStatus({ state: 'none' })
    return {
      state: (data?.state as PersistedState | null) ?? null,
      updatedAt,
    }
  } catch {
    return null
  }
}

export async function retryRemoteSave(state: PersistedState): Promise<void> {
  await saveRemoteNow(state)
}

export function clearConflict(): void {
  setConflictStatus({ state: 'none' })
}

async function saveRemoteNow(state: PersistedState): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) return
  const auth = await ensureSignedInAnonymously()
  if (!auth) return

  // 충돌 감지: 원격 updated_at이 마지막으로 본 값보다 더 최신인데, 로컬도 변경이 있었다면 충돌로 표시
  if (localDirtySinceLastPull && lastSeenRemoteUpdatedAt) {
    const { data: remote, error: remoteErr } = await supabase
      .from('todox_user_states')
      .select('updated_at')
      .eq('user_id', auth.userId)
      .maybeSingle()
    if (!remoteErr) {
      const remoteUpdatedAt = (remote?.updated_at as string | null) ?? null
      if (remoteUpdatedAt && remoteUpdatedAt !== lastSeenRemoteUpdatedAt) {
        setConflictStatus({
          state: 'detected',
          remoteUpdatedAt,
          localChangedAt: localLastChangedAt || Date.now(),
        })
        setSyncStatus({ state: 'error', message: '동기화 충돌이 감지되었습니다.' })
        return
      }
    }
  }

  setSyncStatus({ state: 'saving' })
  try {
    const { error } = await supabase.from('todox_user_states').upsert(
      {
        user_id: auth.userId,
        state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (error) throw error
    // 저장 성공 → 원격의 최신 updated_at을 다시 확보
    const { data: after } = await supabase
      .from('todox_user_states')
      .select('updated_at')
      .eq('user_id', auth.userId)
      .maybeSingle()
    lastSeenRemoteUpdatedAt = (after?.updated_at as string | null) ?? lastSeenRemoteUpdatedAt
    localDirtySinceLastPull = false
    setConflictStatus({ state: 'none' })
    setSyncStatus({ state: 'saved', at: Date.now() })
  } catch (e) {
    const details = extractErrorDetails(e)
    const msg = formatErrorMessage(details)
    // 브라우저 콘솔 + Vite dev server(터미널)로 모두 남겨서 원인 파악 가능하게
    // eslint-disable-next-line no-console
    console.error('[todox][sync] remote save failed', { details, raw: e })
    void devServerLog({ type: 'sync_failed', at: new Date().toISOString(), details })
    setSyncStatus({ state: 'error', message: msg })
  }
}

async function scheduleRemoteSave(state: PersistedState): Promise<void> {
  // 너무 자주 쓰지 않도록 디바운스 + 내용 동일하면 스킵
  const json = JSON.stringify(state)
  if (json === lastRemoteSaveJson) return
  lastRemoteSaveJson = json
  localDirtySinceLastPull = true
  localLastChangedAt = Date.now()

  if (remoteSaveTimer !== null) window.clearTimeout(remoteSaveTimer)
  remoteSaveTimer = window.setTimeout(() => {
    remoteSaveTimer = null
    void saveRemoteNow(state)
  }, 600)
}

function openIdb(): Promise<IDBDatabase> {
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

async function saveStateToIdb(state: PersistedState): Promise<void> {
  try {
    const db = await openIdb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(state, IDB_STATE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // IDB 실패는 무시(로컬스토리지는 유지)
  }
}
