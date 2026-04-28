import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { ensureSignedInAnonymously, getSupabaseClient } from './supabaseClient'

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

function platform(): 'android' | 'ios' {
  const p = Capacitor.getPlatform()
  return p === 'ios' ? 'ios' : 'android'
}

function getOrCreateDeviceId(): string {
  const k = 'todox-native-device-id'
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

let started = false

export async function initNativePushRegistration(): Promise<void> {
  if (!isNative()) return
  if (started) return
  started = true

  const supabase = getSupabaseClient()
  if (!supabase) return

  // 권한 요청
  const perm = await PushNotifications.requestPermissions()
  if (perm.receive !== 'granted') return

  await PushNotifications.register()

  PushNotifications.addListener('registration', async (token) => {
    try {
      const auth = await ensureSignedInAnonymously()
      if (!auth) return
      const deviceId = getOrCreateDeviceId()
      const now = new Date().toISOString()
      await supabase.from('todox_push_devices').upsert(
        {
          user_id: auth.userId,
          device_id: deviceId,
          platform: platform(),
          token: token.value,
          updated_at: now,
          last_seen_at: now,
        },
        { onConflict: 'user_id,device_id' },
      )
    } catch {
      // ignore
    }
  })

  PushNotifications.addListener('registrationError', (err) => {
    // eslint-disable-next-line no-console
    console.error('[todox][push] registrationError', err)
  })

  // 수신 이벤트(포그라운드/백그라운드)
  PushNotifications.addListener('pushNotificationReceived', (n) => {
    // eslint-disable-next-line no-console
    console.log('[todox][push] received', n)
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (n) => {
    // eslint-disable-next-line no-console
    console.log('[todox][push] action', n)
  })
}

