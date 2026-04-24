import { useLayoutEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { applyDescriptionOp, type DescriptionEditorOp } from '../descriptionMarkdown'

type Tab = 'edit' | 'preview'

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

export function DescriptionEditor({
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
}) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<Tab>('edit')
  const [pendingSel, setPendingSel] = useState<{ start: number; end: number } | null>(null)

  useLayoutEffect(() => {
    if (!pendingSel || !ta.current) return
    ta.current.focus()
    ta.current.setSelectionRange(pendingSel.start, pendingSel.end)
    setPendingSel(null)
  }, [value, pendingSel])

  const runOp = (op: DescriptionEditorOp) => {
    const el = ta.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const { text, selStart, selEnd } = applyDescriptionOp(value, start, end, op)
    onChange(text)
    setPendingSel({ start: selStart, end: selEnd })
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-white focus-within:border-todoist-red focus-within:ring-1 focus-within:ring-todoist-red/25">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-2 py-1.5">
        {tab === 'edit' ? (
          <div className="flex flex-wrap gap-1">
            <ToolbarBtn label="B" title="굵게 (**)" onClick={() => runOp('bold')} />
            <ToolbarBtn label="I" title="기울임 (*)" onClick={() => runOp('italic')} />
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
        <textarea
          ref={ta}
          className="w-full resize-y border-0 bg-transparent p-3 text-sm outline-none"
          style={{ minHeight: '8rem' }}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          spellCheck
        />
      ) : (
        <div
          className="max-h-64 min-h-[8rem] overflow-y-auto whitespace-pre-wrap p-3 text-sm text-neutral-800 [&_a]:text-todoist-red [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600 [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
          role="document"
          aria-label="설명 미리보기"
        >
          {value.trim() ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <p className="text-neutral-400">내용이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}
