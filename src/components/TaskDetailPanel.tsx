import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { compareTaskOrder } from '../taskTree'
import { DescriptionEditor } from './DescriptionEditor'
import { useTodo } from '../TodoContext'
import { normalizeTag } from '../tagUtils'
import type { Priority, RecurrenceType, TaskRecurrence } from '../types'

const RECURRENCE_OPTIONS: { value: '' | RecurrenceType; label: string }[] = [
  { value: '', label: '반복 없음' },
  { value: 'daily', label: '매일' },
  { value: 'weekdays', label: '매 평일 (월–금)' },
  { value: 'weekly', label: '매주 같은 요일' },
  { value: 'monthly', label: '매월 같은 날' },
]

export function TaskDetailPanel() {
  const {
    tasks,
    selectedTaskId,
    setSelectedTaskId,
    updateTask,
    removeTask,
    projects,
    addSubtask,
    toggleTaskCompleted,
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
  const [priority, setPriority] = useState<Priority>(4)
  const [projectId, setProjectId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [recurrenceType, setRecurrenceType] = useState<'' | RecurrenceType>('')
  const [subDraft, setSubDraft] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (!task || detailPanelFocusRequest !== 'task-title') return
    const el = titleInputRef.current
    if (!el) return
    el.focus()
    el.select()
    clearDetailPanelFocusRequest()
  }, [task, detailPanelFocusRequest, clearDetailPanelFocusRequest])

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description)
    setDueDate(task.dueDate ?? '')
    setDueTime(task.dueTime ?? '')
    setPriority(task.priority)
    setProjectId(task.projectId)
    setTags([...task.tags])
    setTagDraft('')
    setRecurrenceType(task.recurrence?.type ?? '')
    setSubDraft('')
  }, [task])

  const parentTask = useMemo(() => {
    if (!task?.parentId) return null
    return tasks.find((x) => x.id === task.parentId) ?? null
  }, [tasks, task])

  const childTasks = useMemo(() => {
    if (!task) return []
    return tasks.filter((x) => x.parentId === task.id).sort(compareTaskOrder)
  }, [tasks, task])

  if (!task) return null

  const persistTags = (next: string[]) => {
    const clean = [...new Set(next.map((x) => normalizeTag(x)).filter(Boolean))]
    setTags(clean)
    updateTask(task.id, { tags: clean })
  }

  const save = () => {
    const nextRecurrence: TaskRecurrence | null =
      dueDate && recurrenceType ? { type: recurrenceType } : null
    updateTask(task.id, {
      title: title.trim() || task.title,
      description,
      dueDate: dueDate || null,
      dueTime: dueTime.trim() || null,
      priority,
      projectId,
      tags: [...new Set(tags.map((x) => normalizeTag(x)).filter(Boolean))],
      recurrence: nextRecurrence,
    })
  }

  const onClose = () => {
    save()
    setSelectedTaskId(null)
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/20" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h2 id="task-detail-title" className="text-sm font-medium text-neutral-500">
            작업 상세
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

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {parentTask && (
            <button
              type="button"
              onClick={() => setSelectedTaskId(parentTask.id)}
              className="w-full truncate rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs text-neutral-600 hover:bg-neutral-100"
            >
              <span className="text-neutral-400">상위 작업</span>{' '}
              <span className="font-medium text-neutral-800">{parentTask.title}</span>
            </button>
          )}

          <input
            ref={titleInputRef}
            className="w-full border-0 border-b border-transparent pb-2 text-lg font-medium text-neutral-900 outline-none focus:border-todoist-red"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
          />

          <div className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-neutral-400">설명</span>
            <DescriptionEditor
              value={description}
              onChange={setDescription}
              onBlur={save}
              placeholder="세부 내용을 적어 보세요. 위 도구로 굵게·목록·링크 등 마크다운을 넣을 수 있습니다."
            />
          </div>

          {task.parentId == null ? (
            <div>
              <span className="mb-2 block text-xs font-medium uppercase text-neutral-400">하위 작업</span>
              {childTasks.length > 0 ? (
                <ul className="mb-2 divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-neutral-50/50">
                  {childTasks.map((c) => (
                    <li key={c.id} className="flex items-start gap-2 px-2 py-2">
                      <button
                        type="button"
                        title={c.completed ? '완료 취소' : '완료'}
                        onClick={() => toggleTaskCompleted(c.id)}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          c.completed
                            ? 'border-todoist-red bg-todoist-red text-white'
                            : 'border-neutral-300 hover:border-todoist-red'
                        }`}
                      >
                        {c.completed && (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTaskId(c.id)}
                        className={`min-w-0 flex-1 text-left text-sm ${
                          c.completed ? 'text-neutral-400 line-through' : 'text-neutral-800'
                        }`}
                      >
                        {c.title}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-2 text-xs text-neutral-400">아직 하위 작업이 없습니다.</p>
              )}
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-2 text-sm outline-none focus:border-todoist-red"
                  placeholder="하위 작업 제목"
                  value={subDraft}
                  onChange={(e) => setSubDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    // 한글 등 IME 조합 중 Enter는 조합 확정용으로 한 번 더 올 수 있음
                    if (e.nativeEvent.isComposing) return
                    e.preventDefault()
                    e.stopPropagation()
                    if (!subDraft.trim()) return
                    const requestId = `kbd:${task.id}:${Math.floor(e.timeStamp)}:${subDraft.trim()}`
                    addSubtask(task.id, subDraft, requestId)
                    setSubDraft('')
                  }}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-md bg-todoist-red px-3 py-2 text-sm font-medium text-white hover:bg-todoist-red-hover"
                  onClick={() => {
                    if (!subDraft.trim()) return
                    const requestId = `clk:${task.id}:${Date.now()}:${subDraft.trim()}`
                    addSubtask(task.id, subDraft, requestId)
                    setSubDraft('')
                  }}
                >
                  추가
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
              하위 작업에는 더 이상 하위 작업을 만들 수 없습니다.
            </p>
          )}

          <div>
            <span className="mb-1 block text-xs font-medium uppercase text-neutral-400">태그</span>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
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
              className="w-full rounded-md border border-neutral-200 px-2 py-2 text-sm outline-none focus:border-todoist-red"
              placeholder="태그 입력 후 Enter (# 없이 입력해도 됩니다)"
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
            <span className="mb-1 block text-xs font-medium uppercase text-neutral-400">마감일</span>
            <input
              type="date"
              className="w-full rounded-md border border-neutral-200 px-2 py-2 text-sm outline-none focus:border-todoist-red"
              value={dueDate}
              onChange={(e) => {
                const v = e.target.value
                setDueDate(v)
                if (!v) {
                  setDueTime('')
                  setRecurrenceType('')
                  updateTask(task.id, { dueDate: null, dueTime: null, recurrence: null })
                } else {
                  updateTask(task.id, { dueDate: v })
                }
              }}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-neutral-400">마감 시간</span>
            <input
              type="time"
              disabled={!dueDate}
              className="w-full rounded-md border border-neutral-200 px-2 py-2 text-sm outline-none focus:border-todoist-red disabled:cursor-not-allowed disabled:bg-neutral-100"
              value={dueTime}
              onChange={(e) => {
                const v = e.target.value
                setDueTime(v)
                updateTask(task.id, { dueTime: v || null })
              }}
            />
            {!dueDate && (
              <p className="mt-1 text-xs text-neutral-400">마감일을 먼저 정하면 시간을 넣을 수 있습니다.</p>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-neutral-400">반복</span>
            <select
              disabled={!dueDate}
              className="w-full rounded-md border border-neutral-200 px-2 py-2 text-sm outline-none focus:border-todoist-red disabled:cursor-not-allowed disabled:bg-neutral-100"
              value={recurrenceType}
              onChange={(e) => {
                const v = e.target.value as '' | RecurrenceType
                setRecurrenceType(v)
                const next: TaskRecurrence | null = v && dueDate ? { type: v } : null
                updateTask(task.id, { recurrence: next })
              }}
            >
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value || 'none'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {!dueDate && (
              <p className="mt-1 text-xs text-neutral-400">반복은 마감일이 있을 때만 설정할 수 있습니다.</p>
            )}
          </label>

          <div>
            <span className="mb-2 block text-xs font-medium uppercase text-neutral-400">우선순위</span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { v: 1 as Priority, l: '긴급', c: 'border-red-200 bg-red-50 text-red-800' },
                  { v: 2 as Priority, l: '높음', c: 'border-orange-200 bg-orange-50 text-orange-900' },
                  { v: 3 as Priority, l: '보통', c: 'border-blue-200 bg-blue-50 text-blue-900' },
                  { v: 4 as Priority, l: '없음', c: 'border-neutral-200 bg-neutral-50 text-neutral-700' },
                ] as const
              ).map(({ v, l, c }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setPriority(v)
                    updateTask(task.id, { priority: v })
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    priority === v ? `${c} ring-2 ring-todoist-red/40` : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-neutral-400">프로젝트</span>
            <select
              className="w-full rounded-md border border-neutral-200 px-2 py-2 text-sm outline-none focus:border-todoist-red"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value)
                updateTask(task.id, { projectId: e.target.value })
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-auto border-t border-neutral-100 pt-4">
            <button
              type="button"
              className="w-full rounded-md border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              onClick={() => {
                if (confirm('이 작업을 삭제할까요?')) removeTask(task.id)
              }}
            >
              작업 삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
