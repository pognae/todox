import { formatKoreanDate, formatTimeKorean, isOverdueWithTime } from '../dateUtils'
import type { Task } from '../types'
import { useTodo } from '../TodoContext'

const priorityDot: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-400',
  3: 'bg-blue-500',
  4: 'bg-transparent',
}

export function TaskItem({ task, depth = 0 }: { task: Task; depth?: number }) {
  const {
    toggleTaskCompleted,
    setSelectedTaskId,
    selectedTaskId,
    projectForTask,
    setSearchQuery,
    subtaskCounts,
  } = useTodo()
  const selected = selectedTaskId === task.id
  const proj = projectForTask(task)
  const overdue =
    task.dueDate && !task.completed && isOverdueWithTime(task.dueDate, task.dueTime)
  const isSub = depth > 0
  const subCount = !task.parentId ? (subtaskCounts[task.id] ?? 0) : 0

  const openDetail = () => setSelectedTaskId(task.id)

  return (
    <div
      className={`group flex items-start gap-3 border-b border-neutral-100 py-3 transition-colors ${
        selected ? 'bg-red-50/50' : 'hover:bg-neutral-50'
      } ${isSub ? 'border-l-2 border-l-neutral-200 bg-neutral-50/50 pl-3 pr-1' : 'px-1'}`}
    >
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

      <div
        role="presentation"
        className="min-w-0 flex-1 cursor-pointer text-left"
        onClick={openDetail}
      >
        <div className="flex items-center gap-2">
          {isSub && (
            <span className="shrink-0 text-xs text-neutral-400" title="하위 작업">
              └
            </span>
          )}
          <span
            className={`block min-w-0 truncate text-sm ${
              task.completed ? 'text-neutral-400 line-through' : 'text-neutral-800'
            }`}
          >
            {task.title}
          </span>
          {task.recurrence && (
            <span className="shrink-0 text-neutral-400" title="반복 작업">
              ⟳
            </span>
          )}
          {task.priority < 4 && (
            <span className={`h-2 w-2 shrink-0 rounded-full ${priorityDot[task.priority]}`} />
          )}
          {subCount > 0 && (
            <span
              className="shrink-0 rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600"
              title={`하위 작업 ${subCount}개`}
            >
              하위 {subCount}개
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
          {task.dueDate && (
            <span className={overdue ? 'font-medium text-red-600' : ''}>
              {formatKoreanDate(task.dueDate)}
              {task.dueTime && (
                <>
                  {' '}
                  <span className="tabular-nums">{formatTimeKorean(task.dueTime)}</span>
                </>
              )}
            </span>
          )}
          {proj && !proj.isInbox && (
            <span className="flex items-center gap-1 truncate">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: proj.color }} />
              {proj.name}
            </span>
          )}
          {task.tags.length > 0 && (
            <span className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
              {task.tags.slice(0, 4).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSearchQuery(tag)}
                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600 hover:bg-red-100 hover:text-todoist-red"
                >
                  #{tag}
                </button>
              ))}
              {task.tags.length > 4 && (
                <span className="text-neutral-400">+{task.tags.length - 4}</span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
