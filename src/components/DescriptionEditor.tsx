import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  applyDescriptionOp,
  handleMarkdownEnter,
  handleMarkdownTab,
  type DescriptionEditorOp,
} from '../descriptionMarkdown'

type Tab = 'edit' | 'preview'

const MD_PREVIEW_PROSE =
  'text-sm leading-5 text-neutral-800 [&_blockquote]:my-0.5 [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600 [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_h2]:mb-0.5 [&_h2]:mt-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_li]:my-0 [&_li]:leading-snug [&_ol]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_p]:leading-snug [&_strong]:font-semibold [&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5'

export type DescriptionEditorProps = {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  smartLists?: boolean
  layout?: 'default' | 'noteFull'
  slashCommands?: {
    enabled?: boolean
    tasks?: { id: string; title: string }[]
    bookmarks?: { id: string; url: string; title: string }[]
    onOpenTask?: (id: string) => void
    onOpenBookmarks?: () => void
  }
}

function MarkdownPreviewBody({
  source,
  slashCommands,
}: {
  source: string
  slashCommands?: DescriptionEditorProps['slashCommands']
}) {
  return source.trim() ? (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        del: ({ children }: { children?: ReactNode }) => (
          <del className="line-through decoration-neutral-400 [text-decoration-thickness:0.07em]">{children}</del>
        ),
        a: ({ href, children }) => {
          const h = href ?? ''
          if (h.startsWith('todox-task:')) {
            const id = h.slice('todox-task:'.length)
            return (
              <button
                type="button"
                className="!text-blue-600 underline underline-offset-2 hover:!text-blue-700"
                onClick={() => slashCommands?.onOpenTask?.(id)}
              >
                {children}
              </button>
            )
          }
          if (h.startsWith('todox-bookmark:')) {
            return (
              <button
                type="button"
                className="!text-blue-600 underline underline-offset-2 hover:!text-blue-700"
                onClick={() => slashCommands?.onOpenBookmarks?.()}
              >
                {children}
              </button>
            )
          }
          return (
            <a
              href={h}
              target="_blank"
              rel="noreferrer"
              className="text-todoist-red underline underline-offset-2 hover:text-red-700"
            >
              {children}
            </a>
          )
        },
      }}
    >
      {source}
    </ReactMarkdown>
  ) : (
    <p className="text-neutral-400">내용이 없습니다.</p>
  )
}

function assignForwardedRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === 'function') ref(value)
  else (ref as MutableRefObject<T | null>).current = value
}

function ToolbarBtn({
  label,
  title,
  onClick,
}: {
  label: string
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
    >
      {label}
    </button>
  )
}

