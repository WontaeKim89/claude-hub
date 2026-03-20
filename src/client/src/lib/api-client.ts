import type { DashboardData, HealthResult, SkillSummary, SkillDetail, SettingsData, ClaudeMdEntry, PluginSummary, AgentSummary, AgentDetail, CommandSummary, CommandDetail, HooksData, McpData, KeybindingsData, MarketplaceSource, MarketplacePlugin, MemoryProject, MemoryFileList, MemoryFileDetail, TeamSummary, BackupHistory, DiffResult, DiffRequest } from './types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(body.message ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export const api = {
  dashboard: {
    get: () => request<DashboardData>('/dashboard'),
  },

  health: {
    get: () => request<{ results: HealthResult[] }>('/health').then(r => r.results),
  },

  skills: {
    list: () => request<SkillSummary[]>('/skills'),
    get: (name: string) => request<SkillDetail>(`/skills/${encodeURIComponent(name)}`),
    create: (data: { name: string; description: string; content: string }) =>
      request<SkillDetail>('/skills', { method: 'POST', body: JSON.stringify(data) }),
    update: (name: string, content: string) =>
      request<SkillDetail>(`/skills/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    delete: (name: string) =>
      request<void>(`/skills/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  },

  settings: {
    get: () => request<SettingsData>('/settings'),
    update: (data: { global_settings?: Record<string, unknown>; local_settings?: Record<string, unknown>; last_mtime: number }) =>
      request<SettingsData>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  plugins: {
    list: () => request<PluginSummary[]>('/plugins'),
    toggle: (name: string, enabled: boolean) =>
      request<{ ok: boolean }>(`/plugins/${encodeURIComponent(name)}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      }),
    install: (name: string, marketplace: string) =>
      request<{ ok: boolean; output: string }>('/plugins/install', {
        method: 'POST',
        body: JSON.stringify({ name, marketplace }),
      }),
    remove: (name: string) =>
      request<{ ok: boolean; output: string }>(`/plugins/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      }),
  },

  claudeMd: {
    list: () => request<ClaudeMdEntry[]>('/claude-md'),
    get: (scope: string) => request<{ scope: string; content: string; path: string }>(`/claude-md/${encodeURIComponent(scope)}`),
    update: (scope: string, content: string) =>
      request<{ scope: string; content: string; path: string }>(`/claude-md/${encodeURIComponent(scope)}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
  },

  agents: {
    list: () => request<AgentSummary[]>('/agents'),
    get: (name: string) => request<AgentDetail>(`/agents/${encodeURIComponent(name)}`),
    create: (data: { name: string; description: string; model: string; tools: string; max_turns: number; content: string }) =>
      request<AgentSummary>('/agents', { method: 'POST', body: JSON.stringify(data) }),
    update: (name: string, content: string) =>
      request<{ ok: boolean }>(`/agents/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    delete: (name: string) =>
      request<void>(`/agents/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  },

  commands: {
    list: () => request<CommandSummary[]>('/commands'),
    get: (name: string) => request<CommandDetail>(`/commands/${encodeURIComponent(name)}`),
    create: (data: { name: string; content: string }) =>
      request<CommandSummary>('/commands', { method: 'POST', body: JSON.stringify(data) }),
    update: (name: string, content: string) =>
      request<{ ok: boolean }>(`/commands/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    delete: (name: string) =>
      request<void>(`/commands/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  },

  hooks: {
    get: () => request<HooksData>('/hooks'),
    update: (data: { hooks: Record<string, unknown>; last_mtime: number }) =>
      request<{ ok: boolean }>('/hooks', { method: 'PUT', body: JSON.stringify(data) }),
  },

  mcp: {
    get: () => request<McpData>('/mcp'),
    update: (data: { servers: Record<string, unknown>; last_mtime: number }) =>
      request<{ ok: boolean }>('/mcp', { method: 'PUT', body: JSON.stringify(data) }),
  },

  keybindings: {
    get: () => request<KeybindingsData>('/keybindings'),
    update: (data: { data: Record<string, string>; last_mtime: number }) =>
      request<{ ok: boolean }>('/keybindings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  marketplace: {
    sources: () => request<MarketplaceSource[]>('/marketplace/sources'),
    browse: (params?: { source?: string; q?: string; category?: string }) => {
      const qs = new URLSearchParams()
      if (params?.source) qs.set('source', params.source)
      if (params?.q) qs.set('q', params.q)
      if (params?.category) qs.set('category', params.category)
      const query = qs.toString()
      return request<MarketplacePlugin[]>(`/marketplace/browse${query ? `?${query}` : ''}`)
    },
  },

  memory: {
    projects: () => request<MemoryProject[]>('/memory/projects'),
    list: (project: string) => request<MemoryFileList>(`/memory/${encodeURIComponent(project)}`),
    get: (project: string, file: string) =>
      request<MemoryFileDetail>(`/memory/${encodeURIComponent(project)}/${encodeURIComponent(file)}`),
    update: (project: string, file: string, content: string) =>
      request<{ ok: boolean }>(`/memory/${encodeURIComponent(project)}/${encodeURIComponent(file)}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    create: (project: string, name: string, content: string) =>
      request<{ project: string; file: string }>(`/memory/${encodeURIComponent(project)}`, {
        method: 'POST',
        body: JSON.stringify({ name, content }),
      }),
    delete: (project: string, file: string) =>
      request<{ ok: boolean }>(`/memory/${encodeURIComponent(project)}/${encodeURIComponent(file)}`, {
        method: 'DELETE',
      }),
  },

  teams: {
    list: () => request<TeamSummary[]>('/teams'),
    delete: (name: string) =>
      request<{ ok: boolean }>(`/teams/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  },

  backups: {
    list: () => request<BackupHistory>('/backups'),
    restore: (backupId: string) =>
      request<{ restored: boolean; backup_id: string }>(`/backups/${encodeURIComponent(backupId)}/restore`, {
        method: 'POST',
      }),
  },

  previewDiff: (body: DiffRequest) =>
    request<DiffResult>('/preview-diff', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  stats: {
    overview: () => request<{ total_events: number; unique_skills_used: number; unique_plugins_used: number }>('/stats/overview'),
    topSkills: (limit = 10) => request<Array<{ name: string; hit_count: number; last_used: number }>>(`/stats/skills?limit=${limit}`),
    topPlugins: (limit = 5) => request<Array<{ name: string; hit_count: number; last_used: number }>>(`/stats/plugins?limit=${limit}`),
    unused: (days = 30) => request<Array<{ type: string; name: string; last_used: number; total_hits: number }>>(`/stats/unused?days=${days}`),
    timeline: (days = 30) => request<Array<{ date: string; total: number }>>(`/stats/timeline?days=${days}`),
    sync: () => request<{ files_parsed: number; events_found: number; errors: number }>('/stats/sync', { method: 'POST' }),
  },
}