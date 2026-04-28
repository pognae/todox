import type { Task } from './types'

/** 빠른 추가로 만든 노트 제목 패턴 ("…년 …월 …일 …요일 노트")의 느슨한 허용 */
export function looksLikeDailyNoteTitle(title: string): boolean {
  const t = title.trim()
  if (!t.endsWith(' 노트')) return false
  return /\d{4}\s*년/.test(t) && /\d{1,2}\s*월/.test(t) && /\d{1,2}\s*일/.test(t)
}

export function isNoteLikeTask(task: Task): boolean {
  return looksLikeDailyNoteTitle(task.title)
}