export const DescriptionEditor = forwardRef<HTMLTextAreaElement, DescriptionEditorProps>(
  function DescriptionEditor(
    { value, onChange, onBlur, placeholder, smartLists, layout = 'default', slashCommands },
    forwardedRef,
  ) {
  const ta = useRef<HTMLTextAreaElement | null>(null)
  const slashInputRef = useRef<HTMLInputElement | null>(null)
  const setTextareaRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      ta.current = el
      assignForwardedRef(forwardedRef, el)
    },
    [forwardedRef],
  )
  const [tab, setTab] = useState<Tab>('edit')
  const [pendingSel, setPendingSel] = useState<{ start: number; end: number } | null>(null)
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashCaret, setSlashCaret] = useState<number>(0)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashFocus, setSlashFocus] = useState<'tasks' | 'bookmarks'>('tasks')
  const [slashIndex, setSlashIndex] = useState(0)

  useLayoutEffect(() => {
    if (!pendingSel || !ta.current) return
    ta.current.focus()
    ta.current.setSelectionRange(pendingSel.start, pendingSel.end)
    setPendingSel(null)
  }, [value, pendingSel])

  useEffect(() => {
    if (!slashOpen) return
    const t = window.setTimeout(() => slashInputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [slashOpen])

  const runOp = (op: DescriptionEditorOp) => {
    const el = ta.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const { text, selStart, selEnd } = applyDescriptionOp(value, start, end, op)
    onChange(text)
    setPendingSel({ start: selStart, end: selEnd })
  }

  const slashEnabled = !!slashCommands?.enabled && tab === 'edit'
  const taskCandidates = slashCommands?.tasks ?? []
  const bookmarkCandidates = slashCommands?.bookmarks ?? []

  const filteredTasks = useMemo(() => {
    const q = slashQuery.trim().toLowerCase()
    if (!q) return taskCandidates.slice(0, 12)
    return taskCandidates
      .filter((t) => (t.title || '').toLowerCase().includes(q))
      .slice(0, 12)
  }, [slashQuery, taskCandidates])

  const filteredBookmarks = useMemo(() => {
    const q = slashQuery.trim().toLowerCase()
    if (!q) return bookmarkCandidates.slice(0, 12)
    return bookmarkCandidates
      .filter((b) => (b.title || '').toLowerCase().includes(q) || (b.url || '').toLowerCase().includes(q))
      .slice(0, 12)
  }, [slashQuery, bookmarkCandidates])

  const insertAt = (pos: number, text: string) => {
    const next = value.slice(0, pos) + text + value.slice(pos)
    onChange(next)
    const c = pos + text.length
    setPendingSel({ start: c, end: c })
  }

  const closeSlash = () => {
    setSlashOpen(false)
    setSlashQuery('')
    setSlashIndex(0)
    setSlashFocus('tasks')
  }

  const chooseTask = (id: string, title: string) => {
    const label = (title || '작업').replace(/\]/g, ')')
    insertAt(slashCaret, `[${label}](todox-task:${id})`)
    closeSlash()
  }

  const chooseBookmark = (id: string, title: string) => {
    const label = (title || '북마크').replace(/\]/g, ')')
    insertAt(slashCaret, `[${label}](todox-bookmark:${id})`)
    closeSlash()
  }

  const rootClass =
    layout === 'noteFull'
      ? 'flex min-h-0 flex-1 flex-col rounded-md border border-neutral-200 bg-white focus-within:border-todoist-red focus-within:ring-1 focus-within:ring-todoist-red/25'
      : 'rounded-md border border-neutral-200 bg-white focus-within:border-todoist-red focus-within:ring-1 focus-within:ring-todoist-red/25'

  return (
    <div className={rootClass}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-2 py-1.5">
        {tab === 'edit' ? (
          <div className="flex flex-wrap gap-1">
            <ToolbarBtn label="B" title="굵게 (**)" onClick={() => runOp('bold')} />
            <ToolbarBtn label="I" title="기울임 (*)" onClick={() => runOp('italic')} />
            <ToolbarBtn label="S" title="취소선 (~~)" onClick={() => runOp('strike')} />
            <ToolbarBtn label="목록" title="글머리 목록" onClick={() => runOp('bullet')} />
            <ToolbarBtn label="번호" title="번호 목록" onClick={() => runOp('ordered')} />
            <ToolbarBtn label="인용" title="인용 (>) " onClick={() => runOp('quote')} />
            <ToolbarBtn label="코드" title="인라인 코드 (`)" onClick={() => runOp('code')} />
            <ToolbarBtn label="링크" title="링크 [텍스트](url)" onClick={() => runOp('link')} />
            <ToolbarBtn label="H2" title="제목 ##" onClick={() => runOp('heading')} />
          </div>
        ) : (
          <span className="text-xs text-neutral-400">미리보기 · 편집 탭에서 서식을 적용할 수 있습니다</span>
        )}
        <div className="ml-auto flex shrink-0 rounded-md border border-neutral-200 p-0.5 text-xs">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTab('edit')}
            className={`rounded px-2 py-0.5 ${tab === 'edit' ? 'bg-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-50'}`}
          >
            편집
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTab('preview')}
            className={`rounded px-2 py-0.5 ${tab === 'preview' ? 'bg-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-50'}`}
          >
            미리보기
          </button>
        </div>
      </div>

      {tab === 'edit' ? (
        <div
          className={
            layout === 'noteFull' ? 'relative flex min-h-0 flex-1 flex-col' : 'relative'
          }
        >
          <textarea
            ref={setTextareaRef}
            className={
              layout === 'noteFull'
                ? 'min-h-0 w-full flex-1 resize-none border-0 bg-transparent p-4 text-sm leading-5 outline-none'
                : 'w-full resize-y border-0 bg-transparent p-3 text-sm leading-5 outline-none'
            }
            style={layout === 'noteFull' ? { minHeight: '12rem' } : { minHeight: '8rem' }}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              const el = ta.current
              if (!el) return

              if (slashEnabled && e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                const caret = el.selectionStart
                const prev = caret > 0 ? value[caret - 1] : '\n'
                if (caret === 0 || prev === '\n' || /\s/.test(prev)) {
                  e.preventDefault()
                  setSlashCaret(caret)
                  setSlashOpen(true)
                  setSlashQuery('')
                  setSlashIndex(0)
                  setSlashFocus('tasks')
                  return
                }
              }

              if (smartLists && e.key === 'Tab') {
                const listTabIndent = layout === 'noteFull' ? '    ' : '  '
                const next = handleMarkdownTab(value, el.selectionStart, e.shiftKey ? 'out' : 'in', listTabIndent)
                if (!next) return
                e.preventDefault()
                onChange(next.text)
                setPendingSel({ start: next.caret, end: next.caret })
                return
              }

              if (smartLists && e.key === 'Enter') {
                if (e.shiftKey) return
                const next = handleMarkdownEnter(value, el.selectionStart)
                if (!next) return
                e.preventDefault()
                onChange(next.text)
                setPendingSel({ start: next.caret, end: next.caret })
              }
            }}
            onBlur={onBlur}
            spellCheck
          />

          {slashEnabled && slashOpen ? (
            <div className="absolute left-3 right-3 top-3 z-10 rounded-lg border border-neutral-200 bg-white p-3 shadow-xl">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">/ 검색</span>
                <input
                  ref={(x) => {
                    slashInputRef.current = x
                  }}
                  value={slashQuery}
                  onChange={(e) => {
                    setSlashQuery(e.target.value)
                    setSlashIndex(0)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      closeSlash()
                      return
                    }
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      setSlashFocus((f) => (f === 'tasks' ? 'bookmarks' : 'tasks'))
                      setSlashIndex(0)
                      return
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      const n = slashFocus === 'tasks' ? filteredTasks.length : filteredBookmarks.length
                      setSlashIndex((i) => Math.min(i + 1, Math.max(0, n - 1)))
                      return
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setSlashIndex((i) => Math.max(0, i - 1))
                      return
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (slashFocus === 'tasks') {
                        const t = filteredTasks[slashIndex]
                        if (t) chooseTask(t.id, t.title)
                      } else {
                        const b = filteredBookmarks[slashIndex]
                        if (b) chooseBookmark(b.id, b.title || b.url)
                      }
                    }
                  }}
                  placeholder="작업/북마크 검색… (Tab: 섹션 전환, Enter: 삽입)"
                  className="min-w-[14rem] flex-1 rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-todoist-red focus:ring-1 focus:ring-todoist-red/25"
                />
                <button
                  type="button"
                  className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  onClick={closeSlash}
                >
                  닫기
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`text-xs font-semibold ${slashFocus === 'tasks' ? 'text-todoist-red' : 'text-neutral-500'}`}>
                      작업
                    </span>
                    <span className="text-[11px] text-neutral-400">{filteredTasks.length}개</span>
                  </div>
                  <ul className="max-h-48 overflow-auto rounded-md border border-neutral-100">
                    {filteredTasks.length === 0 ? (
                      <li className="px-3 py-2 text-xs text-neutral-400">결과 없음</li>
                    ) : (
                      filteredTasks.map((t, i) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onMouseEnter={() => {
                              setSlashFocus('tasks')
                              setSlashIndex(i)
                            }}
                            onClick={() => chooseTask(t.id, t.title)}
                            className={`w-full truncate px-3 py-2 text-left text-sm ${
                              slashFocus === 'tasks' && slashIndex === i ? 'bg-red-50 text-neutral-900' : 'hover:bg-neutral-50'
                            }`}
                            title={t.title}
                          >
                            {t.title || '제목 없음'}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`text-xs font-semibold ${slashFocus === 'bookmarks' ? 'text-todoist-red' : 'text-neutral-500'}`}>
                      북마크
                    </span>
                    <span className="text-[11px] text-neutral-400">{filteredBookmarks.length}개</span>
                  </div>
                  <ul className="max-h-48 overflow-auto rounded-md border border-neutral-100">
                    {filteredBookmarks.length === 0 ? (
                      <li className="px-3 py-2 text-xs text-neutral-400">
                        결과 없음 (확장프로그램이 설치되어 있어야 자동으로 불러옵니다)
                      </li>
                    ) : (
                      filteredBookmarks.map((b, i) => (
                        <li key={b.id}>
                          <button
                            type="button"
                            onMouseEnter={() => {
                              setSlashFocus('bookmarks')
                              setSlashIndex(i)
                            }}
                            onClick={() => chooseBookmark(b.id, b.title || b.url)}
                            className={`w-full truncate px-3 py-2 text-left text-sm ${
                              slashFocus === 'bookmarks' && slashIndex === i
                                ? 'bg-red-50 text-neutral-900'
                                : 'hover:bg-neutral-50'
                            }`}
                            title={b.title || b.url}
                          >
                            {b.title || b.url}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-neutral-400">
                삽입된 항목은 미리보기에서 <span className="font-medium text-blue-600">파란색</span>으로 표시되며, 클릭하면 해당 화면으로 이동합니다.
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={
            layout === 'noteFull'
              ? `min-h-0 flex-1 overflow-y-auto p-4 ${MD_PREVIEW_PROSE}`
              : `max-h-64 min-h-[8rem] overflow-y-auto p-3 ${MD_PREVIEW_PROSE}`
          }
          role="document"
          aria-label="설명 미리보기"
        >
          <MarkdownPreviewBody source={value} slashCommands={slashCommands} />
        </div>
      )}
    </div>
  )
},
)
