import { useMemo } from 'react'
import { isNoteLikeTask } from '../noteUtils'
import { useTodo } from '../TodoContext'
import { formatKoreanDate } from '../dateUtils'

export function NotesPanel() {
  const { tasks, searchQuery, setSelectedTaskId } = useTodo()

  const notes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return tasks
      .filter((t) => isNoteLikeTask(t))
      .filter((t) => {
        if (!q) return true
        return (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
      })
      .sort((a, b) => {
        const da = a.dueDate ?? '0000-00-00'
        const db = b.dueDate ?? '0000-00-00'
        if (da !== db) return db.localeCompare(da)
        return (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)
      })
  }, [tasks, searchQuery])

  if (notes.length === 0) {
    return <p className="py-12 text-center text-sm text-neutral-500">노트가 없습니다. 빠른 추가(노트)로 만들어 보세요.</p>
  }

  return (
    <div className="space-y-2">
      {notes.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setSelectedTaskId(t.id)}
          className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-neutral-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-neutral-800">
                {t.title || '제목 없음'}
                {t.completed ? <span className="ml-2 text-xs font-medium text-neutral-400">(완료)</span> : null}
              </div>
              {t.description?.trim() ? (
                <div className="mt-1 line-clamp-2 text-xs text-neutral-500">{t.description.trim()}</div>
              ) : (
                <div className="mt-1 text-xs text-neutral-400">내용 없음</div>
              )}
            </div>
            <div className="shrink-0 text-xs text-neutral-400">
              {t.dueDate ? formatKoreanDate(t.dueDate) : ''}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

