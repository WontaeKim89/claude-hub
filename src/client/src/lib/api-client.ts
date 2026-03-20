import type { DashboardData, HealthResult, SkillSummary, SkillDetail, SettingsData, ClaudeMdEntry, PluginSummary, AgentSummary, AgentDetail, CommandSummary, CommandDetail } from './types'

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
    get: () => request<HealthResult[]>('/health'),
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
}
