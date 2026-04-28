import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DescriptionEditor } from './DescriptionEditor'
import { formatKoreanDate } from '../dateUtils'
import { normalizeTag } from '../tagUtils'
import { useTodo } from '../TodoContext'
import { normalizeOrderedMarkers } from '../descriptionMarkdown'

export function NoteDetailPanel() {
  const {
    tasks,
    bookmarks,
    selectedTaskId,
    setSelectedTaskId,
    setView,
    updateTask,
    removeTask,
    toggleTaskCompleted,
    projects,
    detailPanelFocusRequest,
    clearDetailPanelFocusRequest,
  } = useTodo()

  const task = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  )

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [projectId, setProjectId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    if (!task || detailPanelFocusRequest !== 'note-description') return
    const el = descriptionTextareaRef.current
    if (!el) return
    el.focus()
    clearDetailPanelFocusRequest()
  }, [task, detailPanelFocusRequest, clearDetailPanelFocusRequest])

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(normalizeOrderedMarkers(task.description))
    setDueDate(task.dueDate ?? '')
    setDueTime(task.dueTime ?? '')
    setProjectId(task.projectId)
    setTags([...task.tags])
    setTagDraft('')
  }, [task])

  if (!task) return null

  const persistTags = (next: string[]) => {
    const clean = [...new Set(next.map((x) => normalizeTag(x)).filter(Boolean))]
    setTags(clean)
    updateTask(task.id, { tags: clean })
  }

  const save = () => {
    updateTask(task.id, {
      title: title.trim() || task.title,
      description,
      dueDate: dueDate || null,
      dueTime: dueTime.trim() || null,
      projectId,
      tags: [...new Set(tags.map((x) => normalizeTag(x)).filter(Boolean))],
    })
  }

  const onClose = () => {
    save()
    setSelectedTaskId(null)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/30" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-detail-title"
        className="flex h-full w-full flex-col bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h2 id="note-detail-title" className="text-sm font-medium text-neutral-500">
            노트 편집
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="닫기"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-neutral-100 lg:border-b-0 lg:border-r">
            <div className="flex items-start gap-3 border-b border-neutral-100 px-4 py-3">
              <button
                type="button"
                title={task.completed ? '완료 취소' : '완료'}
                onClick={() => toggleTaskCompleted(task.id)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  task.completed
                    ? 'border-todoist-red bg-todoist-red text-white'
                    : 'border-neutral-300 hover:border-todoist-red'
                }`}
              >
                {task.completed && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              <input
                className="min-w-0 flex-1 border-0 border-b border-transparent pb-2 text-lg font-medium text-neutral-900 outline-none focus:border-todoist-red"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={save}
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
              <DescriptionEditor
                key={task.id}
                ref={descriptionTextareaRef}
                value={description}
                onChange={setDescription}
                onBlur={save}
                placeholder="마크다운으로 노트를 작성하세요. (Enter로 불릿/번호 목록 이어쓰기 · 목록 줄에서 Tab/Shift+Tab으로 한 단계 스페이스 4칸 들여쓰기 · Shift+Enter로 줄바꿈)"
                smartLists
                layout="noteFull"
                slashCommands={{
                  enabled: true,
                  tasks,
                  bookmarks,
                  onOpenTask: (id) => setSelectedTaskId(id),
                  onOpenBookmarks: () => setView({ type: 'bookmarks' }),
                }}
              />
            </div>
          </div>

          <aside className="w-full shrink-0 overflow-y-auto border-t border-neutral-100 bg-neutral-50 px-4 py-4 lg:w-80 lg:border-l lg:border-t-0">
            <div className="space-y-4">
              <div>
                <span className="mb-1 block text-xs font-medium uppercase text-neutral-400">태그</span>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-neutral-700 shadow-sm ring-1 ring-neutral-200"
                    >
                      #{tag}
                      <button
                        type="button"
                        className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
                        aria-label={`${tag} 태그 제거`}
                        onClick={() => persistTags(tags.filter((x) => x !== tag))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  className="w-full rounded-md border border-neutral-200 bg-white px-2 py-2 text-sm outline-none focus:border-todoist-red"
                  placeholder="태그 입력 후 Enter"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    const n = normalizeTag(tagDraft)
                    setTagDraft('')
                    if (!n || tags.includes(n)) return
                    persistTags([...tags, n])
                  }}
                />
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase text-neutral-400">날짜</span>
                <input
                  type="date"
                  className="w-full rounded-md border border-neutral-200 bg-white px-2 py-2 text-sm outline-none focus:border-todoist-red"
                  value={dueDate}
                  onChange={(e) => {
                    const v = e.target.value
                    setDueDate(v)
                    if (!v) {
                      setDueTime('')
                      updateTask(task.id, { dueDate: null, dueTime: null })
                    } else {
                      updateTask(task.id, { dueDate: v })
                    }
                  }}
                  onBlur={save}
                />
                {dueDate && (
                  <p className="mt-1 text-xs text-neutral-500">
                    표시: <span className="tabular-nums">{formatKoreanDate(dueDate)}</span>
                  </p>
                )}
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase text-neutral-400">시간</span>
                <input
                  type="time"
                  disabled={!dueDate}
                  className="w-full rounded-md border border-neutral-200 bg-white px-2 py-2 text-sm outline-none focus:border-todoist-red disabled:cursor-not-allowed disabled:bg-neutral-100"
                  value={dueTime}
                  onChange={(e) => {
                    const v = e.target.value
                    setDueTime(v)
                    updateTask(task.id, { dueTime: v || null })
                  }}
                  onBlur={save}
                />
                {!dueDate && (
                  <p className="mt-1 text-xs text-neutral-500">날짜를 먼저 정하면 시간을 넣을 수 있습니다.</p>
                )}
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase text-neutral-400">프로젝트</span>
                <select
                  className="w-full rounded-md border border-neutral-200 bg-white px-2 py-2 text-sm outline-none focus:border-todoist-red"
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value)
                    updateTask(task.id, { projectId: e.target.value })
                  }}
                  onBlur={save}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="w-full rounded-md border border-red-200 bg-white py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (confirm('이 노트를 삭제할까요?')) removeTask(task.id)
                }}
              >
                노트 삭제
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
