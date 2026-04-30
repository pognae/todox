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
      // 포그라운드: FCM은 기본 시스템 알림을 띄우지 않아 직접 표시
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

export async function registerWebPushToken(): Promise<{ ok: boolean; reason?: string }> {
  const cfg = getWebPushConfig()
  if (!cfg) return { ok: false, reason: 'not_configured' }
  if (typeof window === 'undefined') return { ok: false, reason: 'no_window' }
  if (!('Notification' in window)) return { ok: false, reason: 'no_notification_api' }

  const supported = await isSupported()
  if (!supported) return { ok: false, reason: 'unsupported' }

  const supabase = getSupabaseClient()
  if (!supabase) return { ok: false, reason: 'supabase_missing' }

  // 권한 요청
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: 'permission_denied' }

  if (!messaging) {
    await initWebPush()
    if (!messaging) return { ok: false, reason: 'messaging_init_failed' }
  }

  // token 획득
  const swReg = await registerServiceWorker()
  const token = await getToken(messaging, {
    vapidKey: cfg.vapidKey,
    serviceWorkerRegistration: swReg ?? undefined,
  })
  if (!token) return { ok: false, reason: 'token_missing' }

  const auth = await ensureSignedInAnonymously()
  if (!auth) return { ok: false, reason: 'auth_missing' }

  const deviceId = getOrCreateDeviceId()
  const now = new Date().toISOString()
  const { error } = await supabase.from('todox_push_devices').upsert(
    {
      user_id: auth.userId,
      device_id: deviceId,
      platform: 'web',
      token,
      updated_at: now,
      last_seen_at: now,
    },
    { onConflict: 'user_id,device_id' },
  )
  if (error) return { ok: false, reason: error.message || 'db_error' }
  return { ok: true }
}

