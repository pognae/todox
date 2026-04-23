import { TodoProvider } from './TodoContext'
import { Sidebar } from './components/Sidebar'
import { MainContent } from './components/MainContent'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { NotificationScheduler } from './components/NotificationScheduler'

function AppShell() {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white text-neutral-900">
      <Sidebar />
      <MainContent />
      <TaskDetailPanel />
      <NotificationScheduler />
    </div>
  )
}

export default function App() {
  return (
    <TodoProvider>
      <AppShell />
    </TodoProvider>
  )
}
