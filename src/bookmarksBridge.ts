export type BridgeBookmark = { id: string; url: string; title: string; addedAt: string }

const BRIDGE_REQ = 'TODOX_BOOKMARKS_REQUEST'
const BRIDGE_RES = 'TODOX_BOOKMARKS_RESPONSE'
const BRIDGE_SET = 'TODOX_BOOKMARKS_SET'
const BRIDGE_ACK = 'TODOX_BOOKMARKS_SET_ACK'
const BRIDGE_PUSH = 'TODOX_BOOKMARKS_PUSH'

export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//.test(url)
}

export async function requestBookmarks(timeoutMs: number = 650): Promise<BridgeBookmark[] | null> {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  return await new Promise((resolve) => {
    let done = false
    const t = window.setTimeout(() => {
      if (done) return
      done = true
      window.removeEventListener('message', onMsg)
      resolve(null)
    }, timeoutMs)

    const onMsg = (e: MessageEvent) => {
      const data = e.data
      if (!data || typeof data !== 'object') return
      if ((data as any).type !== BRIDGE_RES) return
      if ((data as any).requestId !== requestId) return
      const bookmarks = (data as any).bookmarks
      window.clearTimeout(t)
      if (done) return
      done = true
      window.removeEventListener('message', onMsg)
      resolve(Array.isArray(bookmarks) ? bookmarks : null)
    }

    window.addEventListener('message', onMsg)
    window.postMessage({ type: BRIDGE_REQ, requestId }, '*')
  })
}

export async function pushBookmarks(
  next: BridgeBookmark[],
  timeoutMs: number = 650,
): Promise<boolean> {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  return await new Promise((resolve) => {
    let done = false
    const t = window.setTimeout(() => {
      if (done) return
      done = true
      window.removeEventListener('message', onMsg)
      resolve(false)
    }, timeoutMs)

    const onMsg = (e: MessageEvent) => {
      const data = e.data
      if (!data || typeof data !== 'object') return
      if ((data as any).type !== BRIDGE_ACK) return
      if ((data as any).requestId !== requestId) return
      window.clearTimeout(t)
      if (done) return
      done = true
      window.removeEventListener('message', onMsg)
      resolve(true)
    }

    window.addEventListener('message', onMsg)
    window.postMessage({ type: BRIDGE_SET, requestId, bookmarks: next }, '*')
  })
}

export function onBookmarksPush(handler: (next: BridgeBookmark[]) => void): () => void {
  const onMsg = (e: MessageEvent) => {
    const data = e.data
    if (!data || typeof data !== 'object') return
    if ((data as any).type !== BRIDGE_PUSH) return
    const next = (data as any).bookmarks
    if (!Array.isArray(next)) return
    handler(next)
  }
  window.addEventListener('message', onMsg)
  return () => window.removeEventListener('message', onMsg)
}

