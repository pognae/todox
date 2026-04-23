import { compareDueTime, compareISODates } from './dateUtils'
import type { Task } from './types'

/** 목록·캘린더 등에서 동일 정렬 */
export function compareTaskOrder(a: Task, b: Task): number {
  const pa = a.priority === 4 ? 5 : a.priority
  const pb = b.priority === 4 ? 5 : b.priority
  if (pa !== pb) return pa - pb
  const da = a.dueDate ?? '9999-99-99'
  const db = b.dueDate ?? '9999-99-99'
  const c = compareISODates(da, db)
  if (c !== 0) return c
  const tc = compareDueTime(a.dueTime, b.dueTime)
  if (tc !== 0) return tc
  return b.createdAt.localeCompare(a.createdAt)
}

/**
 * 필터된 작업 목록을 "부모 → 바로 아래 하위" 순으로 펼칩니다.
 * 하위는 한 단계만(부모가 목록에 있으면 그 아래에만 표시).
 */
export function buildTaskDisplayRows(visible: Task[]): { task: Task; depth: number }[] {
  const ids = new Set(visible.map((t) => t.id))
  const rootsOrdered: Task[] = []
  const seenRoot = new Set<string>()
  for (const t of visible) {
    const isNestedChild = t.parentId != null && ids.has(t.parentId)
    if (isNestedChild) continue
    if (!seenRoot.has(t.id)) {
      rootsOrdered.push(t)
      seenRoot.add(t.id)
    }
  }

  const out: { task: Task; depth: number }[] = []
  for (const r of rootsOrdered) {
    const isOrphan = r.parentId != null && !ids.has(r.parentId)
    out.push({ task: r, depth: 0 })
    if (isOrphan || r.parentId != null) continue
    const kids = visible.filter((t) => t.parentId === r.id).sort(compareTaskOrder)
    for (const k of kids) {
      out.push({ task: k, depth: 1 })
    }
  }
  return out
}
