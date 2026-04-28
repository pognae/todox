import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  addDays,
  compareDueTime,
  compareISODates,
  firstDayOfMonthISO,
  formatTodayNoteTitle,
  isDueToday,
  isOverdue,
  parseISODate,
  todayISO,
} from './dateUtils'
import { mergePersistedState } from './mergeState'
import { loadState, loadStateFromRemote, saveState } from './storage'
import { Capacitor } from '@capacitor/core'
import { getSupabaseClient, onAuthStateChange } from './supabaseClient'
import { requestNativeNotificationPermission } from './nativeNotifications'
import { isNoteLikeTask } from './noteUtils'
import { computeNextDueDate } from './recurrence'
import { onBookmarksPush, pushBookmarks, requestBookmarks } from './bookmarksBridge'
import { collectAllTagsFromTasks, normalizeTag, parseQuickAdd, taskMatchesSearch } from './tagUtils'
import type {
  AppSettings,
  Bookmark,
  DetailEditorPreference,
  Project,
  QuickAddMode,
  Task,
  View,
} from './types'

const INBOX_ID = 'inbox'

const defaultProjects: Project[] = [
  { id: INBOX_ID, name: '받은 편지함', color: '#808080', isInbox: true },
]

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function resolveQuickAddProjectAndDue(
  view: View,
  opts?: { dueDate?: string | null; projectId?: string },
): { projectId: string; dueDate: string | null } {
  const today = todayISO()
  let projectId = opts?.projectId ?? INBOX_ID
  let dueDate: string | null = opts?.dueDate ?? null

  if (view.type === 'today') {
    dueDate = dueDate ?? today
    projectId = opts?.projectId ?? INBOX_ID
  } else if (view.type === 'upcoming') {
    dueDate = dueDate ?? addDays(today, 1)
  } else if (view.type === 'inbox') {
    projectId = INBOX_ID
  } else if (view.type === 'project') {
    projectId = view.projectId
  } else if (view.type === 'calendar') {
    dueDate = dueDate ?? firstDayOfMonthISO(view.year, view.month)
    projectId = opts?.projectId ?? INBOX_ID
  } else if (view.type === 'settings') {
    projectId = INBOX_ID
  } else if (view.type === 'tag') {
    projectId = INBOX_ID
  }

  return { projectId, dueDate }
}

function extraTagsFromView(view: View): string[] {
  if (view.type === 'tag' && view.tag) return [view.tag]
  return []
}

/** 체크박스 한 번과 동일한 완료 전이(반복이면 다음 마감일) */
function applyToggleCompleteState(t: Task): Task {
  if (t.completed) {
    return { ...t, completed: false }
  }
  if (t.recurrence && t.dueDate) {
    const next = computeNextDueDate(t.dueDate, t.recurrence)
    return { ...t, completed: false, dueDate: next }
  }
  return { ...t, completed: true }
}

/** 캘린더 더블클릭 등으로 상세 패널이 연 직후 포커스할 필드 */
export type DetailPanelFocusRequest = 'task-title' | 'note-description' | null

