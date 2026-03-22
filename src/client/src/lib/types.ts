export interface DashboardData {
  skills: { total: number; custom: number; installed: number }
  plugins: { total: number; enabled: number }
  hooks: { total: number }
  mcp_servers: { total: number }
  agents: { total: number }
  projects: { total: number }
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

export interface PluginAssets {
  skills: number
  commands: number
  agents: number
}

export interface PluginSummary {
  name: string
  description: string
  version: string
  marketplace: string
  source_type: 'official' | 'community'
  enabled: boolean
  assets: PluginAssets
}

export interface AgentSummary {
  name: string
  description: string
  model: string
  tools: string[]
  max_turns: number
}

export interface AgentDetail extends AgentSummary {
  content: string
}

export interface CommandSummary {
  name: string
  content_preview: string
  path: string
}

export interface CommandDetail {
  name: string
  content: string
  path: string
}

export interface McpServer {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface McpData {
  servers: McpServer[]
  last_mtime: number
}

export interface KeybindingsData {
  data: Record<string, string>
  last_mtime: number
}

export interface MarketplaceSource {
  name: string
  source?: { type: string; repo: string }
}

export interface MarketplacePlugin {
  name: string
  description: string
  version: string
  category: string
  marketplace: string
  installed: boolean
}

export type HookEventType =
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'PermissionRequest'
  | 'Notification'
  | 'Stop'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'PreCompact'

export interface HookCommand {
  type: 'command'
  command: string
  timeout?: number
}

export interface HookEntry {
  matcher?: string
  hooks: HookCommand[]
}

export interface HooksData {
  hooks: Record<string, HookEntry[]>
  last_mtime: number
}

export interface MemoryProject {
  encoded: string
  decoded: string
  memory_dir: string
}

export interface MemoryFileSummary {
  name: string
  size: number
}

export interface MemoryFileList {
  project: string
  files: MemoryFileSummary[]
}

export interface MemoryFileDetail {
  project: string
  file: string
  content: string
}

export interface TeamSummary {
  name: string
  path: string
}

export interface BackupEntry {
  id: string
  target_path: string
  backup_path: string
  timestamp: number
}

export interface BackupHistory {
  history: BackupEntry[]
}

export interface DiffResult {
  diff: string
  target_path: string
}

export interface DiffRequest {
  target: string
  scope: string
  content: string | Record<string, unknown>
}

export interface AnalysisItem {
  name: string
  source: string
  description?: string
  total_hits: number
  last_used: number
  project_count: number
  frequency_score: number
  recency_score: number
  versatility_score: number
  trigger_accuracy: number
  replaceability: number
  total_score: number
  ai_comment: string
}

export interface AnalysisResult {
  items: AnalysisItem[]
  total_analyzed: number
  claude_connected: boolean
  reference_url: string
  analyzed_at?: string  // "202603211130" 형식
}

export interface ClaudeStatus {
  connected: boolean
  version: string | null
}

export interface WizardResult {
  project_path: string
  tech_stack: string[]
  claude_md: string
  hooks: Array<{ event: string; command: string; reason: string }>
  mcp_suggestions: Array<{ name: string; reason: string }>
}

export interface SkillGenResult {
  questions: string[]
  skill_md: string
  name: string
}
