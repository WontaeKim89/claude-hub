import { useState } from 'react'
import { FileText, Brain, GitCompare } from 'lucide-react'
import ClaudeMd from './ClaudeMd'
import Memory from './Memory'
import ConfigDiff from './ConfigDiff'
import { useLang } from '../hooks/useLang'

type Tab = 'claude-md' | 'memory' | 'compare'

const TABS: { key: Tab; labelKey: string; icon: React.ElementType }[] = [
  { key: 'claude-md', labelKey: 'nav.claudemd', icon: FileText },
  { key: 'memory', labelKey: 'nav.memory', icon: Brain },
  { key: 'compare', labelKey: 'nav.contextCompare', icon: GitCompare },
]

export default function ContextManager() {
  const [activeTab, setActiveTab] = useState<Tab>('claude-md')
  const { t } = useLang()

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
          {t('nav.contextManagement')}
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          CLAUDE.md, Memory, Context Compare 통합 관리
        </p>
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
        {activeTab === 'claude-md' && <ClaudeMd embedded />}
        {activeTab === 'memory' && <Memory embedded />}
        {activeTab === 'compare' && <ConfigDiff embedded />}
      </div>
    </div>
  )
}