interface TodoContextValue {
  projects: Project[]
  tasks: Task[]
  bookmarks: Bookmark[]
  view: View
  setView: (v: View) => void
  selectedTaskId: string | null
  setSelectedTaskId: (id: string | null) => void
  detailPanelFocusRequest: DetailPanelFocusRequest
  clearDetailPanelFocusRequest: () => void
  /** 캘린더에서 날짜 더블클릭: 설정의 빠른 추가 모드(작업/노트)에 맞춰 입력 UI를 연다 */
  openCalendarDayInput: (dueDateISO: string) => void
  addProject: (name: string) => void
  renameProject: (id: string, name: string) => void
  deleteProject: (id: string) => void
  setBookmarks: (next: Bookmark[]) => void
  addTask: (
    title: string,
    opts?: { dueDate?: string | null; projectId?: string; tags?: string[]; mode?: QuickAddMode },
  ) => void
  updateTask: (
    id: string,
    patch: Partial<
      Pick<
        Task,
        | 'title'
        | 'description'
        | 'dueDate'
        | 'dueTime'
        | 'priority'
        | 'completed'
        | 'projectId'
        | 'tags'
        | 'recurrence'
        | 'parentId'
      >
    >,
  ) => void
  toggleTaskCompleted: (id: string) => void
  removeTask: (id: string) => void
  addSubtask: (parentId: string, title: string, requestId?: string) => void
  /** parentId → 직속 하위 작업 개수 */
  subtaskCounts: Record<string, number>
  visibleTasks: Task[]
  viewTitle: string
  projectForTask: (task: Task) => Project | undefined
  searchQuery: string
  setSearchQuery: (q: string) => void
  /** 전체 작업에서 수집한 태그 목록(정렬됨) */
  allTags: string[]
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
  requestNotificationPermission: () => Promise<NotificationPermission | 'unsupported'>
  applyExternalState: (next: { tasks: Task[]; projects: Project[]; settings?: AppSettings }) => void
}

const TodoContext = createContext<TodoContextValue | null>(null)

function initialTasks(): Task[] {
  const today = todayISO()
  const parentId = uid()
  const subId = uid()
  const nowIso = new Date().toISOString()
  return [
    {
      id: parentId,
      title: 'Todoist에 오신 것을 환영합니다',
      description: '',
      completed: false,
      dueDate: today,
      dueTime: '09:00',
      priority: 4,
      projectId: INBOX_ID,
      createdAt: nowIso,
      updatedAt: nowIso,
      tags: ['가이드'],
      recurrence: null,
      parentId: null,
    },
    {
      id: subId,
      title: '하위 작업 예시 (상세에서 더 추가할 수 있어요)',
      description: '',
      completed: false,
      dueDate: today,
      dueTime: null,
      priority: 4,
      projectId: INBOX_ID,
      createdAt: nowIso,
      updatedAt: nowIso,
      tags: [],
      recurrence: null,
      parentId,
    },
    {
      id: uid(),
      title: '이 할 일을 완료로 표시해 보세요',
      description: '',
      completed: false,
      dueDate: null,
      dueTime: null,
      priority: 4,
      projectId: INBOX_ID,
      createdAt: nowIso,
      updatedAt: nowIso,
      tags: ['가이드'],
      recurrence: null,
      parentId: null,
    },
  ]
}

