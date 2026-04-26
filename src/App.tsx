import { TodoProvider } from './TodoContext'
import { Sidebar } from './components/Sidebar'
import { MainContent } from './components/MainContent'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { NotificationScheduler } from './components/NotificationScheduler'
import { SyncBanner } from './components/SyncBanner'

function AppShell() {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white text-neutral-900">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <SyncBanner />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar />
          <MainContent />
          <TaskDetailPanel />
          <NotificationScheduler />
        </div>
      </div>
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
