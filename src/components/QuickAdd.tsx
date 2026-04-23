import { useState, type FormEvent } from 'react'
import { useTodo } from '../TodoContext'

export function QuickAdd() {
  const { addTask, viewTitle } = useTodo()
  const [value, setValue] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    addTask(value)
    setValue('')
  }

  return (
    <form onSubmit={onSubmit} className="mb-4">
      <div className="flex overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm focus-within:border-todoist-red focus-within:ring-1 focus-within:ring-todoist-red/30">
        <span className="flex items-center pl-3 text-todoist-red">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </span>
        <input
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-neutral-400"
          placeholder={`‘${viewTitle}’에 작업 추가`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <p className="mt-1.5 text-xs text-neutral-400">
        Enter로 추가 · 공백으로 구분해 <code className="rounded bg-neutral-100 px-1">#태그</code> 입력 가능 · 마감일은 작업 상세에서 설정
      </p>
    </form>
  )
}
