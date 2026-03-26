import type { DashboardData, HealthResult, SkillSummary, SkillDetail, SettingsData, ClaudeMdEntry, PluginSummary, AgentSummary, AgentDetail, CommandSummary, CommandDetail, HooksData, McpData, KeybindingsData, MarketplaceSource, MarketplacePlugin, MemoryProject, MemoryFileList, MemoryFileDetail, TeamSummary, BackupHistory, DiffResult, DiffRequest, AnalysisResult, ClaudeStatus, WizardResult, SkillGenResult, CostSummary, ProjectCost, MonitorEvent, HarnessTemplate, ConfigDiffItem } from './types'

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
    projectConfigs: () => request<Array<{
      name: string; encoded: string; path: string
      claude_md: boolean; memory: boolean; settings: boolean
      agents: boolean; commands: boolean; count: number; total: number
    }>>('/dashboard/project-configs'),
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
    duplicates: () =>
      request<Array<{
        skill_a: string; skill_b: string
        source_a: string; source_b: string
        description_a: string; description_b: string
        similarity: number; grade: 'red' | 'yellow'
      }>>('/skills/duplicates/scan'),
    compare: (skillA: string, skillB: string) =>
      request<{
        skill_a: { name: string; source: string; content: string; lines: number }
        skill_b: { name: string; source: string; content: string; lines: number }
        similarity: number
        diff: string[]
        matching_blocks: Array<{ a_start: number; b_start: number; size: number }>
      }>(`/skills/duplicates/compare?skill_a=${encodeURIComponent(skillA)}&skill_b=${encodeURIComponent(skillB)}`),
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
    mcp: () => request<Array<{ name: string; description: string; package: string; category: string; source: string; installed: boolean }>>('/marketplace/mcp'),
    installMcp: (name: string, pkg: string) =>
      request<{ ok: boolean; name: string }>('/marketplace/mcp/install', {
        method: 'POST',
        body: JSON.stringify({ name, package: pkg }),
      }),
    uninstallMcp: (name: string) =>
      request<{ ok: boolean; name: string }>(`/marketplace/mcp/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      }),
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

  claude: {
    status: () => request<ClaudeStatus>('/claude/status'),
  },

  claudeSettings: {
    get: () => request<{ model: string; plan: string; cli_version?: string }>('/claude/settings'),
    updateModel: (model: string) => request<{ ok: boolean; model: string }>('/claude/settings/model', { method: 'PUT', body: JSON.stringify({ model }) }),
    rateLimits: () => request<{
      five_hour: { utilization: number; resets_at: string | null } | null;
      seven_day: { utilization: number; resets_at: string | null } | null;
      seven_day_sonnet: { utilization: number; resets_at: string | null } | null;
      seven_day_opus: { utilization: number; resets_at: string | null } | null;
      extra_usage: { is_enabled: boolean; monthly_limit: number | null; used_credits: number | null; utilization: number | null } | null;
    }>('/claude/rate-limits'),
    usage: () => request<{
      today: { sessions: number; tokens_in: number; tokens_out: number; cost: number; tool_calls: number; activity: { messages: number; sessions: number; tool_calls: number } | null };
      weekly: { sessions: number; tokens_in: number; tokens_out: number; cost: number };
      monthly: { sessions: number; tokens_in: number; tokens_out: number; cost: number };
      daily_avg_cost: number;
      model_breakdown: Record<string, { input: number; output: number; cost: number }>;
    }>('/claude/usage'),
    authStatus: () => request<{ authenticated: boolean; details: string }>('/claude/auth/status'),
    authLogin: () => request<{ ok: boolean; message: string }>('/claude/auth/login', { method: 'POST' }),
    authLogout: () => request<{ ok: boolean; message: string }>('/claude/auth/logout', { method: 'POST' }),
    remoteStart: (task: string) => request<{ ok: boolean; message: string }>('/claude/remote-start', { method: 'POST', body: JSON.stringify({ task }) }),
    teleport: () => request<{ ok: boolean; message: string }>('/claude/teleport', { method: 'POST' }),
  },

  analysis: {
    skills: () => request<AnalysisResult>('/analysis/skills', { method: 'POST' }),
    plugins: () => request<AnalysisResult>('/analysis/plugins', { method: 'POST' }),
    getCached: (type: string) => request<AnalysisResult>(`/analysis/${type}`),
  },

  wizard: {
    analyze: (projectPath: string) =>
      request<WizardResult>('/wizard/analyze', {
        method: 'POST',
        body: JSON.stringify({ project_path: projectPath }),
      }),
    apply: (data: { project_path: string; claude_md?: string; hooks?: Array<Record<string, unknown>> }) =>
      request('/wizard/apply', { method: 'POST', body: JSON.stringify(data) }),
    generateSkill: (messages: Array<{ role: string; content: string }>) =>
      request<SkillGenResult>('/wizard/generate-skill', {
        method: 'POST',
        body: JSON.stringify({ messages }),
      }),
    projectOverviews: () =>
      request<Array<{
        project_path: string
        project_name: string
        items: Array<{
          name: string
          type: string
          exists: boolean
          count?: number
          lines?: number
          files?: string[]
          path: string
        }>
      }>>('/wizard/project-overviews'),
    projectTree: (path: string) =>
      request<{ project_name: string; project_path: string; nodes: unknown[] }>(
        `/wizard/project-tree?path=${encodeURIComponent(path)}`
      ),
    compact: (path: string) =>
      request<{ original_lines: number; compacted: string; compacted_lines: number; path: string }>(
        '/wizard/compact',
        { method: 'POST', body: JSON.stringify({ path }) }
      ),
    projectTreesAll: () =>
      request<Array<{ project_name: string; project_path: string; nodes: unknown[] }>>('/wizard/project-trees-all'),
    deleteProject: (encoded: string) =>
      request<{ ok: boolean; deleted: string }>(`/projects/${encodeURIComponent(encoded)}`, { method: 'DELETE' }),
    projectsGrouped: () =>
      request<Array<{
        path: string
        name: string
        main: { decoded: string; encoded: string; is_worktree: boolean } | null
        worktrees: Array<{ decoded: string; encoded: string; is_worktree: boolean }>
      }>>('/projects/grouped'),
    permissionsStatus: (projectPath: string) =>
      request<{ all_allowed: boolean }>(`/projects/permissions-status?project_path=${encodeURIComponent(projectPath)}`),
    togglePermissions: (projectPath: string, enabled: boolean) =>
      request<{ ok: boolean; enabled: boolean }>('/projects/toggle-permissions', {
        method: 'POST',
        body: JSON.stringify({ project_path: projectPath, enabled }),
      }),
  },

  cost: {
    summary: (days = 7) => request<CostSummary>(`/cost/summary?days=${days}`),
    byProject: (days = 7) => request<ProjectCost[]>(`/cost/by-project?days=${days}`),
  },

  monitor: {
    session: () => request<{ active_sessions: unknown[] }>('/monitor/session'),
    recentEvents: (limit = 50) => request<{ events: MonitorEvent[] }>(`/monitor/recent-events?limit=${limit}`),
  },

  templates: {
    list: () => request<HarnessTemplate[]>('/templates'),
    get: (name: string) => request<HarnessTemplate>(`/templates/${name}`),
    save: (data: Record<string, unknown>) => request('/templates', { method: 'POST', body: JSON.stringify(data) }),
    delete: (name: string) => request(`/templates/${name}`, { method: 'DELETE' }),
    export: (projectPath: string) => request<HarnessTemplate>('/templates/export', { method: 'POST', body: JSON.stringify({ project_path: projectPath }) }),
    apply: (name: string, projectPath: string) => request(`/templates/${name}/apply`, { method: 'POST', body: JSON.stringify({ project_path: projectPath }) }),
    community: () => request<HarnessTemplate[]>('/templates/community/fetch'),
    importUrl: (url: string) => request<{ imported: boolean; name: string }>('/templates/community/import', { method: 'POST', body: JSON.stringify({ url }) }),
  },

  configDiff: {
    diff: (projectA: string, projectB: string) => request<ConfigDiffItem[]>('/config/diff', { method: 'POST', body: JSON.stringify({ project_a: projectA, project_b: projectB }) }),
    sync: (source: string, target: string) => request<{ synced: boolean; target: string }>('/config/sync', { method: 'POST', body: JSON.stringify({ source, target }) }),
  },

  sessions: {
    list: (project?: string) =>
      request<Array<{ id: string; project: string; project_path: string; file: string; size: number; modified: number; message_count: number; title: string }>>(
        `/sessions${project ? `?project=${encodeURIComponent(project)}` : ''}`
      ),
    messages: (sessionId: string, project?: string, limit = 200) =>
      request<{
        session_id: string
        messages: Array<{
          role: string
          content: Array<{ type: string; text?: string; name?: string; input_preview?: string; content_preview?: string }>
          model: string
        }>
      }>(`/sessions/${sessionId}/messages?limit=${limit}${project ? `&project=${encodeURIComponent(project)}` : ''}`),
    delete: (sessionId: string) =>
      request<{ deleted: boolean }>(`/sessions/${sessionId}`, { method: 'DELETE' }),
  },

  hub: {
    settings: () => request<{ autostart: boolean; tracker_installed: boolean; tracker_command: string }>('/hub/settings'),
    setAutostart: (enabled: boolean) =>
      request<{ ok: boolean; autostart: boolean }>(`/hub/settings/autostart?enabled=${enabled}`, { method: 'PUT' }),
    installTracker: () =>
      request<{ ok: boolean; command: string }>('/hub/settings/install-tracker', { method: 'POST' }),
  },
}