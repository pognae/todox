import type { Task } from './types'

/** 빠른 추가로 만든 노트 제목 패턴 ("…년 …월 …일 …요일 노트")의 느슨한 허용 */
export function looksLikeDailyNoteTitle(title: string): boolean {
  const t = title.trim().replace(/\s+/g, ' ')
  if (!t.endsWith(' 노트')) return false
  return /\d{4}\s*년/.test(t) && /\d{1,2}\s*월/.test(t) && /\d{1,2}\s*일/.test(t)
}

/** 노트 메뉴·노트 편집기 라우팅: 명시 플래그 우선, 없으면 제목 패턴으로 추정 */
export function isNoteTask(task: Task): boolean {
  if (task.isNote === true) return true
  if (task.isNote === false) return false
  return looksLikeDailyNoteTitle(task.title)
}

/** 저장 전 구버전 데이터 보정: 제목만 보고 isNote 채움 */
export function withInferredNoteMeta(t: Task): Task {
  if (t.isNote === true || t.isNote === false) return t
  if (looksLikeDailyNoteTitle(t.title)) return { ...t, isNote: true }
  return t
}

/** @deprecated isNoteTask 사용 */
export function isNoteLikeTask(task: Task): boolean {
  return isNoteTask(task)
}
