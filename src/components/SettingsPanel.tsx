import { useEffect, useMemo, useState } from 'react'
import { useTodo } from '../TodoContext'
import { deleteAccountData, signInWithGoogle, signOut } from '../supabaseClient'
import {
  getConflictStatus,
  getSyncStatus,
  loadStateFromRemote,
  retryRemoteSave,
  subscribeConflictStatus,
  subscribeSyncStatus,
  type ConflictStatus,
  type SyncStatus,
} from '../storage'
import { useAuth } from '../useAuth'
import type { DetailEditorPreference, QuickAddMode } from '../types'

export function SettingsPanel() {
  const { settings, updateSettings, requestNotificationPermission, tasks, projects, applyExternalState } = useTodo()
  const { userId, ready } = useAuth()
  const [email, setEmail] = useState('')
  const [authMsg, setAuthMsg] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [sync, setSync] = useState<SyncStatus>(() => getSyncStatus())
  const [conflict, setConflict] = useState<ConflictStatus>(() => getConflictStatus())

  const userLabel = useMemo(() => {
    if (!ready) return '확인 중…'
    if (!userId) return '익명(로컬)'
    return `${userId.slice(0, 8)}…${userId.slice(-6)}`
  }, [ready, userId])

  useEffect(() => subscribeSyncStatus(setSync), [])
  useEffect(() => subscribeConflictStatus(setConflict), [])

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
        <h2 className="mb-4 text-sm font-semibold text-neutral-800">계정·동기화</h2>

        {!userId ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-neutral-600">현재 사용자</span>
            <span className="font-mono text-xs text-neutral-700">{userLabel}</span>
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2">
          <span className="text-xs text-neutral-500">동기화</span>
          <span className="text-xs text-neutral-700">
            {sync.state === 'idle'
              ? '대기'
              : sync.state === 'saving'
                ? '저장 중…'
                : sync.state === 'saved'
                  ? `저장됨 (${new Date(sync.at).toLocaleTimeString()})`
                  : `오류: ${sync.message}`}
          </span>
          {conflict.state === 'detected' ? (
            <span className="text-xs font-medium text-amber-700">충돌 감지</span>
          ) : sync.state === 'error' ? (
            <button
              type="button"
              className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
              onClick={() => {
                void retryRemoteSave({ tasks, projects, settings })
              }}
            >
              재시도
            </button>
          ) : null}
        </div>

        <div className="mb-4 rounded-md border border-neutral-100 bg-white p-3">
          <h3 className="mb-2 text-xs font-semibold text-neutral-700">데이터 이전(계정 연결)</h3>
          <p className="mb-3 text-xs text-neutral-500">
            여러 기기에서 쓸 때 “어느 쪽 데이터를 유지할지” 직접 선택할 수 있어요.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={authBusy}
              className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              onClick={async () => {
                setAuthMsg(null)
                setAuthBusy(true)
                try {
                  await retryRemoteSave({ tasks, projects, settings })
                  setAuthMsg('현재 기기 데이터를 계정(원격)에 업로드했습니다.')
                } catch {
                  setAuthMsg('업로드에 실패했습니다.')
                } finally {
                  setAuthBusy(false)
                }
              }}
            >
              내 기기 → 원격(업로드)
            </button>
            <button
              type="button"
              disabled={authBusy}
              className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              onClick={async () => {
                setAuthMsg(null)
                setAuthBusy(true)
                try {
                  const remote = await loadStateFromRemote()
                  if (!remote) {
                    setAuthMsg('원격 데이터가 없습니다.')
                  } else {
                    applyExternalState(remote)
                    setAuthMsg('원격 데이터를 내려받았습니다.')
                  }
                } catch {
                  setAuthMsg('다운로드에 실패했습니다.')
                } finally {
                  setAuthBusy(false)
                }
              }}
            >
              원격 → 내 기기(다운로드)
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {userId ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs text-neutral-500">
                로그인하면 기기 간 동기화가 됩니다. (계정 전환 시 원격 상태를 우선 적용)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={authBusy}
                  className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                  onClick={async () => {
                    if (!confirm('계정을 삭제할까요? 원격에 저장된 데이터가 모두 삭제됩니다.')) return
                    setAuthMsg(null)
                    setAuthBusy(true)
                    try {
                      await deleteAccountData()
                      await signOut()
                      setAuthMsg('계정 데이터(원격)를 삭제하고 로그아웃했습니다. (로컬 데이터는 유지됩니다)')
                    } catch {
                      setAuthMsg('계정 삭제에 실패했습니다. Supabase RLS/테이블 설정을 확인해주세요.')
                    } finally {
                      setAuthBusy(false)
                    }
                  }}
                >
                  계정 삭제
                </button>
                <button
                  type="button"
                  disabled={authBusy}
                  className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  onClick={async () => {
                    setAuthMsg(null)
                    setAuthBusy(true)
                    try {
                      await signOut()
                      setAuthMsg('로그아웃했습니다. (로컬 데이터는 유지됩니다)')
                    } catch {
                      setAuthMsg('로그아웃에 실패했습니다.')
                    } finally {
                      setAuthBusy(false)
                    }
                  }}
                >
                  로그아웃
                </button>
              </div>
            </div>
          ) : (
            <>
              <label className="text-xs text-neutral-500">Google 계정 이메일</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-todoist-red focus:ring-1 focus:ring-todoist-red/25"
                />
              </div>

              <button
                type="button"
                disabled={authBusy}
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                onClick={async () => {
                  setAuthMsg(null)
                  setAuthBusy(true)
                  try {
                    await signInWithGoogle(email)
                  } catch {
                    setAuthMsg('구글 로그인 시작에 실패했습니다. Supabase OAuth 설정을 확인해주세요.')
                  } finally {
                    setAuthBusy(false)
                  }
                }}
              >
                Google 로그인
              </button>
            </>
          )}

          {authMsg && <p className="text-xs text-neutral-600">{authMsg}</p>}
        </div>
      </section>

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
        <h2 className="mb-4 text-sm font-semibold text-neutral-800">목록 클릭 편집기</h2>
        <p className="mb-4 text-xs text-neutral-500">
          목록에서 항목을 클릭했을 때 어떤 편집기를 열지 선택합니다. 노트는 빠른 추가로 만든 날짜 형식 제목의 항목을 의미합니다.
        </p>

        <div className="mb-4">
          <span className="mb-2 block text-xs font-semibold text-neutral-700">작업</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'auto' as const, label: '자동(작업 편집기)' },
                { id: 'todo' as const, label: '작업 편집기' },
                { id: 'note' as const, label: '노트 편집기' },
              ] satisfies { id: DetailEditorPreference; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => updateSettings({ detailEditorForTodo: id })}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  settings.detailEditorForTodo === id
                    ? 'border-todoist-red bg-red-50 text-todoist-red'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-xs font-semibold text-neutral-700">노트</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'auto' as const, label: '자동(노트 편집기)' },
                { id: 'todo' as const, label: '작업 편집기' },
                { id: 'note' as const, label: '노트 편집기' },
              ] satisfies { id: DetailEditorPreference; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => updateSettings({ detailEditorForNote: id })}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  settings.detailEditorForNote === id
                    ? 'border-todoist-red bg-red-50 text-todoist-red'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
