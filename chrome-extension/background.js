const STORAGE_KEY = 'todoxBookmarks'

/**
 * @typedef {{ id: string; url: string; title: string; addedAt: string }} Bookmark
 */

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  return tabs[0] ?? null
}

async function getTabUrlAndTitle(tab) {
  try {
    const id = tab?.id
    if (typeof id === 'number') {
      const full = await chrome.tabs.get(id)
      return { url: full?.url ?? tab?.url ?? '', title: full?.title ?? tab?.title ?? '' }
    }
  } catch {
    // ignore
  }
  return { url: tab?.url ?? '', title: tab?.title ?? '' }
}

async function loadBookmarks() {
  const obj = await chrome.storage.local.get(STORAGE_KEY)
  const list = obj?.[STORAGE_KEY]
  return Array.isArray(list) ? list : []
}

async function saveBookmarks(next) {
  await chrome.storage.local.set({ [STORAGE_KEY]: next })
}

async function addBookmarkFromTab(tab) {
  const { url, title: rawTitle } = await getTabUrlAndTitle(tab)
  if (!url || !/^https?:\/\//.test(url)) return { ok: false, reason: 'unsupported-url' }

  const title = (rawTitle ?? '').trim() || url
  const now = new Date().toISOString()

  const list = await loadBookmarks()
  const exists = list.some((b) => b && typeof b.url === 'string' && b.url === url)
  if (exists) return { ok: true, already: true }

  /** @type {Bookmark} */
  const b = { id: uid(), url, title, addedAt: now }
  const next = [b, ...list].slice(0, 5000)
  await saveBookmarks(next)
  // 저장이 실제로 되었는지 한 번 더 확인(서비스워커/스토리지 이슈 방지)
  const verify = await loadBookmarks()
  const ok = verify.some((x) => x && typeof x.url === 'string' && x.url === url)
  if (!ok) return { ok: false, reason: 'save-failed' }
  return { ok: true, already: false }
}

async function flashBadge(text) {
  try {
    await chrome.action.setBadgeBackgroundColor({ color: '#db4c3f' })
    await chrome.action.setBadgeText({ text })
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1200)
  } catch {
    // ignore
  }
}

async function notify(title, message) {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="24" fill="#db4c3f"/><path d="M40 28h48a8 8 0 0 1 8 8v64l-32-16-32 16V36a8 8 0 0 1 8-8z" fill="white"/></svg>'),
      title,
      message,
    })
  } catch {
    // ignore
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'todox-bookmarks-open',
    title: '북마크 목록',
    contexts: ['action'],
  })
  chrome.contextMenus.create({
    id: 'todox-bookmarks-add',
    title: '현재 탭 북마크 추가',
    contexts: ['action'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'todox-bookmarks-open') {
    await chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') })
    return
  }
  if (info.menuItemId === 'todox-bookmarks-add') {
    const res = await addBookmarkFromTab(tab ?? (await getActiveTab()))
    if (!res.ok) {
      await flashBadge('!')
      await notify(
        'todox 북마크',
        res.reason === 'save-failed'
          ? '저장에 실패했습니다. 확장프로그램을 새로고침한 뒤 다시 시도해 주세요.'
          : '이 페이지는 북마크에 추가할 수 없습니다.',
      )
      return
    }
    await flashBadge(res.already ? '✓' : '+')
    await notify('todox 북마크', res.already ? '이미 저장된 북마크입니다.' : '북마크에 추가했습니다.')
  }
})

chrome.action.onClicked.addListener(async (tab) => {
  const res = await addBookmarkFromTab(tab ?? (await getActiveTab()))
  if (!res.ok) {
    await flashBadge('!')
    await notify(
      'todox 북마크',
      res.reason === 'save-failed'
        ? '저장에 실패했습니다. 확장프로그램을 새로고침한 뒤 다시 시도해 주세요.'
        : '이 페이지는 북마크에 추가할 수 없습니다.',
    )
    return
  }
  await flashBadge(res.already ? '✓' : '+')
  await notify('todox 북마크', res.already ? '이미 저장된 북마크입니다.' : '북마크에 추가했습니다.')
})

