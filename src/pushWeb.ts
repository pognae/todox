import { getApps, initializeApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging'
import { getSupabaseClient, ensureSignedInAnonymously } from './supabaseClient'
import { registerServiceWorker } from './pwa'

type WebPushConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  messagingSenderId: string
  vapidKey: string
}

const FCM_TOKEN_STORAGE_KEY = 'todox-fcm-token-cache'
const SYNC_THROTTLE_MS = 5 * 60 * 1000
const LAST_SYNC_TS_KEY = 'todox-push-last-sync-at'

function env(name: string): string | null {
  return ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name] ?? null) as string | null
}

function getWebPushConfig(): WebPushConfig | null {
  const apiKey = env('VITE_FIREBASE_API_KEY')
  const authDomain = env('VITE_FIREBASE_AUTH_DOMAIN')
  const projectId = env('VITE_FIREBASE_PROJECT_ID')
  const appId = env('VITE_FIREBASE_APP_ID')
  const messagingSenderId = env('VITE_FIREBASE_MESSAGING_SENDER_ID')
  const vapidKey = env('VITE_FIREBASE_VAPID_KEY')
  if (!apiKey || !authDomain || !projectId || !appId || !messagingSenderId || !vapidKey) return null
  return { apiKey, authDomain, projectId, appId, messagingSenderId, vapidKey }
}

function getOrCreateDeviceId(): string {
  const k = 'todox-web-device-id'
  try {
    const existing = localStorage.getItem(k)
    if (existing) return existing
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
    localStorage.setItem(k, id)
    return id
  } catch {
    return `mem-${Date.now().toString(36)}`
  }
}

let messaging: Messaging | null = null

export async function initWebPush(): Promise<{ supported: boolean; configured: boolean }> {
  if (typeof window === 'undefined') return { supported: false, configured: false }
  const cfg = getWebPushConfig()
  if (!cfg) return { supported: false, configured: false }
  if (!(await isSupported())) return { supported: false, configured: true }

  if (!messaging) {
    const app =
      getApps().length === 0
        ? initializeApp({
            apiKey: cfg.apiKey,
            authDomain: cfg.authDomain,
            projectId: cfg.projectId,
            appId: cfg.appId,
            messagingSenderId: cfg.messagingSenderId,
          })
        : getApps()[0]!
    messaging = getMessaging(app)

    onMessage(messaging, (payload) => {
      const title = (payload.notification?.title as string | undefined) || 'todox 알림'
      const body = (payload.notification?.body as string | undefined) || ''
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      void (async () => {
        try {
          const reg = await navigator.serviceWorker.ready
          await reg.showNotification(title, { body: body || '\u00a0' })
        } catch {
          try {
            new Notification(title, { body: body || '\u00a0' })
          } catch {
            // ignore
          }
        }
      })()
    })
  }

  return { supported: true, configured: true }
}

export type SyncWebPushOptions = {
  /** false면 이미 granted일 때만 동작(자동 갱신용). true면 권한 요청 모달을 띄움(설정 버튼). */
  requestPermission: boolean
  /** 설정 버튼 등에서 스로틀을 무시하고 즉시 반영 */
  force?: boolean
}

/**
 * FCM 토큰을 받아 Supabase에 upsert합니다.
 * 브라우저/OS가 토큰을 교체해도 주기적 재호출로 계속 수신 가능하게 합니다.
 */
export async function syncWebPushToken(opts: SyncWebPushOptions): Promise<{
  ok: boolean
  reason?: string
}> {
  const cfg = getWebPushConfig()
  if (!cfg) return { ok: false, reason: 'not_configured' }
  if (typeof window === 'undefined') return { ok: false, reason: 'no_window' }
  if (!('Notification' in window)) return { ok: false, reason: 'no_notification_api' }

  const supported = await isSupported()
  if (!supported) return { ok: false, reason: 'unsupported' }

  const supabase = getSupabaseClient()
  if (!supabase) return { ok: false, reason: 'supabase_missing' }

  if (opts.requestPermission) {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return { ok: false, reason: 'permission_denied' }
  } else if (Notification.permission !== 'granted') {
    return { ok: false, reason: 'permission_not_granted' }
  }

  if (!messaging) {
    await initWebPush()
    if (!messaging) return { ok: false, reason: 'messaging_init_failed' }
  }

  const swReg = await registerServiceWorker()
  const token = await getToken(messaging, {
    vapidKey: cfg.vapidKey,
    serviceWorkerRegistration: swReg ?? undefined,
  })
  if (!token) return { ok: false, reason: 'token_missing' }

  if (shouldThrottleUpsert(token, opts.force === true)) {
    return { ok: true, reason: 'throttled' }
  }

  const auth = await ensureSignedInAnonymously()
  if (!auth) return { ok: false, reason: 'auth_missing' }

  const deviceId = getOrCreateDeviceId()
  const nowIso = new Date().toISOString()
  const { error } = await supabase.from('todox_push_devices').upsert(
    {
      user_id: auth.userId,
      device_id: deviceId,
      platform: 'web',
      token,
      updated_at: nowIso,
      last_seen_at: nowIso,
    },
    { onConflict: 'user_id,device_id' },
  )
  if (error) return { ok: false, reason: error.message || 'db_error' }

  try {
    localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token)
    sessionStorage.setItem(LAST_SYNC_TS_KEY, String(Date.now()))
  } catch {
    // ignore
  }
  return { ok: true }
}

function readStoredTokenCache(): string | null {
  try {
    return localStorage.getItem(FCM_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

/** 토큰이 바뀌었거나 수동(force)이면 항상 upsert. 같으면 짧은 간격으로만 스킵(부하·깜빡임 방지). */
function shouldThrottleUpsert(token: string, force: boolean): boolean {
  if (force) return false
  try {
    const cached = readStoredTokenCache()
    if (cached !== token) return false
    const raw = sessionStorage.getItem(LAST_SYNC_TS_KEY)
    const lastAt = raw ? Number(raw) : 0
    if (!Number.isFinite(lastAt)) return false
    return Date.now() - lastAt < SYNC_THROTTLE_MS
  } catch {
    return false
  }
}

/** 설정 화면 버튼: 권한 요청 + 즉시 등록 */
export async function registerWebPushToken(): Promise<{ ok: boolean; reason?: string }> {
  return syncWebPushToken({ requestPermission: true, force: true })
}
