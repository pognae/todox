export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function parseISODate(s: string): Date {
  const [y, m, day] = s.split('-').map(Number)
  return new Date(y, m - 1, day)
}

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toLocalISODate(d)
}

/** 로컬 기준 오늘 YYYY-MM-DD */
export function todayISO(): string {
  return toLocalISODate(startOfToday())
}

export function compareISODates(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function isOverdue(dueDate: string): boolean {
  return compareISODates(dueDate, todayISO()) < 0
}

export function isDueToday(dueDate: string): boolean {
  return dueDate === todayISO()
}

export function formatKoreanDate(iso: string): string {
  const d = parseISODate(iso)
  return new Intl.DateTimeFormat('ko-KR', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** 로컬 달력 기준 YYYY-MM-DD */
export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** month는 1–12 */
export function firstDayOfMonthISO(year: number, month1to12: number): string {
  return toLocalISODate(new Date(year, month1to12 - 1, 1))
}

/** 해당 월의 마지막 날 YYYY-MM-DD */
export function lastDayOfMonthISO(year: number, month1to12: number): string {
  return toLocalISODate(new Date(year, month1to12, 0))
}

/** 마감일이 해당 연·월에 속하는지 (로컬 기준) */
export function isDueInMonth(iso: string, year: number, month1to12: number): boolean {
  const start = firstDayOfMonthISO(year, month1to12)
  const end = lastDayOfMonthISO(year, month1to12)
  return compareISODates(iso, start) >= 0 && compareISODates(iso, end) <= 0
}

export function currentTimeHM(): string {
  const d = new Date()
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function compareHM(a: string, b: string): number {
  return a.localeCompare(b)
}

/** 날짜가 오늘 이전이거나, 오늘인데 마감 시각이 지났으면 true */
export function isOverdueWithTime(dueDate: string | null, dueTime: string | null): boolean {
  if (!dueDate) return false
  const t = todayISO()
  const c = compareISODates(dueDate, t)
  if (c < 0) return true
  if (c > 0) return false
  if (!dueTime) return false
  return compareHM(dueTime, currentTimeHM()) < 0
}

export function compareDueTime(a: string | null, b: string | null): number {
  if (a && b) return a.localeCompare(b)
  if (a && !b) return -1
  if (!a && b) return 1
  return 0
}

/** "HH:mm" → 로케일 표시 */
export function formatTimeKorean(hm: string): string {
  const [h, m] = hm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hm
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(2000, 0, 1, h, m))
}
