const STORAGE_KEY = 'todoxBookmarks'
const PUSH_TYPE = 'TODOX_BOOKMARKS_PUSH'

async function loadBookmarks() {
  const obj = await chrome.storage.local.get(STORAGE_KEY)
  const list = obj?.[STORAGE_KEY]
  return Array.isArray(list) ? list : []
}

async function saveBookmarks(next) {
  await chrome.storage.local.set({ [STORAGE_KEY]: next })
}

window.addEventListener('message', async (e) => {
  // 같은 페이지에서만 오가는 브리지 용도이므로 origin 체크 대신 shape로 필터
  const data = e.data
  if (!data || typeof data !== 'object') return

  if (data.type === 'TODOX_BOOKMARKS_REQUEST') {
    const bookmarks = await loadBookmarks()
    window.postMessage({ type: 'TODOX_BOOKMARKS_RESPONSE', requestId: data.requestId, bookmarks }, '*')
    return
  }

  if (data.type === 'TODOX_BOOKMARKS_SET') {
    const next = Array.isArray(data.bookmarks) ? data.bookmarks : []
    await saveBookmarks(next)
    window.postMessage({ type: 'TODOX_BOOKMARKS_SET_ACK', requestId: data.requestId }, '*')
  }
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  const ch = changes[STORAGE_KEY]
  if (!ch) return
  const next = Array.isArray(ch.newValue) ? ch.newValue : []
  window.postMessage({ type: PUSH_TYPE, bookmarks: next }, '*')
})

