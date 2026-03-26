export const CATEGORY_INFO = {
  skills: {
    title: 'info.skills.title',
    description: 'info.skills.desc',
    detail: '~/.claude/skills/{name}/SKILL.md',
  },
  plugins: {
    title: 'info.plugins.title',
    description: 'info.plugins.desc',
    detail: '~/.claude/plugins/',
  },
  agents: {
    title: 'info.agents.title',
    description: 'info.agents.desc',
    detail: '~/.claude/agents/{name}.md',
  },
  commands: {
    title: 'info.commands.title',
    description: 'info.commands.desc',
    detail: '~/.claude/commands/',
  },
  settings: {
    title: 'info.settings.title',
    description: 'info.settings.desc',
    detail: '~/.claude/settings.json',
  },
  hooks: {
    title: 'info.hooks.title',
    description: 'info.hooks.desc',
    detail: 'info.hooks.detail',
  },
  mcp: {
    title: 'info.mcp.title',
    description: 'info.mcp.desc',
    detail: 'settings.json → mcpServers',
  },
  keybindings: {
    title: 'info.keybindings.title',
    description: 'info.keybindings.desc',
    detail: '~/.claude/keybindings.json',
  },
  claudeMd: {
    title: 'info.claudeMd.title',
    description: 'info.claudeMd.desc',
    detail: '~/.claude/CLAUDE.md',
  },
  memory: {
    title: 'info.memory.title',
    description: 'info.memory.desc',
    detail: '~/.claude/projects/{path}/memory/',
  },
  teams: {
    title: 'info.teams.title',
    description: 'info.teams.desc',
    detail: '~/.claude/teams/',
  },
  marketplace: {
    title: 'info.marketplace.title',
    description: 'info.marketplace.desc',
    detail: 'info.marketplace.detail',
  },
  monitor: {
    title: 'info.monitor.title',
    description: 'info.monitor.desc',
    detail: '~/.claude/projects/**/*.jsonl',
  },
  cost: {
    title: 'info.cost.title',
    description: 'info.cost.desc',
    detail: 'info.cost.detail',
  },
  templates: {
    title: 'info.templates.title',
    description: 'info.templates.desc',
    detail: '~/.claude-hub/templates/{name}.json',
  },
  configDiff: {
    title: 'info.configDiff.title',
    description: 'info.configDiff.desc',
    detail: 'info.configDiff.detail',
  },
  projects: {
    title: 'info.projects.title',
    description: 'info.projects.desc',
    detail: 'info.projects.detail',
  },
  sessions: {
    title: 'info.sessions.title',
    description: 'info.sessions.desc',
    detail: '~/.claude/projects/{path}/*.jsonl',
  },
  claudeSettings: {
    title: 'info.claudeSettings.title',
    description: 'info.claudeSettings.desc',
    detail: '~/.claude/settings.json → model',
  },
} as const
