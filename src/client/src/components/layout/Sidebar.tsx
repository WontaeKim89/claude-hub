import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Sparkles,
  Puzzle,
  Bot,
  Terminal,
  Settings,
  Webhook,
  Server,
  Keyboard,
  FileText,
  Brain,
  Users,
  Store,
} from 'lucide-react'
import { useLang } from '../../hooks/useLang'

interface NavItem {
  label: string
  labelKey: string
  to: string
  icon: React.ElementType
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
    items: [{ label: 'Dashboard', labelKey: 'nav.dashboard', to: '/', icon: LayoutDashboard }],
  },
  {
    title: 'Extensions',
    titleKey: 'nav.extensions',
    items: [
      { label: 'Skills', labelKey: 'nav.skills', to: '/skills', icon: Sparkles },
      { label: 'Plugins', labelKey: 'nav.plugins', to: '/plugins', icon: Puzzle },
      { label: 'Agents', labelKey: 'nav.agents', to: '/agents', icon: Bot },
      { label: 'Commands', labelKey: 'nav.commands', to: '/commands', icon: Terminal },
    ],
  },
  {
    title: 'Configuration',
    titleKey: 'nav.configuration',
    items: [
      { label: 'Settings', labelKey: 'nav.settings', to: '/settings', icon: Settings },
      { label: 'Hooks', labelKey: 'nav.hooks', to: '/hooks', icon: Webhook },
      { label: 'MCP Servers', labelKey: 'nav.mcp', to: '/mcp', icon: Server },
      { label: 'Keybindings', labelKey: 'nav.keybindings', to: '/keybindings', icon: Keyboard },
    ],
  },
  {
    title: 'Content',
    titleKey: 'nav.content',
    items: [
      { label: 'CLAUDE.md', labelKey: 'nav.claudemd', to: '/claude-md', icon: FileText },
      { label: 'Memory', labelKey: 'nav.memory', to: '/memory', icon: Brain },
      { label: 'Teams', labelKey: 'nav.teams', to: '/teams', icon: Users },
    ],
  },
  {
    title: 'Store',
    titleKey: 'nav.store',
    items: [{ label: 'Marketplace', labelKey: 'nav.marketplace', to: '/marketplace', icon: Store }],
  },
]

export function Sidebar() {
  const { lang, toggleLang, t } = useLang()

  return (
    <aside className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-zinc-100 font-semibold text-sm tracking-tight">claude-hub</span>
          <span className="font-mono text-zinc-600 text-xs">v0.1.0</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-3">
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
                      ? 'flex items-center gap-2.5 px-3 py-1.5 text-xs text-emerald-400 bg-emerald-400/8 border-l-2 border-emerald-400'
                      : 'flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border-l-2 border-transparent transition-colors'
                  }
                >
                  <Icon size={14} strokeWidth={1.5} />
                  {t(item.labelKey)}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Language toggle + Status footer */}
      <div className="px-3 py-3 border-t border-zinc-800 space-y-2">
        <div className="flex items-center gap-1">
          <button
            onClick={toggleLang}
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              lang === 'ko' ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            KO
          </button>
          <span className="text-zinc-700 text-[10px]">/</span>
          <button
            onClick={toggleLang}
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              lang === 'en' ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            EN
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-400 text-xs leading-none">●</span>
          <span className="font-mono text-xs text-zinc-500">{t('common.connected')}</span>
        </div>
      </div>
    </aside>
  )
}