export function TodoProvider({ children }: { children: ReactNode }) {
  const hydrated = loadState()
  const [projects, setProjects] = useState<Project[]>(
    hydrated?.projects?.length ? hydrated.projects : defaultProjects,
  )
  const [tasks, setTasks] = useState<Task[]>(() => {
    const raw = hydrated?.tasks?.length ? hydrated.tasks : initialTasks()
    const step1 = raw.map((t) => {
      const x = t as Task
      return {
        ...x,
        tags: Array.isArray(x.tags)
          ? [...new Set(x.tags.map((tag) => normalizeTag(String(tag))).filter(Boolean))]
          : [],
        dueTime: x.dueTime ?? null,
        recurrence: x.recurrence ?? null,
        parentId: x.parentId ?? null,
        updatedAt: x.updatedAt ?? x.createdAt,
      }
    })
    return step1.map((t) => {
      if (!t.parentId) return t
      const p = step1.find((x) => x.id === t.parentId)
      if (!p || p.parentId) return { ...t, parentId: null }
      return t
    })
  })
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    const raw = hydrated?.bookmarks
    return Array.isArray(raw) ? raw : []
  })
  const [view, setView] = useState<View>({ type: 'today' })
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [detailPanelFocusRequest, setDetailPanelFocusRequest] = useState<DetailPanelFocusRequest>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [settings, setSettings] = useState<AppSettings>(() => {
    const s = hydrated?.settings
    let tzOff: number | undefined = undefined
    try {
      tzOff = new Date().getTimezoneOffset()
    } catch {
      tzOff = undefined
    }
    return {
      defaultReminderTime: s?.defaultReminderTime ?? '09:00',
      notificationsEnabled: s?.notificationsEnabled ?? false,
      showCompletedTasks: s?.showCompletedTasks ?? true,
      defaultQuickAddMode: s?.defaultQuickAddMode ?? 'task',
      detailEditorForTodo: (s?.detailEditorForTodo as DetailEditorPreference | undefined) ?? 'todo',
      detailEditorForNote: (s?.detailEditorForNote as DetailEditorPreference | undefined) ?? 'auto',
      timezoneOffsetMinutes: s?.timezoneOffsetMinutes ?? tzOff,
      weekStartsOn: s?.weekStartsOn ?? 'mon',
    }
  })
  const recentSubtaskRequestsRef = useRef<Map<string, number>>(new Map())
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const bookmarksJsonRef = useRef<string>(JSON.stringify(bookmarks))
  const pushedToExtensionJsonRef = useRef<string>('')
  const latestStateRef = useRef<{ tasks: Task[]; projects: Project[]; settings: AppSettings; bookmarks: Bookmark[] } | null>(
    null,
  )

  useEffect(() => {
    latestStateRef.current = { tasks, projects, settings, bookmarks }
    bookmarksJsonRef.current = JSON.stringify(bookmarks)
  }, [tasks, projects, settings, bookmarks])

  const applyExternalState = useCallback(
    (next: { tasks: Task[]; projects: Project[]; settings?: AppSettings; bookmarks?: Bookmark[] }) => {
      const nextProjects = next.projects?.length ? next.projects : defaultProjects
      setProjects(() =>
        nextProjects.some((x) => x.id === INBOX_ID) ? nextProjects : [defaultProjects[0], ...nextProjects],
      )

      setTasks(() => {
        const raw = next.tasks?.length ? next.tasks : initialTasks()
        const step1 = raw.map((t) => {
          const x = t as Task
          return {
            ...x,
            tags: Array.isArray(x.tags)
              ? [...new Set(x.tags.map((tag) => normalizeTag(String(tag))).filter(Boolean))]
              : [],
            dueTime: x.dueTime ?? null,
            recurrence: x.recurrence ?? null,
            parentId: x.parentId ?? null,
            updatedAt: x.updatedAt ?? x.createdAt,
          }
        })
        return step1.map((t) => {
          if (!t.parentId) return t
          const p = step1.find((x) => x.id === t.parentId)
          if (!p || p.parentId) return { ...t, parentId: null }
          return t
        })
      })

      if (next.settings) setSettings((s) => ({ ...s, ...next.settings }))
      if (Array.isArray(next.bookmarks)) setBookmarks(next.bookmarks)
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const remote = await loadStateFromRemote()
      if (cancelled || !remote) return

      // 원격 로드가 로컬 변경(방금 추가한 작업)을 덮어써서 잠깐 보였다가 사라지는 경우가 있어 병합 적용
      applyExternalState(mergePersistedState({ tasks, projects, settings, bookmarks }, remote))
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 로그인 상태가 바뀌면(익명→이메일 등) 새 계정의 원격 상태를 우선 적용
  // 원격 상태가 없으면 현재 로컬 상태를 새 계정에 시드(upsert)합니다.
  useEffect(() => {
    const unsub = onAuthStateChange((evt, uid) => {
      // TOKEN_REFRESHED 등까지 전부 반응하면 원격 로드/적용이 반복되며 UI가 깜빡일 수 있음
      if (evt !== 'SIGNED_IN' && evt !== 'SIGNED_OUT') return
      setAuthUserId(uid)
      void (async () => {
        const local = latestStateRef.current
        if (!local) return
        const remote = await loadStateFromRemote()
        if (remote) {
          applyExternalState(mergePersistedState(local, remote))
        } else {
          // 새 계정(또는 빈 계정)이면 현재 상태를 저장해서 동기화 시작
          saveState(local)
        }
      })()
    })
    return () => {
      unsub?.()
    }
  }, [applyExternalState])

  useEffect(() => {
    saveState({ tasks, projects, settings, bookmarks })
  }, [tasks, projects, settings, bookmarks])

  // timezone offset은 서버 푸시 시각 계산에 필요하므로 주기적으로 최신값을 유지
  useEffect(() => {
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      try {
        const off = new Date().getTimezoneOffset()
        setSettings((s) => (s.timezoneOffsetMinutes === off ? s : { ...s, timezoneOffsetMinutes: off }))
      } catch {
        // ignore
      }
    }
    tick()
    const id = window.setInterval(tick, 6 * 60 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  // 북마크는 확장프로그램(로컬)과도 동기화해서 로그인 시 내려받은 북마크가 브라우저에도 바로 보이게 합니다.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const json = bookmarksJsonRef.current
    if (json === pushedToExtensionJsonRef.current) return
    pushedToExtensionJsonRef.current = json
    void pushBookmarks(bookmarks, 350)
  }, [bookmarks])

  // 확장프로그램 → 앱: 북마크 변경(PUSH)을 앱 전체에서 받아서 즉시 상태에 반영(=원격 동기화 경로로 자동 포함)
  useEffect(() => {
    if (typeof window === 'undefined') return
    let alive = true

    void requestBookmarks(650).then((b) => {
      if (!alive || !b) return
      const nextJson = JSON.stringify(b)
      if (nextJson === bookmarksJsonRef.current) return
      setBookmarks(b)
    })

    const off = onBookmarksPush((next) => {
      const nextJson = JSON.stringify(next)
      if (nextJson === bookmarksJsonRef.current) return
      setBookmarks(next)
    })
    return () => {
      alive = false
      off()
    }
  }, [])

  // Supabase Realtime: 로그인된 계정의 상태 변경을 구독해(작업/노트/북마크 전체) 실시간 반영
  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    if (!authUserId) return

    const channel = supabase
      .channel(`todox_user_states:${authUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todox_user_states',
          filter: `user_id=eq.${authUserId}`,
        },
        () => {
          void (async () => {
            const local = latestStateRef.current
            if (!local) return
            const remote = await loadStateFromRemote()
            if (!remote) return
            applyExternalState(mergePersistedState(local, remote))
          })()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [authUserId, applyExternalState])

  useEffect(() => {
    setProjects((p) => (p.some((x) => x.id === INBOX_ID) ? p : [defaultProjects[0], ...p]))
  }, [])

  const projectForTask = useCallback(
    (task: Task) => projects.find((p) => p.id === task.projectId),
    [projects],
  )

  const addProject = useCallback((name: string) => {
    const colors = ['#7b68ee', '#299438', '#808080', '#db4c3f', '#246fe0']
    const color = colors[Math.floor(Math.random() * colors.length)]
    const now = new Date().toISOString()
    setProjects((p) => [...p, { id: uid(), name: name.trim() || '새 프로젝트', color, updatedAt: now }])
  }, [])

  const renameProject = useCallback((id: string, name: string) => {
    if (id === INBOX_ID) return
    const now = new Date().toISOString()
    setProjects((p) =>
      p.map((x) => (x.id === id ? { ...x, name: name.trim() || x.name, updatedAt: now } : x)),
    )
  }, [])

  const deleteProject = useCallback((id: string) => {
    if (id === INBOX_ID) return
    setTasks((t) =>
      t.map((task) =>
        task.projectId === id ? { ...task, projectId: INBOX_ID } : task,
      ),
    )
    setProjects((p) => p.filter((x) => x.id !== id))
    setView((v) =>
      v.type === 'project' && v.projectId === id ? { type: 'inbox' } : v,
    )
  }, [])

  const addTask = useCallback(
    (
      title: string,
      opts?: { dueDate?: string | null; projectId?: string; tags?: string[]; mode?: QuickAddMode },
    ) => {
      const mode = opts?.mode ?? 'task'
      const trimmed = title.trim()

      if (mode === 'note') {
        if (!trimmed) return
        const finalTitle = formatTodayNoteTitle()
        const { projectId, dueDate } = resolveQuickAddProjectAndDue(view, opts)

        const noteTags = [...new Set([...extraTagsFromView(view)])]

        const task: Task = {
          id: uid(),
          title: finalTitle,
          description: trimmed,
          completed: false,
          dueDate,
          dueTime: null,
          priority: 4,
          projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
          tags: noteTags,
          recurrence: null,
          parentId: null,
        }
        setTasks((t) => [task, ...t])
        return
      }

      if (!trimmed) return
      const { title: parsedTitle, tags: parsedTags } = parseQuickAdd(trimmed)
      let finalTitle = parsedTitle
      if (!finalTitle && (parsedTags.length || (opts?.tags?.length ?? 0)))
        finalTitle = '새 작업'
      if (!finalTitle) return

      const { projectId, dueDate } = resolveQuickAddProjectAndDue(view, opts)

      const tagSet = new Set<string>()
      for (const x of [...extraTagsFromView(view), ...(opts?.tags ?? []), ...parsedTags]) {
        const n = normalizeTag(x)
        if (n) tagSet.add(n)
      }

      const task: Task = {
        id: uid(),
        title: finalTitle,
        description: '',
        completed: false,
        dueDate,
        dueTime: null,
        priority: 4,
        projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [...tagSet],
        recurrence: null,
        parentId: null,
      }
      setTasks((t) => [task, ...t])
    },
    [view],
  )

  const clearDetailPanelFocusRequest = useCallback(() => {
    setDetailPanelFocusRequest(null)
  }, [])

  const openCalendarDayInput = useCallback(
    (dueDateISO: string) => {
      if (view.type !== 'calendar') return

      const { projectId } = resolveQuickAddProjectAndDue(view, { dueDate: dueDateISO })
      const nowIso = new Date().toISOString()
      const mode = settings.defaultQuickAddMode
      const tagSeed = [...new Set([...extraTagsFromView(view)])]

      if (mode === 'task') {
        const id = uid()
        const task: Task = {
          id,
          title: '',
          description: '',
          completed: false,
          dueDate: dueDateISO,
          dueTime: null,
          priority: 4,
          projectId,
          createdAt: nowIso,
          updatedAt: nowIso,
          tags: tagSeed,
          recurrence: null,
          parentId: null,
        }
        setDetailPanelFocusRequest('task-title')
        setTasks((t) => [task, ...t])
        setSelectedTaskId(id)
        return
      }

      const noteTitle = formatTodayNoteTitle(parseISODate(dueDateISO))
      const existing = tasks.find(
        (t) => t.dueDate === dueDateISO && t.title === noteTitle && isNoteLikeTask(t),
      )
      if (existing) {
        setDetailPanelFocusRequest('note-description')
        setSelectedTaskId(existing.id)
        return
      }

      const id = uid()
      const task: Task = {
        id,
        title: noteTitle,
        description: '',
        completed: false,
        dueDate: dueDateISO,
        dueTime: null,
        priority: 4,
        projectId,
        createdAt: nowIso,
        updatedAt: nowIso,
        tags: tagSeed,
        recurrence: null,
        parentId: null,
      }
      setDetailPanelFocusRequest('note-description')
      setTasks((t) => [task, ...t])
      setSelectedTaskId(id)
    },
    [view, settings.defaultQuickAddMode, tasks],
  )

  const updateTask = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<
          Task,
          | 'title'
          | 'description'
          | 'dueDate'
          | 'dueTime'
          | 'priority'
          | 'completed'
          | 'projectId'
          | 'tags'
          | 'recurrence'
          | 'parentId'
        >
      >,
    ) => {
      setTasks((prev) => {
        let next = prev.map((x) => {
          if (x.id !== id) return x
          const now = new Date().toISOString()
          let merged: Task = { ...x, ...patch, updatedAt: now }
          if (patch.parentId !== undefined) {
            if (patch.parentId === null) {
              merged = { ...merged, parentId: null }
            } else if (patch.parentId === id) {
              merged = { ...merged, parentId: x.parentId }
            } else {
              const p = prev.find((t) => t.id === patch.parentId)
              const hasChildren = prev.some((c) => c.parentId === id)
              if (!p || p.parentId !== null || hasChildren) {
                merged = { ...merged, parentId: x.parentId }
              } else {
                merged = { ...merged, parentId: patch.parentId }
              }
            }
          }
          return merged
        })
        if (patch.projectId !== undefined) {
          const self = next.find((x) => x.id === id)
          if (self && !self.parentId) {
            next = next.map((x) =>
              x.parentId === id ? { ...x, projectId: patch.projectId! } : x,
            )
          }
        }
        return next
      })
    },
    [],
  )

  const addSubtask = useCallback(
    (parentId: string, title: string, requestId?: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      const now = Date.now()
      const m = recentSubtaskRequestsRef.current
      for (const [k, ts] of m.entries()) {
        if (now - ts > 5000) m.delete(k)
      }
      // 한글 IME 등으로 Enter가 연속 발생할 때 동일 제목이 짧은 시간에 두 번 들어오는 것 방지
      const contentKey = `sub:${parentId}:${trimmed}`
      const lastAt = m.get(contentKey)
      if (lastAt !== undefined && now - lastAt < 700) return
      m.set(contentKey, now)

      if (requestId) {
        if (m.has(requestId)) return
        m.set(requestId, now)
      }

      const parent = tasks.find((t) => t.id === parentId)
      if (!parent || parent.parentId !== null) return

      const tagSet = new Set<string>()
      const task: Task = {
        id: uid(),
        title: trimmed,
        description: '',
        completed: false,
        dueDate: null,
        dueTime: null,
        priority: 4,
        projectId: parent.projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [...tagSet],
        recurrence: null,
        parentId,
      }
      setTasks((t) => [task, ...t])
    },
    [tasks],
  )

  const toggleTaskCompleted = useCallback((id: string) => {
    setTasks((prev) => {
      const now = new Date().toISOString()
      let next = prev.map((t) => (t.id === id ? { ...applyToggleCompleteState(t), updatedAt: now } : t))

      const self = next.find((t) => t.id === id)
      const pid = self?.parentId
      if (!pid) return next

      const siblings = next.filter((t) => t.parentId === pid)
      const allChildrenDone =
        siblings.length > 0 && siblings.every((c) => c.completed)

      if (allChildrenDone) {
        next = next.map((t) => {
          if (t.id !== pid) return t
          if (t.completed) return t
          return { ...applyToggleCompleteState(t), updatedAt: now }
        })
      } else {
        next = next.map((t) => (t.id === pid ? { ...t, completed: false } : t))
      }

      return next
    })
  }, [])

  const removeTask = useCallback((id: string) => {
    setTasks((t) => {
      const drop = new Set<string>([id])
      for (const x of t) {
        if (x.parentId === id) drop.add(x.id)
      }
      return t.filter((x) => !drop.has(x.id))
    })
    setSelectedTaskId((s) => (s === id ? null : s))
  }, [])

  const { baseVisibleTasks, viewTitle } = useMemo(() => {
    const allSorted = [...tasks].sort((a, b) => {
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
    })

    if (view.type === 'today') {
      const inToday = (t: Task) =>
        !!t.dueDate && (isOverdue(t.dueDate) || isDueToday(t.dueDate))
      const list = allSorted.filter(inToday)
      return { baseVisibleTasks: list, viewTitle: '오늘' }
    }

    if (view.type === 'upcoming') {
      const todayStr = todayISO()
      const upcoming = allSorted.filter(
        (t) => t.dueDate && compareISODates(t.dueDate, todayStr) > 0,
      )
      return { baseVisibleTasks: upcoming, viewTitle: '다가오는 날' }
    }

    if (view.type === 'inbox') {
      return {
        baseVisibleTasks: allSorted.filter((t) => t.projectId === INBOX_ID),
        viewTitle: '받은 편지함',
      }
    }

    if (view.type === 'calendar') {
      return { baseVisibleTasks: [], viewTitle: '캘린더' }
    }

    if (view.type === 'bookmarks') {
      return { baseVisibleTasks: [], viewTitle: '북마크' }
    }

    if (view.type === 'settings') {
      return { baseVisibleTasks: [], viewTitle: '설정' }
    }

    if (view.type === 'tag') {
      return {
        baseVisibleTasks: allSorted.filter((t) => t.tags.includes(view.tag)),
        viewTitle: `#${view.tag}`,
      }
    }

    const proj = projects.find((p) => p.id === view.projectId)
    return {
      baseVisibleTasks: allSorted.filter((t) => t.projectId === view.projectId),
      viewTitle: proj?.name ?? '프로젝트',
    }
  }, [tasks, view, projects])

  const visibleTasks = useMemo(() => {
    let list = baseVisibleTasks.filter((t) => taskMatchesSearch(t, searchQuery))
    if (!settings.showCompletedTasks) {
      list = list.filter((t) => !t.completed)
    }
    return list
  }, [baseVisibleTasks, searchQuery, settings.showCompletedTasks])

  const subtaskCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of tasks) {
      if (!t.parentId) continue
      counts[t.parentId] = (counts[t.parentId] ?? 0) + 1
    }
    return counts
  }, [tasks])

  const allTags = useMemo(() => collectAllTagsFromTasks(tasks), [tasks])

  useEffect(() => {
    setView((v) => {
      if (v.type !== 'tag') return v
      const stillExists = tasks.some((t) => t.tags.includes(v.tag))
      return stillExists ? v : { type: 'inbox' }
    })
  }, [tasks])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  const requestNotificationPermission = useCallback(async () => {
    // Native(Capacitor): Local Notifications 권한 요청
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await requestNativeNotificationPermission()
        return res === 'unsupported' ? 'unsupported' : res
      }
    } catch {
      // ignore
    }
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    try {
      return await Notification.requestPermission()
    } catch {
      return 'denied'
    }
  }, [])

  const value = useMemo(
    () => ({
      projects,
      tasks,
      bookmarks,
      view,
      setView,
      selectedTaskId,
      setSelectedTaskId,
      detailPanelFocusRequest,
      clearDetailPanelFocusRequest,
      openCalendarDayInput,
      addProject,
      renameProject,
      deleteProject,
      setBookmarks,
      addTask,
      updateTask,
      toggleTaskCompleted,
      removeTask,
      addSubtask,
      subtaskCounts,
      visibleTasks,
      viewTitle,
      projectForTask,
      searchQuery,
      setSearchQuery,
      allTags,
      settings,
      updateSettings,
      requestNotificationPermission,
      applyExternalState,
    }),
    [
      projects,
      tasks,
      bookmarks,
      view,
      selectedTaskId,
      detailPanelFocusRequest,
      clearDetailPanelFocusRequest,
      openCalendarDayInput,
      addProject,
      renameProject,
      deleteProject,
      setBookmarks,
      addTask,
      updateTask,
      toggleTaskCompleted,
      removeTask,
      addSubtask,
      subtaskCounts,
      visibleTasks,
      viewTitle,
      projectForTask,
      searchQuery,
      allTags,
      settings,
      updateSettings,
      requestNotificationPermission,
      applyExternalState,
    ],
  )

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>
}

export function useTodo(): TodoContextValue {
  const ctx = useContext(TodoContext)
  if (!ctx) throw new Error('useTodo must be used within TodoProvider')
  return ctx
}
