import { useEffect, useMemo, useState } from 'react'
import { useTodo } from '../TodoContext'
import { mergePersistedState } from '../mergeState'
import {
  clearConflict,
  getConflictStatus,
  getSyncStatus,
  loadStateFromRemote,
  retryRemoteSave,
  subscribeConflictStatus,
  subscribeSyncStatus,
  type ConflictStatus,
  type SyncStatus,
} from '../storage'

export function SyncBanner() {
  const { tasks, projects, settings, applyExternalState } = useTodo()
  const [sync, setSync] = useState<SyncStatus>(() => getSyncStatus())
  const [conflict, setConflict] = useState<ConflictStatus>(() => getConflictStatus())
  const [busy, setBusy] = useState(false)
  const state = useMemo(() => ({ tasks, projects, settings }), [tasks, projects, settings])

  useEffect(() => subscribeSyncStatus(setSync), [])
  useEffect(() => subscribeConflictStatus(setConflict), [])

  // 토스트: saved는 잠깐만 보여줌
  const [showSaved, setShowSaved] = useState(false)
  useEffect(() => {
    if (sync.state !== 'saved') return
    setShowSaved(true)
    const t = window.setTimeout(() => setShowSaved(false), 2500)
    return () => window.clearTimeout(t)
  }, [sync.state])

  const visible =
    sync.state === 'saving' ||
    sync.state === 'error' ||
    (sync.state === 'saved' && showSaved) ||
    conflict.state === 'detected'

  if (!visible) return null

  const tone =
    conflict.state === 'detected'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : sync.state === 'error'
        ? 'border-red-200 bg-red-50 text-red-900'
        : sync.state === 'saving'
          ? 'border-blue-200 bg-blue-50 text-blue-900'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900'

  const label =
    conflict.state === 'detected'
      ? '동기화 충돌이 감지되었습니다. 어떤 데이터를 유지할지 선택하세요.'
      : sync.state === 'saving'
        ? '저장 중…'
        : sync.state === 'saved'
          ? '저장됨'
          : sync.state === 'error'
            ? sync.message
            : ''

  return (
    <div className={`pointer-events-auto sticky top-0 z-50 border-b ${tone}`}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate">{label}</span>

        <div className="flex flex-wrap items-center gap-2">
          {conflict.state === 'detected' ? (
            <>
              <button
                type="button"
                disabled={busy}
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs hover:bg-amber-100 disabled:opacity-50"
                onClick={async () => {
                  setBusy(true)
                  try {
                    const remote = await loadStateFromRemote()
                    if (!remote) {
                      // 원격이 비어 있으면 로컬을 그대로 저장
                      await retryRemoteSave(state)
                      clearConflict()
                      return
                    }

                    const merged = mergePersistedState(state, remote)
                    applyExternalState(merged)
                    await retryRemoteSave(merged)
                    clearConflict()
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                자동 병합
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs hover:bg-amber-100 disabled:opacity-50"
                onClick={async () => {
                  setBusy(true)
                  try {
                    // 원격을 받아 로컬을 덮어쓰기(다른 기기 변경을 우선)
                    const remote = await loadStateFromRemote()
                    if (remote) applyExternalState(remote)
                    clearConflict()
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                원격으로 덮어쓰기
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs hover:bg-amber-100 disabled:opacity-50"
                onClick={async () => {
                  setBusy(true)
                  try {
                    // 로컬을 원격에 덮어쓰기(이 기기 변경을 우선)
                    await retryRemoteSave(state)
                    clearConflict()
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                로컬로 덮어쓰기
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-md border border-amber-200 bg-transparent px-2 py-1 text-xs hover:bg-amber-100 disabled:opacity-50"
                onClick={() => clearConflict()}
              >
                나중에
              </button>
            </>
          ) : sync.state === 'error' ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs hover:bg-red-100 disabled:opacity-50"
              onClick={async () => {
                setBusy(true)
                try {
                  await retryRemoteSave(state)
                } finally {
                  setBusy(false)
                }
              }}
            >
              재시도
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

