export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null
  if (!('serviceWorker' in navigator)) return null

  try {
    const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
    const reg = await navigator.serviceWorker.register(`${base}sw.js`)
    return reg
  } catch {
    return null
  }
}

/** @deprecated FCM은 빌드 시 sw-core.js에 합쳐진 단일 sw.js에서 처리합니다. */
export async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  return registerServiceWorker()
}

export async function tryRegisterBackgroundReminder(reg: ServiceWorkerRegistration): Promise<
  'registered' | 'unsupported' | 'denied'
> {
  if (!('periodicSync' in reg)) return 'unsupported'
  if (!('permissions' in navigator)) return 'unsupported'

  try {
    // @ts-expect-error - TS lib dom may not include yet
    const p = await navigator.permissions.query({ name: 'periodic-background-sync' })
    if (p.state !== 'granted') return 'denied'
    // 최소 간격은 브라우저가 상향 조정할 수 있음
    // @ts-expect-error - periodicSync typing
    await reg.periodicSync.register('todox-reminders', { minInterval: 6 * 60 * 60 * 1000 })
    return 'registered'
  } catch {
    return 'denied'
  }
}

export async function tryRegisterOneOffSync(reg: ServiceWorkerRegistration): Promise<boolean> {
  if (!('sync' in reg)) return false
  try {
    // @ts-expect-error - SyncManager typing
    await reg.sync.register('todox-reminders')
    return true
  } catch {
    return false
  }
}

