export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null
  if (!('serviceWorker' in navigator)) return null
  // Electron(file://) 등에서는 SW가 동작하지 않거나 등록이 실패하는 경우가 많음
  if (window.location.protocol === 'file:') return null

  try {
    const url = `${import.meta.env.BASE_URL}sw.js`
    const reg = await navigator.serviceWorker.register(url)
    return reg
  } catch {
    return null
  }
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

