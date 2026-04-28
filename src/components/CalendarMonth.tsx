import { useMemo } from 'react'
import { compareDueTime, formatTimeKorean, isDueInMonth, toLocalISODate } from '../dateUtils'
import { buildTaskDisplayRows } from '../taskTree'
import { taskMatchesSearch } from '../tagUtils'
import { useTodo } from '../TodoContext'
import type { Task } from '../types'

function addCalendarMonths(
  year: number,
  month1to12: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month1to12 - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function buildGrid(year: number, month1to12: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month1to12 - 1, 1)
  const mondayIndex = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - mondayIndex)
  const cells: { date: Date; inMonth: boolean }[] = []
  const cur = new Date(start)
  for (let i = 0; i < 42; i++) {
    cells.push({
      date: new Date(cur),
      inMonth: cur.getMonth() === month1to12 - 1 && cur.getFullYear() === year,
    })
    cur.setDate(cur.getDate() + 1)
  }
  return cells
}

function sortTasksForCell(a: Task, b: Task): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  const pa = a.priority === 4 ? 5 : a.priority
  const pb = b.priority === 4 ? 5 : b.priority
  if (pa !== pb) return pa - pb
  const tc = compareDueTime(a.dueTime, b.dueTime)
  if (tc !== 0) return tc
  return b.createdAt.localeCompare(a.createdAt)
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

export function CalendarMonth() {
  const {
    view,
    setView,
    tasks,
    searchQuery,
    setSelectedTaskId,
    subtaskCounts,
    settings,
    openCalendarDayInput,
  } = useTodo()

  const isCal = view.type === 'calendar'
  const year = isCal ? view.year : new Date().getFullYear()
  const month = isCal ? view.month : new Date().getMonth() + 1

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>()
    if (!isCal) return m
    for (const t of tasks) {
      if (!t.dueDate || !isDueInMonth(t.dueDate, year, month)) continue
      if (!settings.showCompletedTasks && t.completed) continue
      if (!taskMatchesSearch(t, searchQuery)) continue
      if (!m.has(t.dueDate)) m.set(t.dueDate, [])
      m.get(t.dueDate)!.push(t)
    }
    for (const list of m.values()) list.sort(sortTasksForCell)
    return m
  }, [isCal, tasks, year, month, searchQuery, settings.showCompletedTasks])

  const cells = useMemo(() => buildGrid(year, month), [year, month])

  if (!isCal) return null

  const title = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1, 1))

  const go = (delta: number) => {
    const n = addCalendarMonths(year, month, delta)
    setView({ type: 'calendar', year: n.year, month: n.month })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            aria-label="이전 달"
          >
            ‹
          </button>
          <h2 className="min-w-[10rem] text-center text-lg font-semibold text-neutral-800">{title}</h2>
          <button
            type="button"
            onClick={() => go(1)}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          className="text-sm text-todoist-red hover:underline"
          onClick={() => {
            const t = new Date()
            setView({ type: 'calendar', year: t.getFullYear(), month: t.getMonth() + 1 })
          }}
        >
          오늘
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 shadow-sm">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="bg-neutral-100 px-1 py-2 text-center text-xs font-semibold text-neutral-500"
          >
            {w}
          </div>
        ))}
        {cells.map(({ date, inMonth }) => {
          const iso = toLocalISODate(date)
          const dayTasks = byDay.get(iso) ?? []
          const isToday = iso === toLocalISODate(new Date())
          return (
            <div
              key={iso + String(inMonth)}
              title="더블클릭: 설정「빠른 추가」기본 모드로 이 날짜에 작업 또는 노트 작성"
              className={`flex min-h-[88px] flex-col bg-white p-1 sm:min-h-[104px] sm:p-1.5 ${
                inMonth ? '' : 'opacity-40'
              }`}
              onDoubleClick={() => openCalendarDayInput(iso)}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span
                  className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full text-xs font-medium ${
                    isToday
                      ? 'bg-todoist-red text-white'
                      : inMonth
                        ? 'text-neutral-800'
                        : 'text-neutral-400'
                  }`}
                >
                  {date.getDate()}
                </span>
              </div>
              <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {buildTaskDisplayRows(dayTasks)
                  .slice(0, 4)
                  .map(({ task: t, depth }) => {
                    const sc = !t.parentId ? (subtaskCounts[t.id] ?? 0) : 0
                    return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(t.id)}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className={`w-full truncate rounded px-0.5 text-left text-[11px] leading-tight hover:bg-red-50 sm:text-xs ${
                        t.completed ? 'text-neutral-400 line-through' : 'text-neutral-700'
                      } ${depth > 0 ? 'pl-1.5' : ''}`}
                      title={
                        [
                          t.title,
                          t.dueTime ? formatTimeKorean(t.dueTime) : '',
                          sc > 0 ? `하위 ${sc}개` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      }
                    >
                      <span className="block truncate">
                        {depth > 0 ? <span className="text-neutral-400">· </span> : null}
                        {t.title || '제목 없음'}
                        {sc > 0 ? (
                          <span className="ml-1 text-[10px] font-medium text-neutral-500">({sc})</span>
                        ) : null}
                      </span>
                      {t.dueTime && (
                        <span className="block truncate text-[9px] font-normal text-neutral-400 sm:text-[10px]">
                          {formatTimeKorean(t.dueTime)}
                        </span>
                      )}
                    </button>
                  </li>
                    )
                  })}
                {dayTasks.length > 4 && (
                  <li
                    className="text-[10px] text-neutral-400"
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    +{dayTasks.length - 4}
                  </li>
                )}
              </ul>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-neutral-500">
        마감일이 있는 작업만 달력에 표시됩니다. 검색창으로 태그·제목을 걸러 낼 수 있습니다. 날짜 칸을 더블클릭하면 설정의「빠른 추가」기본 모드(작업/노트)에 따라 그날 마감으로 작업을 만들거나 노트 편집기를 엽니다.
      </p>
    </div>
  )
}
