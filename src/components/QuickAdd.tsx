import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTodo } from '../TodoContext'
import type { QuickAddMode } from '../types'

export function QuickAdd() {
  const { addTask, viewTitle, settings, setSearchQuery } = useTodo()
  const [value, setValue] = useState('')
  const [mode, setMode] = useState<QuickAddMode>(settings.defaultQuickAddMode)
  const noteRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setMode(settings.defaultQuickAddMode)
  }, [settings.defaultQuickAddMode])

  const autosizeNote = () => {
    const el = noteRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    if (mode !== 'note') return
    autosizeNote()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, value])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    // 검색어가 걸려 있으면 새로 추가한 작업이 바로 안 보일 수 있어 초기화
    setSearchQuery('')
    addTask(value, { mode })
    setValue('')
  }

  return (
    <form onSubmit={onSubmit} className="mb-4">
      <div className="flex overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm focus-within:border-todoist-red focus-within:ring-1 focus-within:ring-todoist-red/30">
        <div
          className="flex shrink-0 items-stretch border-r border-neutral-200 bg-neutral-50 p-1"
          role="group"
          aria-label="빠른 추가: 작업 또는 노트"
        >
          <button
            type="button"
            onClick={() => setMode('task')}
            className={`rounded px-2.5 py-2 text-xs font-medium transition-colors ${
              mode === 'task'
                ? 'bg-white text-todoist-red shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            작업
          </button>
          <button
            type="button"
            onClick={() => setMode('note')}
            className={`rounded px-2.5 py-2 text-xs font-medium transition-colors ${
              mode === 'note'
                ? 'bg-white text-todoist-red shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            노트
          </button>
        </div>
        {mode === 'task' ? (
          <input
            className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-neutral-400"
            placeholder={`‘${viewTitle}’에 작업 추가`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : (
          <textarea
            ref={noteRef}
            rows={1}
            className="min-w-0 flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm leading-5 outline-none placeholder:text-neutral-400"
            placeholder="노트 본문 입력 (제목은 오늘 날짜로 자동 지정)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onInput={autosizeNote}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              if (e.shiftKey) return // 줄바꿈
              e.preventDefault()
              ;(e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()
            }}
          />
        )}
      </div>
      <p className="mt-1.5 text-xs text-neutral-400">
        {mode === 'task' ? (
          <>
            Enter로 추가 · 공백으로 구분해 <code className="rounded bg-neutral-100 px-1">#태그</code> 입력 가능 ·
            마감일은 작업 상세에서 설정
          </>
        ) : (
          <>Enter로 추가 · Shift+Enter로 줄바꿈 · 제목은 「오늘 날짜 + 노트」형식이며, 위 입력은 설명란에 저장됩니다.</>
        )}
      </p>
    </form>
  )
}
