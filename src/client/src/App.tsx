import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar } from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import ClaudeMd from './pages/ClaudeMd'
import Keybindings from './pages/Keybindings'
import Marketplace from './pages/Marketplace'
import Memory from './pages/Memory'
import Teams from './pages/Teams'
import Wizard from './pages/Wizard'
import Cost from './pages/Cost'
import Templates from './pages/Templates'
import ConfigDiff from './pages/ConfigDiff'
import ProjectOverview from './pages/ProjectOverview'
import Sessions from './pages/Sessions'
import ClaudeSettings from './pages/ClaudeSettings'
import Extensions from './pages/Extensions'

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
        <Route path="/extensions" element={<Extensions />} />
        {/* 이전 개별 라우트 — /extensions 로 리다이렉트 */}
        <Route path="/skills" element={<Navigate to="/extensions" replace />} />
        <Route path="/plugins" element={<Navigate to="/extensions" replace />} />
        <Route path="/agents" element={<Navigate to="/extensions" replace />} />
        <Route path="/commands" element={<Navigate to="/extensions" replace />} />
        <Route path="/hooks" element={<Navigate to="/extensions" replace />} />
        <Route path="/mcp" element={<Navigate to="/extensions" replace />} />
        <Route path="/settings" element={<Navigate to="/claude-settings" replace />} />
        <Route path="/claude-md" element={<ClaudeMd />} />
        <Route path="/keybindings" element={<Keybindings />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/memory" element={<Memory />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/wizard" element={<Wizard />} />
        <Route path="/monitor" element={<Navigate to="/sessions" replace />} />
        <Route path="/cost" element={<Cost />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/config-diff" element={<ConfigDiff />} />
        <Route path="/projects" element={<ProjectOverview />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/claude-settings" element={<ClaudeSettings />} />
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
