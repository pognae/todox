import { useEffect, useState } from 'react'
import { getSupabaseClient, onAuthStateChange } from './supabaseClient'

export function useAuth(): { userId: string | null; ready: boolean } {
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    const supabase = getSupabaseClient()
    if (!supabase) {
      setReady(true)
      return
    }

    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setUserId(data.session?.user?.id ?? null)
      setReady(true)
    })()

    const unsub = onAuthStateChange((uid) => {
      if (!mounted) return
      setUserId(uid)
      setReady(true)
    })

    return () => {
      mounted = false
      unsub?.()
    }
  }, [])

  return { userId, ready }
}

