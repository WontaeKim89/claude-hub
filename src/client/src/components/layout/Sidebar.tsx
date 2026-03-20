import { NavLink } from 'react-router-dom'

interface NavItem {
  label: string
  to?: string
  disabled?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', to: '/' }],
  },
  {
    title: 'Extensions',
    items: [
      { label: 'Skills', to: '/skills' },
      { label: 'Plugins', to: '/plugins' },
      { label: 'Agents', to: '/agents' },
      { label: 'Commands', to: '/commands' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { label: 'Settings', to: '/settings' },
      { label: 'Hooks', to: '/hooks' },
      { label: 'MCP Servers', disabled: true },
      { label: 'Keybindings', disabled: true },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'CLAUDE.md', to: '/claude-md' },
      { label: 'Memory', disabled: true },
      { label: 'Teams', disabled: true },
    ],
  },
  {
    title: 'Store',
    items: [{ label: 'Marketplace', disabled: true }],
  },
]

export function Sidebar() {
  return (
    <aside className="w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-zinc-800">
        <span className="text-zinc-100 font-semibold text-sm">claude-hub</span>
        <span className="ml-2 text-zinc-500 text-xs">v0.1.0</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
            <p className="px-4 py-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
              {group.title}
            </p>
            {group.items.map((item) => {
              if (item.disabled || !item.to) {
                return (
                  <span
                    key={item.label}
                    className="flex items-center px-4 py-1.5 text-sm text-zinc-600 cursor-not-allowed"
                  >
                    {item.label}
                  </span>
                )
              }
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    isActive
                      ? 'flex items-center px-4 py-1.5 text-sm text-indigo-400 bg-indigo-500/10 border-l-2 border-indigo-500'
                      : 'flex items-center px-4 py-1.5 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 border-l-2 border-transparent'
                  }
                >
                  {item.label}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
