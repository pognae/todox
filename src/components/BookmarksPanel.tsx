import { useEffect, useMemo, useRef, useState } from 'react'
import { useTodo } from '../TodoContext'
import { onBookmarksPush, pushBookmarks, requestBookmarks } from '../bookmarksBridge'

type Bookmark = { id: string; url: string; title: string; addedAt: string }

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//.test(url)
}

function fmtWhen(iso: string): string {
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

function safeParseBookmarks(json: string): Bookmark[] | null {
  try {
    const v = JSON.parse(json)
    if (!Array.isArray(v)) return null
    const list: Bookmark[] = []
    for (const x of v) {
      if (!x || typeof x !== 'object') continue
      const id = String((x as any).id ?? '')
      const url = String((x as any).url ?? '')
      const title = String((x as any).title ?? url)
      const addedAt = String((x as any).addedAt ?? new Date().toISOString())
      if (!id || !isHttpUrl(url)) continue
      list.push({ id, url, title, addedAt })
    }
    return list
  } catch {
    return null
  }
}

export function BookmarksPanel() {
  const [q, setQ] = useState('')
  const { bookmarks, setBookmarks } = useTodo()
  const [bridgeState, setBridgeState] = useState<'unknown' | 'connected' | 'missing'>('unknown')
  const [busy, setBusy] = useState(false)
  const importRef = useRef<HTMLTextAreaElement>(null)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return bookmarks
    return bookmarks.filter((b) => b.title.toLowerCase().includes(s) || b.url.toLowerCase().includes(s))
  }, [q, bookmarks])

  const refresh = async () => {
    setBusy(true)
    try {
      const res = await requestBookmarks(650)
      if (res) {
        setBookmarks(res)
        setBridgeState('connected')
      } else {
        setBridgeState('missing')
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const off = onBookmarksPush((next) => {
      setBookmarks(next)
      setBridgeState('connected')
    })
    return off
  }, [])

  const applyAndSync = async (next: Bookmark[]) => {
    setBookmarks(next)
    const ok = await pushBookmarks(next, 650)
    setBridgeState(ok ? 'connected' : 'missing')
  }

  const removeOne = async (id: string) => {
    const next = bookmarks.filter((b) => b.id !== id)
    setBusy(true)
    try {
      await applyAndSync(next)
    } finally {
      setBusy(false)
    }
  }

  const clearAll = async () => {
    if (!confirm('북마크를 전부 삭제할까요?')) return
    setBusy(true)
    try {
      await applyAndSync([])
    } finally {
      setBusy(false)
    }
  }

  const exportJson = async () => {
    const text = JSON.stringify(bookmarks, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      alert('클립보드에 JSON을 복사했습니다.')
    } catch {
      alert('클립보드 복사에 실패했습니다. 아래 입력칸을 사용해 주세요.')
      if (importRef.current) importRef.current.value = text
    }
  }

  const importJson = async () => {
    const raw = (importRef.current?.value ?? '').trim()
    if (!raw) return
    const parsed = safeParseBookmarks(raw)
    if (!parsed) {
      alert('JSON 형식이 올바르지 않습니다.')
      return
    }
    setBusy(true)
    try {
      await applyAndSync(parsed)
      alert('가져오기를 완료했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-neutral-600">
          {bridgeState === 'connected'
            ? '확장프로그램과 연결됨 (동기화됨)'
            : bridgeState === 'missing'
              ? '확장프로그램 브리지를 찾지 못했습니다. (아래 JSON으로 수동 가져오기/내보내기 가능)'
              : '연결 확인 중…'}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            onClick={refresh}
            disabled={busy}
          >
            새로고침
          </button>
          <button
            type="button"
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            onClick={exportJson}
            disabled={busy}
          >
            JSON 내보내기(복사)
          </button>
          <button
            type="button"
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            onClick={clearAll}
            disabled={busy || bookmarks.length === 0}
          >
            전체 삭제
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="북마크 검색 (제목/URL)"
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-todoist-red focus:ring-1 focus:ring-todoist-red/25"
            aria-label="북마크 검색"
          />
        </div>
        <div className="text-xs text-neutral-400">
          총 {bookmarks.length}개 · 표시 {filtered.length}개
        </div>
      </div>

      {bookmarks.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500 shadow-sm">
          북마크가 없습니다. 확장프로그램 아이콘을 클릭해 현재 탭을 저장해 보세요.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={b.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm font-medium text-neutral-800 hover:underline"
                  title={b.title}
                >
                  {b.title}
                </a>
                <div className="mt-0.5 break-all text-xs text-neutral-500">{b.url}</div>
                <div className="mt-1 text-[11px] text-neutral-400">추가됨: {fmtWhen(b.addedAt)}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => removeOne(b.id)}
                  className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  disabled={busy}
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <summary className="cursor-pointer select-none text-sm font-medium text-neutral-700">
          수동 연결(JSON 가져오기/내보내기)
        </summary>
        <div className="mt-3 space-y-2">
          <textarea
            ref={importRef}
            rows={6}
            className="w-full rounded-md border border-neutral-200 bg-white p-3 text-xs outline-none focus:border-todoist-red focus:ring-1 focus:ring-todoist-red/25"
            placeholder="여기에 북마크 JSON 배열을 붙여넣고 ‘가져오기’를 누르세요."
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              onClick={importJson}
              disabled={busy}
            >
              가져오기(확장프로그램에 반영)
            </button>
          </div>
        </div>
      </details>
    </div>
  )
}

