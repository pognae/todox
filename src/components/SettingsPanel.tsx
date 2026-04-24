import { useEffect, useState } from 'react'
import { useTodo } from '../TodoContext'
import type { QuickAddMode } from '../types'

export function SettingsPanel() {
  const { settings, updateSettings, requestNotificationPermission } = useTodo()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    return Notification.permission
  })

  useEffect(() => {
    const onVis = () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return
      setPermission(Notification.permission)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-800">알림</h2>
        <label className="mb-4 flex cursor-pointer items-center justify-between gap-3 text-sm text-neutral-700">
          <span>브라우저 알림 사용</span>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-neutral-300 text-todoist-red focus:ring-todoist-red/30"
            checked={settings.notificationsEnabled}
            onChange={(e) => updateSettings({ notificationsEnabled: e.target.checked })}
          />
        </label>
        <label className="mb-4 flex flex-col gap-2 text-sm text-neutral-700 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-neutral-600">마감 시간이 없을 때 기본 알림 시각</span>
          <input
            type="time"
            className="w-full max-w-[9rem] rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm sm:w-auto"
            value={settings.defaultReminderTime}
            onChange={(e) => updateSettings({ defaultReminderTime: e.target.value })}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
          <button
            type="button"
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={async () => {
              const res = await requestNotificationPermission()
              if (res !== 'unsupported') setPermission(res)
            }}
          >
            알림 권한 요청
          </button>
          <span className="text-xs text-neutral-500">
            권한: {permission === 'unsupported' ? '미지원' : permission}
          </span>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-800">빠른 추가</h2>
        <p className="mb-3 text-xs text-neutral-500">
          입력란 왼쪽 작업 / 노트 전환의 처음 선택값입니다. 작업은 기존처럼 제목·태그를, 노트는 본문만 넣고 제목은 오늘
          날짜 노트 형식으로 만듭니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'task' as const, label: '작업' },
              { id: 'note' as const, label: '노트' },
            ] satisfies { id: QuickAddMode; label: string }[]
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => updateSettings({ defaultQuickAddMode: id })}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                settings.defaultQuickAddMode === id
                  ? 'border-todoist-red bg-red-50 text-todoist-red'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-800">목록·달력</h2>
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-neutral-700">
          <span>완료된 작업 표시</span>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-neutral-300 text-todoist-red focus:ring-todoist-red/30"
            checked={settings.showCompletedTasks}
            onChange={(e) => updateSettings({ showCompletedTasks: e.target.checked })}
          />
        </label>
        <p className="mt-2 text-xs text-neutral-500">
          끄면 오늘·다가오는 날·받은 편지함·프로젝트 목록과 달력에서 완료한 작업이 숨겨집니다.
        </p>
      </section>

      <p className="text-xs text-neutral-400">
        설정은 기기 로컬에만 저장됩니다. 이 앱은{' '}
        <a className="underline hover:text-neutral-600" href="https://todoist.com/" target="_blank" rel="noreferrer">
          Todoist
        </a>
        의 데모용 클론입니다.
      </p>
    </div>
  )
}
