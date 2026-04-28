import type { PersistedState } from './storage'
import type { AppSettings, Bookmark, Project, Task } from './types'

function defaultSettings(): AppSettings {
  return {
    defaultReminderTime: '09:00',
    notificationsEnabled: false,
    showCompletedTasks: true,
    defaultQuickAddMode: 'task',
    detailEditorForTodo: 'todo',
    detailEditorForNote: 'auto',
  }
}

function mergeSettings(local?: AppSettings, remote?: AppSettings): AppSettings {
  const base = defaultSettings()
  return {
    ...base,
    ...(remote ?? {}),
    ...(local ?? {}),
  }
}

function timeOf(x: { updatedAt?: string; createdAt?: string } | null | undefined): number {
  const s = x?.updatedAt ?? x?.createdAt
  if (!s) return 0
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : 0
}

function mergeTags(a: string[] | undefined, b: string[] | undefined): string[] {
  return [...new Set([...(a ?? []), ...(b ?? [])])]
}

function chooseNewer<T extends { updatedAt?: string; createdAt?: string }>(a: T, b: T): T {
  return timeOf(a) >= timeOf(b) ? a : b
}

function mergeTasks(local: Task[], remote: Task[]): Task[] {
  const map = new Map<string, Task>()

  for (const t of remote) map.set(t.id, t)

  for (const lt of local) {
    const rt = map.get(lt.id)
    if (!rt) {
      map.set(lt.id, lt)
      continue
    }

    const winner = chooseNewer(lt, rt)
    const loser = winner === lt ? rt : lt

    map.set(lt.id, {
      ...winner,
      // 태그는 합치기
      tags: mergeTags(winner.tags, loser.tags),
      // winner의 타임스탬프 보존(없으면 createdAt을 updatedAt처럼 취급)
      updatedAt: winner.updatedAt ?? winner.createdAt,
    })
  }

  return [...map.values()]
}

function mergeProjects(local: Project[], remote: Project[]): Project[] {
  const map = new Map<string, Project>()
  for (const p of remote) map.set(p.id, p)

  for (const lp of local) {
    const rp = map.get(lp.id)
    if (!rp) {
      map.set(lp.id, lp)
      continue
    }
    const winner = chooseNewer(
      { ...lp, createdAt: lp.updatedAt ?? '' } as unknown as Project & { createdAt: string },
      { ...rp, createdAt: rp.updatedAt ?? '' } as unknown as Project & { createdAt: string },
    ) as Project
    const loser = winner === lp ? rp : lp

    map.set(lp.id, {
      ...winner,
      // inbox 플래그는 보수적으로 유지(둘 중 하나라도 inbox면 inbox)
      isInbox: winner.isInbox || loser.isInbox || undefined,
      updatedAt: winner.updatedAt ?? loser.updatedAt,
    })
  }

  return [...map.values()]
}

function mergeBookmarks(local: Bookmark[] | undefined, remote: Bookmark[] | undefined): Bookmark[] | undefined {
  const a = local ?? []
  const b = remote ?? []
  if (a.length === 0 && b.length === 0) return undefined

  const map = new Map<string, Bookmark>()
  const timeOf = (x: Bookmark) => Date.parse(x.addedAt || '') || 0
  for (const x of b) {
    if (!x?.url) continue
    map.set(x.url, x)
  }
  for (const x of a) {
    if (!x?.url) continue
    const cur = map.get(x.url)
    if (!cur) {
      map.set(x.url, x)
      continue
    }
    map.set(x.url, timeOf(x) >= timeOf(cur) ? x : cur)
  }

  return [...map.values()].sort((x, y) => (y.addedAt || '').localeCompare(x.addedAt || ''))
}

export function mergePersistedState(local: PersistedState, remote: PersistedState): PersistedState {
  return {
    tasks: mergeTasks(local.tasks ?? [], remote.tasks ?? []),
    projects: mergeProjects(local.projects ?? [], remote.projects ?? []),
    // 설정은 필드 단위로 병합(구버전 저장 데이터도 안전하게 마이그레이션)
    settings: mergeSettings(local.settings, remote.settings),
    bookmarks: mergeBookmarks(local.bookmarks, remote.bookmarks),
  }
}

