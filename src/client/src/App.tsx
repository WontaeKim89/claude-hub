import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar } from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import Skills from './pages/Skills'
import Settings from './pages/Settings'
import ClaudeMd from './pages/ClaudeMd'
import Plugins from './pages/Plugins'
import Agents from './pages/Agents'
import Commands from './pages/Commands'
import Hooks from './pages/Hooks'
import Mcp from './pages/Mcp'
import Keybindings from './pages/Keybindings'
import Marketplace from './pages/Marketplace'
import Memory from './pages/Memory'
import Teams from './pages/Teams'
import Wizard from './pages/Wizard'
import Monitor from './pages/Monitor'
import Cost from './pages/Cost'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

// 라우트 전환 시 fade-in 애니메이션 적용
function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="animate-fade-in">
      <Routes location={location}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/claude-md" element={<ClaudeMd />} />
        <Route path="/plugins" element={<Plugins />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/commands" element={<Commands />} />
        <Route path="/hooks" element={<Hooks />} />
        <Route path="/mcp" element={<Mcp />} />
        <Route path="/keybindings" element={<Keybindings />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/memory" element={<Memory />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/wizard" element={<Wizard />} />
        <Route path="/monitor" element={<Monitor />} />
        <Route path="/cost" element={<Cost />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="flex h-screen bg-zinc-950 text-zinc-100">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">
            <AnimatedRoutes />
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
