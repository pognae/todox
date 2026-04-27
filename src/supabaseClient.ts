import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'

const NATIVE_OAUTH_REDIRECT = 'todox://auth-callback'
const AUTH_DISABLED_KEY = 'todox-auth-disabled'

function getEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string | null {
  const v = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name]
  return v ?? null
}

function isAuthDisabled(): boolean {
  try {
    return localStorage.getItem(AUTH_DISABLED_KEY) === '1'
  } catch {
    return false
  }
}

function setAuthDisabled(disabled: boolean): void {
  try {
    if (disabled) localStorage.setItem(AUTH_DISABLED_KEY, '1')
    else localStorage.removeItem(AUTH_DISABLED_KEY)
  } catch {
    // ignore
  }
}

function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client
  if (isAuthDisabled()) return null
  const url = getEnv('VITE_SUPABASE_URL')
  const anonKey = getEnv('VITE_SUPABASE_ANON_KEY')
  if (!url || !anonKey) return null

  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Web에서는 OAuth/magic-link 리다이렉트 URL에서 세션 파싱이 필요.
      // Native(Capacitor)에서는 딥링크로 들어온 URL을 우리가 직접 처리.
      detectSessionInUrl: !isNativePlatform(),
    },
  })
  return client
}

function enableRemoteAuth(): void {
  setAuthDisabled(false)
  client = null
}

export function initSupabaseAuthDeepLinkListener(): (() => void) | null {
  if (!isNativePlatform()) return null
  if (isAuthDisabled()) return null
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const subP = App.addListener('appUrlOpen', async ({ url }) => {
    if (!url) return
    if (!url.startsWith(NATIVE_OAUTH_REDIRECT)) return
    try {
      await Browser.close()
    } catch {
      // ignore
    }
    try {
      // supabase-js(v2) OAuth는 보통 PKCE 코드 플로우를 사용합니다.
      // 딥링크로 돌아온 URL의 `?code=...`를 교환해서 세션을 저장합니다.
      const u = new URL(url)
      const code = u.searchParams.get('code')
      if (!code) return
      enableRemoteAuth()
      await supabase.auth.exchangeCodeForSession(code)
    } catch {
      // ignore: 배너/로그로 노출은 상위에서 처리
    }
  })

  return () => {
    void (async () => {
      const sub = await subP
      await sub.remove()
    })()
  }
}

export async function ensureSignedInAnonymously(): Promise<{ userId: string } | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data: sess } = await supabase.auth.getSession()
  const existing = sess.session?.user?.id
  if (existing) return { userId: existing }

  // Supabase Anonymous Sign-ins must be enabled in Auth settings.
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  const uid = data.user?.id
  if (!uid) return null
  return { userId: uid }
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function signInWithMagicLink(email: string): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase env missing')

  const trimmed = email.trim()
  if (!trimmed) throw new Error('Email required')

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      // Vite SPA: 현재 origin으로 돌아오면 됨
      emailRedirectTo: window.location.origin,
    },
  })
  if (error) throw error
}

export async function signInWithGoogle(loginHintEmail?: string): Promise<void> {
  enableRemoteAuth()
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase env missing')

  const login_hint = loginHintEmail?.trim() || undefined

  if (isNativePlatform()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: NATIVE_OAUTH_REDIRECT,
        skipBrowserRedirect: true,
        queryParams: login_hint ? { login_hint } : undefined,
      },
    })
    if (error) throw error
    const url = data?.url
    if (!url) throw new Error('OAuth URL missing')
    await Browser.open({ url })
    return
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: login_hint ? { login_hint } : undefined,
    },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient()
  // 로그아웃 = 원격 동기화를 끄고(로컬 모드), 자동 익명 로그인도 막는다.
  setAuthDisabled(true)
  client = null
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function deleteAccountData(): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase env missing')

  const { data, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  const uid = data.user?.id
  if (!uid) throw new Error('Not signed in')

  const { error } = await supabase.from('todox_user_states').delete().eq('user_id', uid)
  if (error) throw error
}

export function onAuthStateChange(
  cb: (evt: string, userId: string | null) => void,
): (() => void) | null {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  const { data } = supabase.auth.onAuthStateChange((evt, session) => {
    cb(evt, session?.user?.id ?? null)
  })
  return () => data.subscription.unsubscribe()
}

