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
  isDueToday,
  isOverdue,
  todayISO,
} from './dateUtils'
import { loadState, saveState } from './storage'
import { computeNextDueDate } from './recurrence'
import { normalizeTag, parseQuickAdd, taskMatchesSearch } from './tagUtils'
import type { AppSettings, Project, Task, View } from './types'

const INBOX_ID = 'inbox'

const defaultProjects: Project[] = [
  { id: INBOX_ID, name: '받은 편지함', color: '#808080', isInbox: true },
]

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

interface TodoContextValue {
  projects: Project[]
  tasks: Task[]
  view: View
  setView: (v: View) => void
  selectedTaskId: string | null
  setSelectedTaskId: (id: string | null) => void
  addProject: (name: string) => void
  renameProject: (id: string, name: string) => void
  deleteProject: (id: string) => void
  addTask: (title: string, opts?: { dueDate?: string | null; projectId?: string; tags?: string[] }) => void
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
  visibleTasks: Task[]
  viewTitle: string
  projectForTask: (task: Task) => Project | undefined
  searchQuery: string
  setSearchQuery: (q: string) => void
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
  requestNotificationPermission: () => Promise<NotificationPermission | 'unsupported'>
}

const TodoContext = createContext<TodoContextValue | null>(null)

function initialTasks(): Task[] {
  const today = todayISO()
  const parentId = uid()
  const subId = uid()
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
      createdAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
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
      }
    })
    return step1.map((t) => {
      if (!t.parentId) return t
      const p = step1.find((x) => x.id === t.parentId)
      if (!p || p.parentId) return { ...t, parentId: null }
      return t
    })
  })
  const [view, setView] = useState<View>({ type: 'today' })
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [settings, setSettings] = useState<AppSettings>(() => {
    const s = hydrated?.settings
    return {
      defaultReminderTime: s?.defaultReminderTime ?? '09:00',
      notificationsEnabled: s?.notificationsEnabled ?? false,
    }
  })
  const recentSubtaskRequestsRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    saveState({ tasks, projects, settings })
  }, [tasks, projects, settings])

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
    setProjects((p) => [...p, { id: uid(), name: name.trim() || '새 프로젝트', color }])
  }, [])

  const renameProject = useCallback((id: string, name: string) => {
    if (id === INBOX_ID) return
    setProjects((p) =>
      p.map((x) => (x.id === id ? { ...x, name: name.trim() || x.name } : x)),
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
    (title: string, opts?: { dueDate?: string | null; projectId?: string; tags?: string[] }) => {
      const trimmed = title.trim()
      if (!trimmed) return
      const { title: parsedTitle, tags: parsedTags } = parseQuickAdd(trimmed)
      let finalTitle = parsedTitle
      if (!finalTitle && (parsedTags.length || (opts?.tags?.length ?? 0)))
        finalTitle = '새 작업'
      if (!finalTitle) return

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
      }

      const tagSet = new Set<string>()
      for (const x of [...(opts?.tags ?? []), ...parsedTags]) {
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
        tags: [...tagSet],
        recurrence: null,
        parentId: null,
      }
      setTasks((t) => [task, ...t])
    },
    [view],
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
          let merged: Task = { ...x, ...patch }
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
      if (requestId) {
        const m = recentSubtaskRequestsRef.current
        // 오래된 키 정리 (5초)
        for (const [k, ts] of m.entries()) {
          if (now - ts > 5000) m.delete(k)
        }
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
        tags: [...tagSet],
        recurrence: null,
        parentId,
      }
      setTasks((t) => [task, ...t])
    },
    [tasks],
  )

  const toggleTaskCompleted = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        if (t.completed) {
          return { ...t, completed: false }
        }
        if (t.recurrence && t.dueDate) {
          const next = computeNextDueDate(t.dueDate, t.recurrence)
          return { ...t, completed: false, dueDate: next }
        }
        return { ...t, completed: true }
      }),
    )
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

    const proj = projects.find((p) => p.id === view.projectId)
    return {
      baseVisibleTasks: allSorted.filter((t) => t.projectId === view.projectId),
      viewTitle: proj?.name ?? '프로젝트',
    }
  }, [tasks, view, projects])

  const visibleTasks = useMemo(
    () => baseVisibleTasks.filter((t) => taskMatchesSearch(t, searchQuery)),
    [baseVisibleTasks, searchQuery],
  )

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  const requestNotificationPermission = useCallback(async () => {
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
      view,
      setView,
      selectedTaskId,
      setSelectedTaskId,
      addProject,
      renameProject,
      deleteProject,
      addTask,
      updateTask,
      toggleTaskCompleted,
      removeTask,
      addSubtask,
      visibleTasks,
      viewTitle,
      projectForTask,
      searchQuery,
      setSearchQuery,
      settings,
      updateSettings,
      requestNotificationPermission,
    }),
    [
      projects,
      tasks,
      view,
      selectedTaskId,
      addProject,
      renameProject,
      deleteProject,
      addTask,
      updateTask,
      toggleTaskCompleted,
      removeTask,
      addSubtask,
      visibleTasks,
      viewTitle,
      projectForTask,
      searchQuery,
      settings,
      updateSettings,
      requestNotificationPermission,
    ],
  )

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>
}

export function useTodo(): TodoContextValue {
  const ctx = useContext(TodoContext)
  if (!ctx) throw new Error('useTodo must be used within TodoProvider')
  return ctx
}
