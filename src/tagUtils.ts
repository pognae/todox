import type { Task } from './types'

/** 공백·# 제거 후 소문자로 통일 */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
}

/** 빠른 추가 문자열에서 `#태그` 토큰을 뽑고 제목에서 제외합니다. */
export function parseQuickAdd(input: string): { title: string; tags: string[] } {
  const parts = input.trim().split(/\s+/).filter(Boolean)
  const tags: string[] = []
  const titleParts: string[] = []
  for (const p of parts) {
    if (p.startsWith('#') && p.length > 1) {
      const t = normalizeTag(p.slice(1))
      if (t) tags.push(t)
    } else {
      titleParts.push(p)
    }
  }
  return { title: titleParts.join(' ').trim(), tags: [...new Set(tags)] }
}

export function taskMatchesSearch(task: Pick<Task, 'title' | 'tags'>, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  if (task.title.toLowerCase().includes(s)) return true
  return task.tags.some((tag) => tag.includes(s))
}
