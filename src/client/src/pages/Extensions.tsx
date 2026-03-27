import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, Puzzle, Bot, Webhook, Server } from 'lucide-react'
import Skills from './Skills'
import Plugins from './Plugins'
import Agents from './Agents'
import Hooks from './Hooks'
import Mcp from './Mcp'
import { useLang } from '../hooks/useLang'
import { api } from '../lib/api-client'
import type { DashboardData } from '../lib/types'

type Tab = 'skills' | 'plugins' | 'agents' | 'hooks' | 'mcp'

const TABS: { key: Tab; labelKey: string; icon: React.ElementType }[] = [
  { key: 'skills', labelKey: 'nav.skills', icon: Sparkles },
  { key: 'plugins', labelKey: 'nav.plugins', icon: Puzzle },
  { key: 'agents', labelKey: 'nav.agents', icon: Bot },
  { key: 'hooks', labelKey: 'nav.hooks', icon: Webhook },
  { key: 'mcp', labelKey: 'nav.mcp', icon: Server },
]

const VALID_TABS = new Set<string>(TABS.map((t) => t.key))

export default function Extensions() {
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<Tab>(
    initialTab && VALID_TABS.has(initialTab) ? (initialTab as Tab) : 'skills'
  )
  const { t } = useLang()

  const { data: dashboard } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard.get(),
    staleTime: 60_000,
  })

  const tabCounts: Record<Tab, number> = {
    skills: dashboard?.skills?.total ?? 0,
    plugins: dashboard?.plugins?.total ?? 0,
    agents: dashboard?.agents?.total ?? 0,
    hooks: dashboard?.hooks?.total ?? 0,
    mcp: dashboard?.mcp_servers?.total ?? 0,
  }

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('nav.extensionsPage')}</h2>
        <p className="mt-0.5 text-xs text-zinc-500">{t('extensions.subtitle')}</p>
      </div>

      {/* 탭 바 + 카운트 */}
      <div className="flex items-center gap-0 border-b border-zinc-800 mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          const count = tabCounts[tab.key]
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono border-b-2 transition-colors ${
                isActive
                  ? 'border-fuchsia-500 text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={13} strokeWidth={1.5} />
              {t(tab.labelKey)}
              {count > 0 && (
                <span className={`text-[10px] ml-0.5 ${isActive ? 'text-fuchsia-400' : 'text-zinc-600'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 탭 콘텐츠 */}
      <div>
        {activeTab === 'skills' && <Skills embedded initialFilter={searchParams.get('filter') ?? undefined} />}
        {activeTab === 'plugins' && <Plugins embedded />}
        {activeTab === 'agents' && <Agents embedded />}
        {activeTab === 'hooks' && <Hooks embedded />}
        {activeTab === 'mcp' && <Mcp embedded />}
      </div>
    </div>
  )
}
