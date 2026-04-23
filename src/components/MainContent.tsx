import { useMemo } from 'react'
import { formatKoreanDate } from '../dateUtils'
import { buildTaskDisplayRows } from '../taskTree'
import { useTodo } from '../TodoContext'
import type { Task } from '../types'
import { CalendarMonth } from './CalendarMonth'
import { QuickAdd } from './QuickAdd'
import { TaskItem } from './TaskItem'

function groupUpcoming(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!t.dueDate) continue
    const key = t.dueDate
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  const keys = [...map.keys()].sort()
  const ordered = new Map<string, Task[]>()
  for (const k of keys) ordered.set(k, map.get(k)!)
  return ordered
}

export function MainContent() {
  const { viewTitle, visibleTasks, view, searchQuery, setSearchQuery } = useTodo()

  const upcomingGroups = useMemo(() => {
    if (view.type !== 'upcoming') return null
    return groupUpcoming(visibleTasks)
  }, [view.type, visibleTasks])

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-surface px-6 py-6 md:px-10">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-neutral-800 md:text-2xl">{viewTitle}</h1>
        <div className="relative w-full sm:max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="태그·제목 검색"
            className="w-full rounded-md border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-todoist-red focus:ring-1 focus:ring-todoist-red/25"
            aria-label="태그 및 제목 검색"
          />
        </div>
      </header>

      {view.type === 'calendar' ? (
        <>
          <QuickAdd />
          <CalendarMonth />
        </>
      ) : (
        <>
          <QuickAdd />

      {view.type === 'upcoming' && upcomingGroups ? (
        upcomingGroups.size === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">예정된 마감일이 있는 작업이 없습니다.</p>
        ) : (
          <div className="space-y-8">
            {[...upcomingGroups.entries()].map(([date, list]) => (
              <section key={date}>
                <h2 className="mb-2 text-sm font-semibold text-neutral-600">
                  {formatKoreanDate(date)}{' '}
                  <span className="font-normal text-neutral-400">({date})</span>
                </h2>
                <div className="rounded-lg border border-neutral-200 bg-white px-3 shadow-sm">
                  {buildTaskDisplayRows(list).map(({ task: t, depth }) => (
                    <TaskItem key={t.id} task={t} depth={depth} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : visibleTasks.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-500">
          표시할 작업이 없습니다. 위에서 새 작업을 추가해 보세요.
        </p>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white px-3 shadow-sm">
          {buildTaskDisplayRows(visibleTasks).map(({ task: t, depth }) => (
            <TaskItem key={t.id} task={t} depth={depth} />
          ))}
        </div>
      )}
        </>
      )}
    </main>
  )
}
