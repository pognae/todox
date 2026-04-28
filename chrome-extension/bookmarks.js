const STORAGE_KEY = 'todoxBookmarks'

/**
 * @typedef {{ id: string; url: string; title: string; addedAt: string }} Bookmark
 */

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id))
const listEl = /** @type {HTMLUListElement} */ ($('list'))
const emptyEl = $('empty')
const qEl = /** @type {HTMLInputElement} */ ($('q'))
const metaEl = $('meta')
const tpl = /** @type {HTMLTemplateElement} */ (document.getElementById('rowTpl'))

/** @type {Bookmark[]} */
let all = []

function fmtWhen(iso) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

async function load() {
  const obj = await chrome.storage.local.get(STORAGE_KEY)
  const list = obj?.[STORAGE_KEY]
  all = Array.isArray(list) ? list : []
  render()
}

async function save(next) {
  all = next
  await chrome.storage.local.set({ [STORAGE_KEY]: next })
  render()
}

function matches(b, q) {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return (b.title || '').toLowerCase().includes(s) || (b.url || '').toLowerCase().includes(s)
}

function render() {
  const q = qEl.value
  const visible = all.filter((b) => b && typeof b.url === 'string' && matches(b, q))

  listEl.innerHTML = ''
  for (const b of visible) {
    const frag = tpl.content.cloneNode(true)
    const row = /** @type {HTMLElement} */ (frag.querySelector('.row'))
    const a = /** @type {HTMLAnchorElement} */ (frag.querySelector('.rowTitle'))
    const url = /** @type {HTMLElement} */ (frag.querySelector('.rowUrl'))
    const meta = /** @type {HTMLElement} */ (frag.querySelector('.rowMeta'))
    const delBtn = /** @type {HTMLButtonElement} */ (frag.querySelector('.delBtn'))
    const copyBtn = /** @type {HTMLButtonElement} */ (frag.querySelector('.copyBtn'))

    a.textContent = b.title || b.url
    a.href = b.url
    url.textContent = b.url
    meta.textContent = `추가됨: ${fmtWhen(b.addedAt)}`

    delBtn.addEventListener('click', async () => {
      await save(all.filter((x) => x.id !== b.id))
    })

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(b.url)
        copyBtn.textContent = '복사됨'
        setTimeout(() => (copyBtn.textContent = '복사'), 900)
      } catch {
        // ignore
      }
    })

    row.dataset.id = b.id
    listEl.appendChild(frag)
  }

  emptyEl.hidden = all.length !== 0
  metaEl.textContent = `총 ${all.length}개 · 표시 ${visible.length}개`
}

async function addCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  const tab = tabs[0]
  const url = tab?.url ?? ''
  if (!url || !/^https?:\/\//.test(url)) return

  const exists = all.some((b) => b.url === url)
  if (exists) return

  const title = (tab?.title ?? '').trim() || url
  const b = { id: crypto.randomUUID?.() ?? String(Date.now()), url, title, addedAt: new Date().toISOString() }
  await save([b, ...all].slice(0, 5000))
}

document.getElementById('addCurrent')?.addEventListener('click', addCurrentTab)
document.getElementById('clearAll')?.addEventListener('click', async () => {
  if (!confirm('북마크를 전부 삭제할까요?')) return
  await save([])
})
qEl.addEventListener('input', render)

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (!changes[STORAGE_KEY]) return
  const next = changes[STORAGE_KEY].newValue
  all = Array.isArray(next) ? next : []
  render()
})

load()

