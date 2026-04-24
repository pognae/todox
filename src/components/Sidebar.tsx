import { useState, type ReactNode } from 'react'
import { useTodo } from '../TodoContext'

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
        active
          ? 'bg-red-50 font-medium text-todoist-red'
          : 'text-neutral-700 hover:bg-neutral-200/80'
      }`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-neutral-500">
        {icon}
      </span>
      {label}
    </button>
  )
}

export function Sidebar() {
  const { view, setView, projects, addProject, deleteProject, allTags } = useTodo()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const customProjects = projects.filter((p) => !p.isInbox)

  const submitProject = () => {
    if (newName.trim()) addProject(newName.trim())
    setNewName('')
    setAdding(false)
  }

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-neutral-200 bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="text-2xl font-bold tracking-tight text-todoist-red">todox</span>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4">
        <NavButton
          active={view.type === 'inbox'}
          onClick={() => setView({ type: 'inbox' })}
          label="받은 편지함"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0h-2M4 13h2m0 0V9a2 2 0 012-2h2m4 0V7a2 2 0 012-2h2a2 2 0 012 2v4M6 13v4" />
            </svg>
          }
        />
        <NavButton
          active={view.type === 'today'}
          onClick={() => setView({ type: 'today' })}
          label="오늘"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <NavButton
          active={view.type === 'upcoming'}
          onClick={() => setView({ type: 'upcoming' })}
          label="다가오는 날"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        />
        <NavButton
          active={view.type === 'calendar'}
          onClick={() => {
            const t = new Date()
            setView({ type: 'calendar', year: t.getFullYear(), month: t.getMonth() + 1 })
          }}
          label="캘린더"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <NavButton
          active={view.type === 'settings'}
          onClick={() => setView({ type: 'settings' })}
          label="설정"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />

        <p className="mb-1 mt-6 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          내 프로젝트
        </p>

        {customProjects.map((p) => (
          <div key={p.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => setView({ type: 'project', projectId: p.id })}
              className={`flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                view.type === 'project' && view.projectId === p.id
                  ? 'bg-red-50 font-medium text-todoist-red'
                  : 'text-neutral-700 hover:bg-neutral-200/80'
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="truncate">{p.name}</span>
            </button>
            <button
              type="button"
              title="삭제"
              onClick={() => {
                if (confirm(`‘${p.name}’ 프로젝트를 삭제할까요? 할 일은 받은 편지함으로 옮겨집니다.`))
                  deleteProject(p.id)
              }}
              className="rounded p-1 text-neutral-400 opacity-0 hover:bg-neutral-200 hover:text-neutral-600 group-hover:opacity-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}

        {adding ? (
          <div className="mt-1 flex gap-1 px-2">
            <input
              autoFocus
              className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-todoist-red"
              placeholder="프로젝트 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitProject()
                if (e.key === 'Escape') {
                  setAdding(false)
                  setNewName('')
                }
              }}
            />
            <button
              type="button"
              className="rounded bg-todoist-red px-2 text-sm text-white hover:bg-todoist-red-hover"
              onClick={submitProject}
            >
              추가
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-200/80"
          >
            <span className="text-lg leading-none">+</span>
            프로젝트 추가
          </button>
        )}

        <p className="mb-1 mt-6 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">태그</p>
        {allTags.length === 0 ? (
          <p className="px-3 py-1 text-xs text-neutral-400">작업에 #태그를 붙이면 여기에 표시됩니다.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {allTags.map((tag) => {
              const active = view.type === 'tag' && view.tag === tag
              return (
                <li key={tag}>
                  <button
                    type="button"
                    onClick={() => setView({ type: 'tag', tag })}
                    className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? 'bg-red-50 font-medium text-todoist-red'
                        : 'text-neutral-700 hover:bg-neutral-200/80'
                    }`}
                  >
                    <span className="min-w-0 truncate">#{tag}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </nav>
    </aside>
  )
}
