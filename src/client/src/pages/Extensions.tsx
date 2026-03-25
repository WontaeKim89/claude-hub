import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sparkles, Puzzle, Bot, Webhook, Server } from 'lucide-react'
import Skills from './Skills'
import Plugins from './Plugins'
import Agents from './Agents'
import Hooks from './Hooks'
import Mcp from './Mcp'
import { useLang } from '../hooks/useLang'

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

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('nav.extensionsPage')}</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Skills, Plugins, Agents, Hooks, MCP 통합 관리</p>
      </div>

      {/* 탭 바 */}
      <div className="flex items-center gap-0 border-b border-zinc-800 mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
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
            </button>
          )
        })}
      </div>

      {/* 탭 콘텐츠 */}
      <div>
        {activeTab === 'skills' && <Skills embedded />}
        {activeTab === 'plugins' && <Plugins embedded />}
        {activeTab === 'agents' && <Agents embedded />}
        {activeTab === 'hooks' && <Hooks embedded />}
        {activeTab === 'mcp' && <Mcp embedded />}
      </div>
    </div>
  )
}
