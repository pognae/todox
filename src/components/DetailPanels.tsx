import { useMemo } from 'react'
import { isNoteTask } from '../noteUtils'
import { useTodo } from '../TodoContext'
import type { DetailEditorPreference } from '../types'
import { NoteDetailPanel } from './NoteDetailPanel'
import { TaskDetailPanel } from './TaskDetailPanel'

function resolveEditor(
  note: boolean,
  pref: DetailEditorPreference,
): 'todo' | 'note' {
  if (pref === 'auto') return note ? 'note' : 'todo'
  if (pref === 'todo') return 'todo'
  return 'note'
}

export function DetailPanels() {
  const { tasks, selectedTaskId, settings } = useTodo()

  const route = useMemo(() => {
    if (!selectedTaskId) return null
    const t = tasks.find((x) => x.id === selectedTaskId) ?? null
    if (!t) return null

    const note = isNoteTask(t)
    const pref = note ? settings.detailEditorForNote : settings.detailEditorForTodo
    return resolveEditor(note, pref)
  }, [tasks, selectedTaskId, settings.detailEditorForNote, settings.detailEditorForTodo])

  if (!route) return null
  return route === 'note' ? <NoteDetailPanel /> : <TaskDetailPanel />
}
