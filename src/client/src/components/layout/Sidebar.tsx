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

interface NavItem {
  label: string
  to: string
  icon: React.ElementType
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard }],
  },
  {
    title: 'Extensions',
    items: [
      { label: 'Skills', to: '/skills', icon: Sparkles },
      { label: 'Plugins', to: '/plugins', icon: Puzzle },
      { label: 'Agents', to: '/agents', icon: Bot },
      { label: 'Commands', to: '/commands', icon: Terminal },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { label: 'Settings', to: '/settings', icon: Settings },
      { label: 'Hooks', to: '/hooks', icon: Webhook },
      { label: 'MCP Servers', to: '/mcp', icon: Server },
      { label: 'Keybindings', to: '/keybindings', icon: Keyboard },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'CLAUDE.md', to: '/claude-md', icon: FileText },
      { label: 'Memory', to: '/memory', icon: Brain },
      { label: 'Teams', to: '/teams', icon: Users },
    ],
  },
  {
    title: 'Store',
    items: [{ label: 'Marketplace', to: '/marketplace', icon: Store }],
  },
]

export function Sidebar() {
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
              {group.title}
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
                  {item.label}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Status footer */}
      <div className="px-3 py-3 border-t border-zinc-800">
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-400 text-xs leading-none">●</span>
          <span className="font-mono text-xs text-zinc-500">Connected</span>
        </div>
      </div>
    </aside>
  )
}
