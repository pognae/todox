import { TodoProvider } from './TodoContext'
import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { MainContent } from './components/MainContent'
import { DetailPanels } from './components/DetailPanels'
import { NotificationScheduler } from './components/NotificationScheduler'
import { SyncBanner } from './components/SyncBanner'

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white text-neutral-900">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <SyncBanner />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
          <MainContent onOpenSidebar={() => setSidebarOpen(true)} />
          <DetailPanels />
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
