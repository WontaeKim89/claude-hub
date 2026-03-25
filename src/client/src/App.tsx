import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar } from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import ContextManager from './pages/ContextManager'
import Keybindings from './pages/Keybindings'
import Marketplace from './pages/Marketplace'
import Teams from './pages/Teams'
import Wizard from './pages/Wizard'
import Cost from './pages/Cost'
import Templates from './pages/Templates'
import ProjectOverview from './pages/ProjectOverview'
import Sessions from './pages/Sessions'
import ClaudeSettings from './pages/ClaudeSettings'
import Extensions from './pages/Extensions'
import HubSettings from './pages/HubSettings'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="animate-fade-in">
      <Routes location={location}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/extensions" element={<Extensions />} />
        <Route path="/context" element={<ContextManager />} />
        <Route path="/keybindings" element={<Keybindings />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/wizard" element={<Wizard />} />
        <Route path="/cost" element={<Cost />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/projects" element={<ProjectOverview />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/claude-settings" element={<ClaudeSettings />} />
        <Route path="/hub-settings" element={<HubSettings />} />
        <Route path="/teams" element={<Teams />} />
        {/* 리다이렉트 */}
        <Route path="/skills" element={<Navigate to="/extensions" replace />} />
        <Route path="/plugins" element={<Navigate to="/extensions" replace />} />
        <Route path="/agents" element={<Navigate to="/extensions" replace />} />
        <Route path="/commands" element={<Navigate to="/extensions" replace />} />
        <Route path="/hooks" element={<Navigate to="/extensions" replace />} />
        <Route path="/mcp" element={<Navigate to="/extensions" replace />} />
        <Route path="/settings" element={<Navigate to="/claude-settings" replace />} />
        <Route path="/claude-md" element={<Navigate to="/context" replace />} />
        <Route path="/memory" element={<Navigate to="/context" replace />} />
        <Route path="/config-diff" element={<Navigate to="/context" replace />} />
        <Route path="/monitor" element={<Navigate to="/sessions" replace />} />
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
