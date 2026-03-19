export interface DashboardData {
  skills: number
  plugins: number
  hooks: number
  mcp_servers: number
}

export interface HealthResult {
  valid: boolean
  message: string
  target: string
}

export interface SkillSummary {
  name: string
  description: string
  source: string
  invoke_command: string
  path: string
}

export interface SkillDetail extends SkillSummary {
  content: string
  editable: boolean
}

export interface SettingsData {
  global_settings: Record<string, unknown>
  local_settings: Record<string, unknown>
  last_mtime: number
}

export interface ClaudeMdEntry {
  scope: string
  path: string
  exists: boolean
  decoded_path?: string
}
