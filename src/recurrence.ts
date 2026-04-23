import { addDays, parseISODate, toLocalISODate } from './dateUtils'
import type { TaskRecurrence } from './types'

/** 다음 평일(월–금) 날짜 */
function nextWeekdayFrom(iso: string): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1)
  }
  return toLocalISODate(d)
}

/**
 * 완료 시점 기준 다음 마감일(당일은 건너뜀).
 * `fromDate`는 현재 작업의 마감일(ISO).
 */
export function computeNextDueDate(fromDate: string, rule: TaskRecurrence): string {
  switch (rule.type) {
    case 'daily':
      return addDays(fromDate, 1)
    case 'weekdays':
      return nextWeekdayFrom(fromDate)
    case 'weekly':
      return addDays(fromDate, 7)
    case 'monthly': {
      const d = parseISODate(fromDate)
      d.setMonth(d.getMonth() + 1)
      return toLocalISODate(d)
    }
  }
}
