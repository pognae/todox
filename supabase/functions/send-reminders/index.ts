// Supabase Edge Function (Deno)
// Schedules: call every 1 minute via Supabase Scheduled Functions.

type Task = {
  id: string
  title: string
  completed: boolean
  dueDate: string | null
  dueTime: string | null
}

type AppSettings = {
  defaultReminderTime: string
  notificationsEnabled: boolean
  // 클라이언트가 저장하는 “현재 기기 기준” timezone offset(분). 예: KST = -540 (Date.getTimezoneOffset())
  timezoneOffsetMinutes?: number
}

type PersistedState = {
  tasks?: Task[]
  settings?: AppSettings
}

type PushDevice = {
  device_id: string
  platform: 'web' | 'android' | 'ios'
  token: string
}

function parseHM(hm: string): { h: number; m: number } | null {
  const [hs, ms] = hm.split(':')
  const h = Number(hs)
  const m = Number(ms)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return { h, m }
}

function computeReminderAtUtcMs(task: Task, settings: AppSettings): number | null {
  if (!task.dueDate) return null
  const hm = task.dueTime || settings.defaultReminderTime
  const parsed = parseHM(hm)
  if (!parsed) return null
  const [y, mo, d] = task.dueDate.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null

  // dueDate는 “사용자 로컬 달력 기준” 날짜로 저장되어 있음.
  // 서버는 settings.timezoneOffsetMinutes(분)를 사용해 UTC로 변환.
  const tzOff = typeof settings.timezoneOffsetMinutes === 'number' ? settings.timezoneOffsetMinutes : new Date().getTimezoneOffset()
  const localAsUtc = Date.UTC(y, mo - 1, d, parsed.h, parsed.m, 0, 0)
  return localAsUtc + tzOff * 60_000
}

async function supabaseAdminFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

async function getDevices(userId: string): Promise<PushDevice[]> {
  const r = await supabaseAdminFetch(`todox_push_devices?select=device_id,platform,token&user_id=eq.${userId}`)
  if (!r.ok) return []
  return (await r.json()) as PushDevice[]
}

async function getUserState(userId: string): Promise<PersistedState | null> {
  const r = await supabaseAdminFetch(`todox_user_states?select=state&user_id=eq.${userId}&limit=1`)
  if (!r.ok) return null
  const arr = (await r.json()) as { state: PersistedState }[]
  return arr?.[0]?.state ?? null
}

async function insertDedup(userId: string, taskId: string, fireAtIso: string): Promise<boolean> {
  const r = await supabaseAdminFetch('todox_push_dedup', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, task_id: taskId, fire_at: fireAtIso }),
    // on conflict do nothing
    headers: { Prefer: 'resolution=ignore-duplicates' },
  })
  return r.ok
}

async function googleAccessToken(): Promise<string> {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON missing')
  const svc = JSON.parse(raw) as { client_email: string; private_key: string; project_id: string }
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: svc.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  const toSign = `${enc(header)}.${enc(claim)}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(svc.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(toSign))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
  const jwt = `${toSign}.${sigB64}`

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  })
  if (!r.ok) throw new Error(`oauth token failed: ${r.status}`)
  const json = (await r.json()) as { access_token: string }
  return json.access_token
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

async function sendFcm(tokens: string[], title: string, body: string): Promise<void> {
  if (tokens.length === 0) return
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')
  if (!raw) return
  const svc = JSON.parse(raw) as { project_id: string }
  const access = await googleAccessToken()

  // 가장 단순한 방식: 토큰별 단건 발송(규모가 커지면 batch로 최적화)
  await Promise.allSettled(tokens.slice(0, 200).map(async (token) => {
    await fetch(`https://fcm.googleapis.com/v1/projects/${svc.project_id}/messages:send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: { type: 'todox_reminder' },
        },
      }),
    })
  }))
}

async function listUsersWithDevices(): Promise<string[]> {
  const r = await supabaseAdminFetch('todox_push_devices?select=user_id')
  if (!r.ok) return []
  const rows = (await r.json()) as { user_id: string }[]
  return [...new Set(rows.map((x) => x.user_id).filter(Boolean))]
}

Deno.serve(async () => {
  const now = Date.now()
  const windowMs = 60_000 // 1분 윈도우

  const userIds = await listUsersWithDevices()
  let fired = 0

  for (const userId of userIds) {
    const state = await getUserState(userId)
    const tasks = state?.tasks ?? []
    const settings = state?.settings
    if (!settings || !settings.notificationsEnabled) continue

    const devices = await getDevices(userId)
    const tokens = devices.map((d) => d.token).filter(Boolean)
    if (tokens.length === 0) continue

    for (const t of tasks) {
      if (!t || t.completed || !t.dueDate) continue
      const atMs = computeReminderAtUtcMs(t, settings)
      if (atMs == null) continue
      if (atMs > now || now - atMs > windowMs) continue

      const fireAtIso = new Date(atMs).toISOString()
      const ok = await insertDedup(userId, t.id, fireAtIso)
      if (!ok) continue

      await sendFcm(tokens, 'todox 알림', t.title || '제목 없음')
      fired++
    }
  }

  return new Response(JSON.stringify({ ok: true, fired }), {
    headers: { 'content-type': 'application/json' },
  })
})

