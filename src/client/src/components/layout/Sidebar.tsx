import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Blocks,
  Keyboard,
  FileText,
  Store,
  FileStack,
  FolderKanban,
  MessageSquare,
  FlaskConical,
  Cpu,
  Settings,
} from 'lucide-react'
import { useLang } from '../../hooks/useLang'
import { Logo } from './Logo'
import { api } from '../../lib/api-client'
import type { ClaudeStatus } from '../../lib/types'

interface NavItem {
  label: string
  labelKey: string
  to: string
  icon: React.ElementType
  shortcut?: string
}

interface NavGroup {
  title: string
  titleKey: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    titleKey: 'nav.overview',
    items: [
      { label: 'Dashboard', labelKey: 'nav.dashboard', to: '/', icon: LayoutDashboard, shortcut: '⌘1' },
      { label: 'Projects', labelKey: 'nav.projects', to: '/projects', icon: FolderKanban },
    ],
  },
  {
    title: 'Monitor',
    titleKey: 'nav.monitor',
    items: [
      { label: 'Sessions', labelKey: 'nav.sessions', to: '/sessions', icon: MessageSquare },
    ],
  },
  {
    title: 'Context',
    titleKey: 'nav.contextMgmt',
    items: [
      { label: 'Context', labelKey: 'nav.contextMgmt', to: '/context', icon: FileText },
    ],
  },
  {
    title: 'Extensions',
    titleKey: 'nav.extensions',
    items: [
      { label: 'Extensions', labelKey: 'nav.extensionsPage', to: '/extensions', icon: Blocks },
      { label: 'Marketplace', labelKey: 'nav.marketplace', to: '/marketplace', icon: Store },
      { label: 'Templates', labelKey: 'nav.templates', to: '/templates', icon: FileStack },
    ],
  },
  {
    title: 'Labs',
    titleKey: 'nav.labs',
    items: [
      { label: 'Harness Wizard', labelKey: 'nav.harnessWizard', to: '/wizard', icon: FlaskConical },
      { label: 'Claude 설정', labelKey: 'nav.claudeSettings', to: '/claude-settings', icon: Cpu },
      { label: 'Keybindings', labelKey: 'nav.keybindings', to: '/keybindings', icon: Keyboard },
      { label: 'Hub 설정', labelKey: 'nav.hubSettings', to: '/hub-settings', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const { lang, toggleLang, t } = useLang()
  const { data: claudeStatus } = useQuery<ClaudeStatus>({
    queryKey: ['claude-status'],
    queryFn: () => api.claude.status(),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  return (
    <aside className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-3 py-3.5 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="font-mono text-[9px] text-zinc-700 bg-zinc-800/50 px-1.5 py-0.5 rounded">v0.1</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group, groupIndex) => (
          <div key={group.title} className={groupIndex > 0 ? 'mt-1' : ''}>
            {groupIndex > 0 && (
              <div className="mx-3 mb-1 border-t border-zinc-800/50" />
            )}
            <p className="px-3 py-1 text-[10px] font-mono font-medium uppercase tracking-widest text-zinc-600">
              {t(group.titleKey)}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    isActive
                      ? 'group flex items-center gap-2.5 px-3 py-1.5 text-xs text-fuchsia-400 bg-fuchsia-400/8 border-l-2 border-fuchsia-400'
                      : 'group flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border-l-2 border-transparent transition-colors duration-150'
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="w-1 h-1 rounded-full bg-fuchsia-400 shrink-0 -ml-0.5 mr-0" />
                      )}
                      <Icon size={14} strokeWidth={1.5} className="shrink-0" />
                      <span className="flex-1">{t(item.labelKey)}</span>
                      {item.shortcut && (
                        <span className="font-mono text-[9px] text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          {item.shortcut}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Language toggle + Status footer */}
      <div className="border-t border-zinc-800 space-y-2 px-3 pt-3 pb-3">
        {/* Capsule language toggle */}
        <div className="relative flex items-center bg-zinc-800 rounded-full p-0.5 w-full">
          <button
            onClick={lang === 'en' ? toggleLang : undefined}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
              lang === 'ko'
                ? 'bg-fuchsia-500/20 text-fuchsia-400 shadow-sm shadow-fuchsia-500/10'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="text-sm">🇰🇷</span>
            <span className="font-mono">KO</span>
          </button>
          <button
            onClick={lang === 'ko' ? toggleLang : undefined}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
              lang === 'en'
                ? 'bg-fuchsia-500/20 text-fuchsia-400 shadow-sm shadow-fuchsia-500/10'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="text-sm">🇺🇸</span>
            <span className="font-mono">EN</span>
          </button>
        </div>

        {/* Claude 연결 상태 */}
        <div className="flex items-center gap-1.5">
          <span className={`text-xs leading-none ${claudeStatus?.connected ? 'text-fuchsia-400' : 'text-zinc-600'}`}>●</span>
          <span className="font-mono text-xs text-zinc-500">
            {claudeStatus?.connected ? t('common.connected') : 'Claude CLI'}
          </span>
          {claudeStatus?.version && (
            <span className="font-mono text-[9px] text-zinc-700 ml-auto truncate max-w-[60px]" title={claudeStatus.version}>
              {claudeStatus.version.split(' ').slice(-1)[0]}
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}
