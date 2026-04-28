export type Priority = 1 | 2 | 3 | 4

export type RecurrenceType = 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface TaskRecurrence {
  type: RecurrenceType
}

export interface Task {
  id: string
  title: string
  description: string
  completed: boolean
  dueDate: string | null
  /** 로컬 기준 "HH:mm", 마감일과 함께 사용 */
  dueTime: string | null
  priority: Priority
  projectId: string
  createdAt: string
  /** 작업이 마지막으로 변경된 시각(병합/충돌 해결용). 없으면 createdAt을 사용 */
  updatedAt?: string
  /** 소문자·정규화된 태그 목록 */
  tags: string[]
  /** 마감일이 있을 때만 의미 있음 */
  recurrence: TaskRecurrence | null
  /** 상위 작업 id. 상위는 항상 최상위(parentId가 null)만 허용 */
  parentId: string | null
}

export interface Project {
  id: string
  name: string
  color: string
  isInbox?: boolean
  /** 프로젝트가 마지막으로 변경된 시각(병합/충돌 해결용) */
  updatedAt?: string
}

export interface Bookmark {
  id: string
  url: string
  title: string
  /** ISO timestamp */
  addedAt: string
}

/** 빠른 추가 입력란의 종류 */
export type QuickAddMode = 'task' | 'note'

/** 목록 클릭 시 어떤 편집기를 사용할지 */
export type DetailEditorPreference = 'auto' | 'todo' | 'note'

export interface AppSettings {
  /** 마감 시간이 없을 때 이 시간에 알림 */
  defaultReminderTime: string
  /** 브라우저 알림 사용 여부 */
  notificationsEnabled: boolean
  /** 메인 목록·달력에서 완료된 작업 표시 여부 */
  showCompletedTasks: boolean
  /** 빠른 추가에서 처음 선택되는 모드 */
  defaultQuickAddMode: QuickAddMode
  /** 작업 타입 편집기 */
  detailEditorForTodo: DetailEditorPreference
  /** 노트 타입 편집기 */
  detailEditorForNote: DetailEditorPreference
  /** 서버 푸시용: 이 기기의 timezone offset (Date.getTimezoneOffset()) */
  timezoneOffsetMinutes?: number
  /** 캘린더 주 시작 요일 */
  weekStartsOn?: 'mon' | 'sun'
}

export type View =
  | { type: 'today' }
  | { type: 'upcoming' }
  | { type: 'inbox' }
  | { type: 'project'; projectId: string }
  /** month: 1–12 */
  | { type: 'calendar'; year: number; month: number }
  | { type: 'notes' }
  | { type: 'bookmarks' }
  | { type: 'settings' }
  /** 정규화된 태그 문자열(소문자 등) */
  | { type: 'tag'; tag: string }
