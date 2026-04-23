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
}

export interface AppSettings {
  /** 마감 시간이 없을 때 이 시간에 알림 */
  defaultReminderTime: string
  /** 브라우저 알림 사용 여부 */
  notificationsEnabled: boolean
}

export type View =
  | { type: 'today' }
  | { type: 'upcoming' }
  | { type: 'inbox' }
  | { type: 'project'; projectId: string }
  /** month: 1–12 */
  | { type: 'calendar'; year: number; month: number }
