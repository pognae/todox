import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function getEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string | null {
  const v = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name]
  return v ?? null
}

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client
  const url = getEnv('VITE_SUPABASE_URL')
  const anonKey = getEnv('VITE_SUPABASE_ANON_KEY')
  if (!url || !anonKey) return null

  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
  return client
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

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase env missing')

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function onAuthStateChange(cb: (userId: string | null) => void): (() => void) | null {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  const { data } = supabase.auth.onAuthStateChange((_evt, session) => {
    cb(session?.user?.id ?? null)
  })
  return () => data.subscription.unsubscribe()
}

