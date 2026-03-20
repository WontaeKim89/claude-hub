import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar } from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import Skills from './pages/Skills'
import Settings from './pages/Settings'
import ClaudeMd from './pages/ClaudeMd'
import Plugins from './pages/Plugins'
import Agents from './pages/Agents'
import Commands from './pages/Commands'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="flex h-screen bg-zinc-950 text-zinc-100">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/skills" element={<Skills />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/claude-md" element={<ClaudeMd />} />
              <Route path="/plugins" element={<Plugins />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/commands" element={<Commands />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
