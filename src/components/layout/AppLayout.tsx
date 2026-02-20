import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-hoxton-light">
      <Sidebar />
      <main className="relative isolate ml-64 min-h-screen p-8">
        <Outlet />
      </main>
    </div>
  )
}
