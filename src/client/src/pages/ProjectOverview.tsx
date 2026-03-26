import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FolderKanban, Loader2, X, Save, Star, Trash2, FlaskConical, ChevronRight, Check,
  FileText, FolderOpen, FileCode, Settings2, TestTube, BookOpen, Brain, Pencil, Shrink, FolderDot, GitBranch
} from 'lucide-react'
import { api } from '../lib/api-client'
import { useLang } from '../hooks/useLang'
import { useEscClose } from '../hooks/useEscClose'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import { CATEGORY_INFO } from '../lib/category-info'
import { SaveConfirmDialog } from '../components/shared/SaveConfirmDialog'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'

// 트리 노드 타입 정의
type FileNode = {
  name: string
  type: 'file'
  exists: boolean
  path: string
  lines?: number
  size?: number
  needs_compact?: boolean
}

type DirNode = {
  name: string
  type: 'dir'
  children?: TreeNode[]
  count?: number
  missing?: boolean
}

type TreeNode = FileNode | DirNode

type ProjectTree = {
  project_name: string
  project_path: string
  nodes: TreeNode[]
}

// 트리에서 파일 수 카운트 헬퍼
function countFiles(nodes: TreeNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.type === 'file') {
      count++
    } else if (node.type === 'dir' && node.children) {
      count += countFiles(node.children)
    }
  }
  return count
}

function countExisting(nodes: TreeNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.type === 'file' && node.exists) {
      count++
    } else if (node.type === 'dir' && node.children) {
      count += countExisting(node.children)
    }
  }
  return count
}

// 파일명에 따른 아이콘 매핑
function getFileIcon(name: string, isDir: boolean, exists: boolean) {
  if (isDir) {
    if (name.includes('memory')) return <Brain size={14} className="text-violet-400" />
    if (name.includes('docs')) return <BookOpen size={14} className="text-blue-400" />
    if (name.includes('test')) return <TestTube size={14} className="text-amber-400" />
    if (name.includes('.claude')) return <FolderDot size={14} className="text-fuchsia-400" />
    return <FolderOpen size={14} className="text-zinc-400" />
  }
  const color = exists ? 'text-zinc-300' : 'text-zinc-600'
  if (name === 'CLAUDE.md') return <Settings2 size={14} className="text-fuchsia-400" />
  if (name === 'MEMORY.md') return <Brain size={14} className="text-violet-400" />
  if (name === 'README.md') return <BookOpen size={14} className="text-blue-400" />
  if (name.endsWith('.toml') || name.endsWith('.json')) return <FileCode size={14} className={color} />
  if (name.endsWith('.md')) return <FileText size={14} className={color} />
  return <FileText size={14} className={color} />
}

// 트리 노드 단일 행 렌더링
function TreeNodeRow({
  node,
  depth,
  onEdit,
  onCompact,
  onDelete,
}: {
  node: TreeNode
  depth: number
  onEdit: (node: FileNode) => void
  onCompact: (path: string) => void
  onDelete: (node: FileNode) => void
}) {
  const isDir = node.type === 'dir'
  const isFile = node.type === 'file'

  return (
    <>
      <div
        className="group flex items-center gap-1.5 py-1.5 hover:bg-zinc-800/30 rounded px-2 transition-colors"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {/* 트리 연결선 */}
        {depth > 0 && (
          <span className="font-mono text-zinc-700 text-[11px] select-none shrink-0">├─</span>
        )}

        {/* 아이콘 */}
        <span className="shrink-0">{getFileIcon(node.name, isDir, isFile ? (node as FileNode).exists : true)}</span>

        {/* 이름 */}
        <span
          className={`font-mono text-xs ${
            isFile && (node as FileNode).exists
              ? 'text-zinc-200'
              : isFile && !(node as FileNode).exists
              ? 'text-zinc-600'
              : (node as DirNode).missing
              ? 'text-zinc-600'
              : 'text-zinc-300'
          }`}
        >
          {node.name}
        </span>

        {/* 상태 표시 */}
        {isFile && (node as FileNode).exists && (
          <span
            className={`font-mono text-[10px] ${
              (node as FileNode).needs_compact ? 'text-amber-400' : 'text-fuchsia-400'
            }`}
          >
            {(node as FileNode).needs_compact ? '⚠' : '●'} {(node as FileNode).lines}lines
          </span>
        )}
        {isFile && !(node as FileNode).exists && (
          <span className="font-mono text-[10px] text-red-400/60">✗ 없음</span>
        )}
        {isDir && (node as DirNode).count !== undefined && (
          <span className="font-mono text-[10px] text-zinc-500">{(node as DirNode).count}개</span>
        )}

        {/* 액션 버튼 — hover 시 표시 */}
        <div className="ml-auto flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {isFile && (node as FileNode).exists && (
            <button
              onClick={() => onEdit(node as FileNode)}
              className="inline-flex items-center gap-0.5 text-[10px] text-fuchsia-500 hover:text-fuchsia-400 px-1.5 py-0.5 rounded hover:bg-fuchsia-500/10 transition-colors"
            >
              <Pencil size={10} /> 편집
            </button>
          )}
          {isFile && (node as FileNode).needs_compact && (
            <button
              onClick={() => onCompact((node as FileNode).path)}
              className="inline-flex items-center gap-0.5 text-[10px] text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded hover:bg-amber-500/10 transition-colors"
            >
              <Shrink size={10} /> Compact
            </button>
          )}
          {isFile && (node as FileNode).exists && (
            <button
              onClick={() => onDelete(node as FileNode)}
              className="inline-flex items-center gap-0.5 text-[10px] text-red-500/60 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/10 transition-colors"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* 자식 노드 재귀 렌더링 */}
      {isDir &&
        (node as DirNode).children?.map((child, i) => (
          <TreeNodeRow key={i} node={child} depth={depth + 1} onEdit={onEdit} onCompact={onCompact} onDelete={onDelete} />
        ))}
    </>
  )
}

// 권한 토글 버튼 컴포넌트
function PermissionToggle({ projectPath }: { projectPath: string }) {
  const qc = useQueryClient()
  const [showConfirm, setShowConfirm] = useState(false)

  const { data } = useQuery({
    queryKey: ['permissions-status', projectPath],
    queryFn: () => api.wizard.permissionsStatus(projectPath),
    staleTime: 30_000,
  })

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => api.wizard.togglePermissions(projectPath, enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions-status', projectPath] })
      setShowConfirm(false)
    },
  })

  const allAllowed = data?.all_allowed ?? false

  const handleToggleClick = () => {
    if (allAllowed) {
      // 해제는 바로 실행
      toggleMutation.mutate(false)
    } else {
      // 활성화는 확인 팝업
      setShowConfirm(true)
    }
  }

  return (
    <div
      className="flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-[10px] text-zinc-500 font-mono">All Permissions</span>
      <button
        onClick={handleToggleClick}
        disabled={toggleMutation.isPending}
        className={`relative w-8 h-4 rounded-full transition-colors disabled:opacity-50 ${
          allAllowed ? 'bg-fuchsia-500' : 'bg-zinc-700'
        }`}
        title={allAllowed ? 'All Permissions 허용 중 (클릭으로 해제)' : 'All Permissions 해제 (클릭으로 허용)'}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
            allAllowed ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>

      {/* All Permissions 활성화 확인 팝업 */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-[420px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold text-zinc-100">All Permissions 허용</h3>
              <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
                이 프로젝트의 <code className="text-fuchsia-400 bg-zinc-800 px-1 py-0.5 rounded text-[11px]">.claude/settings.local.json</code>에
                다음 권한을 일괄 추가합니다:
              </p>
              <div className="mt-3 bg-zinc-800/60 border border-zinc-700/50 rounded-md px-3 py-2.5">
                <ul className="space-y-1">
                  {['Bash(*)', 'Read(*)', 'Edit(*)', 'Write(*)', 'WebFetch(*)', 'WebSearch'].map((p) => (
                    <li key={p} className="font-mono text-[11px] text-zinc-300 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-fuchsia-500 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-[11px] text-amber-500/80 mt-3 leading-relaxed">
                Claude Code가 이 프로젝트에서 확인 없이 모든 도구를 실행할 수 있게 됩니다.
                신뢰할 수 있는 프로젝트에서만 사용하세요.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-zinc-800">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 rounded transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => toggleMutation.mutate(true)}
                disabled={toggleMutation.isPending}
                className="px-3 py-1.5 text-xs text-white bg-fuchsia-600 hover:bg-fuchsia-500 rounded transition-colors disabled:opacity-50"
              >
                {toggleMutation.isPending ? '적용 중...' : '실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 프로젝트 카드 (아코디언)
// Inline Harness Wizard — 프로젝트 현황에서 직접 실행
// Inline Harness Wizard
type WizardPhase = 'intro' | 'files' | 'references' | 'confirm' | 'generating' | 'preview' | 'done'

// Step indicator for wizard phases
function WizardStepIndicator({ current, t }: { current: number; t: (key: string) => string }) {
  const steps = [
    { num: 1, label: 'Intro' },
    { num: 2, label: t('wizard.refFiles') },
    { num: 3, label: t('wizard.refProjects') },
    { num: 4, label: 'Confirm' },
  ]
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {steps.map((step, i) => {
        const done = step.num < current
        const active = step.num === current
        return (
          <div key={step.num} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-zinc-700 text-xs">→</span>}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              active
                ? 'bg-fuchsia-500/15 border border-fuchsia-500/30'
                : 'bg-zinc-800/60 border border-zinc-800'
            }`}>
              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                active
                  ? 'bg-fuchsia-500 text-white'
                  : done
                    ? 'bg-fuchsia-500/30 text-fuchsia-400'
                    : 'bg-zinc-700 text-zinc-400'
              }`}>
                {done ? '✓' : step.num}
              </span>
              <span className={`text-xs ${active ? 'font-medium text-fuchsia-300' : 'text-zinc-500'}`}>
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function getGenerateMessages(t: (key: string) => string): string[] {
  return [
    t('wizard.gen1'),
    t('wizard.gen2'),
    t('wizard.gen3'),
    t('wizard.gen4'),
    t('wizard.gen5'),
    t('wizard.gen6'),
    t('wizard.gen7'),
  ]
}

function InlineWizardModal({
  projectPath,
  projectName,
  allProjects,
  onClose,
  onApplied,
}: {
  projectPath: string
  projectName: string
  allProjects: ProjectTree[]
  onClose: () => void
  onApplied: () => void
}) {
  const { t } = useLang()
  useEscClose(onClose)
  const GENERATE_MESSAGES = getGenerateMessages(t)
  const [phase, setPhase] = useState<WizardPhase>('intro')
  const [referenceProjects, setReferenceProjects] = useState<string[]>([])
  const [result, setResult] = useState<{
    tech_stack: string[]
    claude_md: string
    hooks: Array<{ event: string; command: string; reason: string; matcher?: string }>
    mcp_suggestions: Array<{ name: string; reason: string }> | Record<string, unknown>
    project_settings: Record<string, unknown> | null
    memory_files: Record<string, string> | null
    skills: Array<{ name: string; description: string; content: string }>
    agents: Array<{ name: string; description: string; model: string; tools: string; content: string }>
    commands: Array<{ name: string; content: string }>
  } | null>(null)
  const [previewFile, setPreviewFile] = useState<string | null>(null)
  const [editedClaudeMd, setEditedClaudeMd] = useState('')
  const [selectedHooks, setSelectedHooks] = useState<Set<number>>(new Set())
  // 파일 제외 기능: 체크된 항목만 반영
  const [enabledSections, setEnabledSections] = useState<Set<string>>(
    new Set(['claude_md', 'hooks', 'project_settings', 'memory_files', 'skills', 'agents', 'commands', 'mcp_servers'])
  )
  const toggleSection = (key: string) => {
    setEnabledSections((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  const [error, setError] = useState('')
  const [genStep, setGenStep] = useState(0)
  const [genMsg, setGenMsg] = useState(GENERATE_MESSAGES[0])

  // 프로젝트의 Reference Files 목록
  const contextFiles = [
    { category: 'Project Files', items: [
      { name: 'README.md', icon: '📖' },
      { name: 'pyproject.toml / package.json', icon: '📦' },
      { name: 'Directory structure', icon: '📁' },
    ]},
    { category: 'Global Claude Settings', items: [
      { name: '~/.claude/CLAUDE.md', icon: '📝' },
      { name: '~/.claude/settings.json', icon: '⚙️' },
    ]},
    { category: 'Existing Project Settings', items: [
      { name: `${projectName}/CLAUDE.md (existing)`, icon: '📄' },
      { name: `${projectName}/.claude/memory/`, icon: '🧠' },
    ]},
  ]

  const toggleRef = (path: string) => {
    setReferenceProjects((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    )
  }

  const startGenerate = async () => {
    setPhase('generating')
    setGenStep(0)
    setGenMsg(GENERATE_MESSAGES[0])

    const msgTimer = setInterval(() => {
      setGenStep((s) => {
        const next = Math.min(s + 1, GENERATE_MESSAGES.length - 1)
        setGenMsg(GENERATE_MESSAGES[next])
        return next
      })
    }, 2000)

    try {
      const resp = await fetch('/api/wizard/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_path: projectPath, reference_projects: referenceProjects }),
      })
      const data = await resp.json()
      clearInterval(msgTimer)
      setResult(data)
      setEditedClaudeMd(data.claude_md || '')
      setSelectedHooks(new Set(data.hooks?.map((_: unknown, i: number) => i) ?? []))
      setPhase('preview')
    } catch {
      clearInterval(msgTimer)
      setError(t('wizard.analyzeFailed'))
      setPhase('files')
    }
  }

  const applyResult = async () => {
    if (!result) return
    try {
      const body: Record<string, unknown> = { project_path: projectPath }
      if (enabledSections.has('claude_md')) body.claude_md = editedClaudeMd
      if (enabledSections.has('hooks')) body.hooks = result.hooks.filter((_, i) => selectedHooks.has(i))
      if (enabledSections.has('project_settings') && result.project_settings) body.project_settings = result.project_settings
      if (enabledSections.has('memory_files') && result.memory_files) body.memory_files = result.memory_files
      if (enabledSections.has('skills') && result.skills?.length) body.skills = result.skills
      if (enabledSections.has('agents') && result.agents?.length) body.agents = result.agents
      if (enabledSections.has('commands') && result.commands?.length) body.commands = result.commands
      if (enabledSections.has('mcp_servers') && result.mcp_suggestions && !Array.isArray(result.mcp_suggestions)) body.mcp_servers = result.mcp_suggestions
      await fetch('/api/wizard/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setPhase('done')
      onApplied()
    } catch {
      setError(t('wizard.applyFailed'))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[720px] max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <FlaskConical size={15} className="text-fuchsia-400" />
            <span className="text-sm font-semibold text-zinc-100">Harness Wizard</span>
            <span className="font-mono text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">{projectName}</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col min-h-0">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 rounded px-3 py-2 mb-4">
              <span>{error}</span>
              <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-300"><X size={12} /></button>
            </div>
          )}

          {/* Step 0: Intro */}
          {phase === 'intro' && (
            <div className="space-y-5">
              <WizardStepIndicator current={1} t={t} />

              {/* Hero section */}
              <div className="text-center pt-2 pb-1">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 mb-4">
                  <FlaskConical size={28} className="text-fuchsia-400" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-1.5">{t('wizard.introTitle')}</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                  {t('wizard.introDesc')}
                </p>
              </div>

              {/* Official badge */}
              <div className="bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-lg px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm">🏛️</span>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-200 font-medium mb-0.5">
                      {t('wizard.introOfficialTitle')}
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {t('wizard.introOfficialDesc')}{' '}
                      <a href="https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview" target="_blank" rel="noopener noreferrer"
                        className="text-fuchsia-400 underline hover:text-fuchsia-300">
                        Official Guide →
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Generated items preview */}
              <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-4">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-3">{t('wizard.introGenItems')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: '📝', label: 'CLAUDE.md', desc: t('wizard.introItemClaudeMd') },
                    { icon: '🔗', label: 'Hooks', desc: t('wizard.introItemHooks') },
                    { icon: '⚙️', label: 'Permissions', desc: t('wizard.introItemPermissions') },
                    { icon: '🧠', label: 'Memory', desc: t('wizard.introItemMemory') },
                    { icon: '⚡', label: 'Skills', desc: t('wizard.introItemSkills') },
                    { icon: '🤖', label: 'Agents', desc: t('wizard.introItemAgents') },
                    { icon: '📋', label: 'Commands', desc: t('wizard.introItemCommands') },
                    { icon: '🔌', label: 'MCP Servers', desc: t('wizard.introItemMcp') },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-zinc-900/60 border border-zinc-800/60">
                      <span className="text-base shrink-0">{item.icon}</span>
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-zinc-300">{item.label}</p>
                        <p className="text-[9px] text-zinc-600 truncate">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flow diagram */}
              <div className="flex items-center justify-center gap-2 py-2">
                {[
                  { icon: '📂', label: t('wizard.introFlowAnalyze') },
                  { icon: '🤖', label: t('wizard.introFlowGenerate') },
                  { icon: '👀', label: t('wizard.introFlowPreview') },
                  { icon: '✅', label: t('wizard.introFlowApply') },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2">
                    {i > 0 && <span className="text-zinc-700 text-xs">→</span>}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">{step.icon}</span>
                      <span className="text-[9px] text-zinc-500 font-mono">{step.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2.5 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-md transition-colors">
                  {t('wizard.cancel')}
                </button>
                <button
                  onClick={() => setPhase('files')}
                  className="flex-1 py-2.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-medium rounded-md transition-colors"
                >
                  {t('wizard.introStart')} →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Reference Files 확인 */}
          {phase === 'files' && (
            <div className="flex flex-col h-full">
              <div className="shrink-0 mb-4">
                <WizardStepIndicator current={2} t={t} />
              </div>

              <div className="shrink-0 mb-2">
                <h3 className="text-sm font-medium text-zinc-200 mb-1">{t('wizard.refFiles')}</h3>
                <p className="text-[10px] text-zinc-500">
                  {t('wizard.refFilesDesc')}
                </p>
              </div>

              {/* Scrollable file list */}
              <div className="flex-1 min-h-0 overflow-y-auto border border-zinc-800 rounded-lg bg-zinc-800/20 p-3 mb-4">
                <div className="space-y-3">
                  {contextFiles.map((cat) => (
                    <div key={cat.category}>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">{cat.category}</p>
                      <div className="space-y-0.5">
                        {cat.items.map((item) => (
                          <div key={item.name} className="flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-zinc-900/60 border border-zinc-800/60">
                            <span className="text-sm">{item.icon}</span>
                            <span className="font-mono text-[11px] text-zinc-300">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button onClick={() => setPhase('intro')} className="flex-1 py-2.5 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-md transition-colors">
                  ← Back
                </button>
                <button
                  onClick={() => setPhase('references')}
                  className="flex-1 py-2.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-medium rounded-md transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Reference Projects 선택 */}
          {phase === 'references' && (
            <div className="space-y-5">
              <WizardStepIndicator current={3} t={t} />

              <div>
                <h3 className="text-sm font-medium text-zinc-200 mb-2">{t('wizard.refProjects')}</h3>
                <div className="bg-amber-500/8 border border-amber-500/25 rounded-lg px-4 py-3 mb-4">
                  <p className="text-xs text-amber-200/90 leading-relaxed mb-1">
                    {t('wizard.refProjectsDesc')}
                  </p>
                  <p className="text-[11px] text-amber-300/60 leading-relaxed">
                    {t('wizard.refProjectsDetail')}
                  </p>
                </div>

                {allProjects.filter((p) => p.project_path !== projectPath).length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-600">No other projects available.</div>
                ) : (
                  <div className="space-y-1 max-h-[280px] overflow-y-auto">
                    {allProjects.filter((p) => p.project_path !== projectPath).map((p) => {
                      const checked = referenceProjects.includes(p.project_path)
                      const fileCount = countFiles(p.nodes)
                      return (
                        <label key={p.project_path} className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all ${
                          checked ? 'bg-fuchsia-500/8 border border-fuchsia-500/25' : 'bg-zinc-800/30 border border-transparent hover:bg-zinc-800/60'
                        }`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRef(p.project_path)}
                            className="accent-fuchsia-500"
                          />
                          <div className="flex-1 min-w-0">
                            <span className={`font-mono text-xs font-medium ${checked ? 'text-fuchsia-300' : 'text-zinc-300'}`}>
                              {p.project_name}
                            </span>
                            <p className="font-mono text-[10px] text-zinc-600 mt-0.5">{fileCount} files</p>
                          </div>
                          {checked && (
                            <span className="text-[9px] font-mono text-fuchsia-400/60 shrink-0">Referenced</span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                )}

                {referenceProjects.length > 0 && (
                  <div className="mt-3 px-3 py-2 bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-md">
                    <p className="text-[10px] text-fuchsia-400">
                      {referenceProjects.length}{t('wizard.refCount')}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setPhase('files')} className="flex-1 py-2.5 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-md transition-colors">
                  ← Back
                </button>
                <button
                  onClick={() => setPhase('confirm')}
                  className="flex-1 py-2.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-medium rounded-md transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: 최종 확인 */}
          {phase === 'confirm' && (
            <div className="space-y-5">
              <WizardStepIndicator current={4} t={t} />

              {/* 요약 */}
              <div className="space-y-3">
                <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-200 mb-3">Generation Summary</h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                      <span className="text-zinc-400">Target Project</span>
                      <span className="font-mono text-zinc-200">{projectName}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                      <span className="text-zinc-400">Reference Files</span>
                      <span className="font-mono text-zinc-200">{contextFiles.reduce((s, c) => s + c.items.length, 0)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                      <span className="text-zinc-400">Reference Projects</span>
                      <span className="font-mono text-zinc-200">{referenceProjects.length}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-zinc-400">Files to Generate</span>
                      <span className="font-mono text-zinc-200">CLAUDE.md, Hooks, Memory</span>
                    </div>
                  </div>
                </div>

                <div className="bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-lg px-4 py-3">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {t('wizard.confirmMsg').replace('{project}', projectName)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setPhase('references')} className="flex-1 py-2.5 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-md transition-colors">
                  ← Back
                </button>
                <button
                  onClick={startGenerate}
                  className="flex-1 py-2.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-medium rounded-md transition-colors"
                >
                  {t('wizard.confirmProceed')}
                </button>
              </div>
            </div>
          )}

          {/* Phase 2: 생성 중 */}
          {phase === 'generating' && (
            <div className="py-10 flex flex-col items-center">
              {/* 로딩 애니메이션 */}
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
                <div className="absolute inset-0 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin" />
                <FlaskConical size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-fuchsia-400" />
              </div>

              {/* 진행 메시지 */}
              <p className="text-sm text-zinc-200 mb-2 animate-fade-in" key={genStep}>{genMsg}</p>
              <p className="text-[10px] text-zinc-600 mb-6">{t('wizard.genSubMsg')}</p>

              {/* 프로그레스 바 */}
              <div className="w-64 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-fuchsia-500 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(((genStep + 1) / GENERATE_MESSAGES.length) * 100, 95)}%` }}
                />
              </div>

              {/* 진행 단계 */}
              <div className="mt-6 space-y-1.5 w-full max-w-xs">
                {GENERATE_MESSAGES.slice(0, genStep + 1).map((msg, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      i < genStep ? 'bg-fuchsia-500/20' : 'bg-fuchsia-500/10'
                    }`}>
                      {i < genStep ? (
                        <Check size={8} className="text-fuchsia-400" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
                      )}
                    </div>
                    <span className={`text-[10px] ${i < genStep ? 'text-zinc-500' : 'text-zinc-300'}`}>
                      {msg.replace('...', '')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase 3: 결과 미리보기 */}
          {phase === 'preview' && result && (() => {
            // 파일 트리 항목 구성
            const fileTree: Array<{ key: string; icon: string; label: string; detail: string; hasContent: boolean }> = [
              { key: 'claude_md', icon: '📝', label: 'CLAUDE.md', detail: `${editedClaudeMd.split('\n').length} lines`, hasContent: true },
            ]
            if (result.project_settings) fileTree.push({ key: 'project_settings', icon: '⚙️', label: '.claude/settings.json', detail: 'permissions + hooks', hasContent: true })
            if (result.hooks.length > 0) fileTree.push({ key: 'hooks', icon: '🔗', label: 'Hooks', detail: `${result.hooks.length} events`, hasContent: true })
            if (result.memory_files && Object.keys(result.memory_files).length > 0) fileTree.push({ key: 'memory_files', icon: '🧠', label: 'memory/', detail: Object.keys(result.memory_files).join(', '), hasContent: false })
            if (result.skills?.length) fileTree.push({ key: 'skills', icon: '⚡', label: '.claude/skills/', detail: result.skills.map((s) => s.name).join(', '), hasContent: true })
            if (result.agents?.length) fileTree.push({ key: 'agents', icon: '🤖', label: '.claude/agents/', detail: result.agents.map((a) => a.name).join(', '), hasContent: true })
            if (result.commands?.length) fileTree.push({ key: 'commands', icon: '📋', label: '.claude/commands/', detail: result.commands.map((c) => c.name).join(', '), hasContent: false })
            if (result.mcp_suggestions && !Array.isArray(result.mcp_suggestions) && Object.keys(result.mcp_suggestions).length > 0) {
              fileTree.push({ key: 'mcp_servers', icon: '🔌', label: 'MCP Servers', detail: Object.keys(result.mcp_suggestions).join(', '), hasContent: false })
            }

            return (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Check size={14} className="text-fuchsia-400" />
                  <span className="text-sm font-medium text-zinc-200">{t('wizard.genDone')}</span>
                  {result.tech_stack.length > 0 && (
                    <div className="flex gap-1 ml-2">
                      {result.tech_stack.map((tech) => (
                        <span key={tech} className="px-1.5 py-0.5 text-[9px] font-mono bg-fuchsia-500/10 text-fuchsia-400 rounded">{tech}</span>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-zinc-500">체크를 해제하면 해당 항목은 반영에서 제외됩니다.</p>

                {/* 풀 하네스 파일 트리 */}
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-md overflow-hidden divide-y divide-zinc-700/30">
                  {fileTree.map((item) => (
                    <div key={item.key}>
                      <div className="flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-zinc-700/20 transition-colors">
                        <input
                          type="checkbox"
                          checked={enabledSections.has(item.key)}
                          onChange={() => toggleSection(item.key)}
                          className="accent-fuchsia-500"
                        />
                        <span className="text-base">{item.icon}</span>
                        <button
                          onClick={() => item.hasContent && setPreviewFile(previewFile === item.key ? null : item.key)}
                          className="flex-1 flex items-center justify-between min-w-0"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`font-mono ${enabledSections.has(item.key) ? 'text-zinc-200' : 'text-zinc-600 line-through'}`}>{item.label}</span>
                            <span className="text-[10px] text-zinc-500 truncate">{item.detail}</span>
                          </div>
                          {item.hasContent && <ChevronRight size={12} className={`text-zinc-600 transition-transform shrink-0 ${previewFile === item.key ? 'rotate-90' : ''}`} />}
                        </button>
                      </div>

                      {/* 내용 미리보기 */}
                      {previewFile === 'claude_md' && item.key === 'claude_md' && (
                        <div className="border-t border-zinc-700/50">
                          <MonacoWrapper value={editedClaudeMd} onChange={setEditedClaudeMd} height="250px" />
                        </div>
                      )}
                      {previewFile === 'project_settings' && item.key === 'project_settings' && result.project_settings && (
                        <div className="border-t border-zinc-700/50 p-3">
                          <pre className="font-mono text-[10px] text-zinc-400 whitespace-pre-wrap">{JSON.stringify(result.project_settings, null, 2)}</pre>
                        </div>
                      )}
                      {previewFile === 'hooks' && item.key === 'hooks' && (
                        <div className="border-t border-zinc-700/50 p-3 space-y-1">
                          {result.hooks.map((h, i) => (
                            <label key={i} className={`flex items-start gap-2 p-2 rounded cursor-pointer ${selectedHooks.has(i) ? 'bg-fuchsia-500/5' : 'bg-zinc-800/50'}`}>
                              <input type="checkbox" checked={selectedHooks.has(i)}
                                onChange={() => setSelectedHooks((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })}
                                className="accent-fuchsia-500 mt-0.5" />
                              <div>
                                <span className="font-mono text-[10px] text-amber-400">{h.event}{h.matcher ? ` (${h.matcher})` : ''}</span>
                                <p className="font-mono text-[10px] text-zinc-400">{h.command}</p>
                                {h.reason && <p className="text-[9px] text-zinc-600">{h.reason}</p>}
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                      {previewFile === 'skills' && item.key === 'skills' && result.skills?.map((s, i) => (
                        <div key={i} className="border-t border-zinc-700/50 p-3">
                          <p className="font-mono text-[10px] text-fuchsia-400 mb-1">{s.name}</p>
                          <pre className="font-mono text-[10px] text-zinc-400 whitespace-pre-wrap max-h-40 overflow-y-auto">{s.content}</pre>
                        </div>
                      ))}
                      {previewFile === 'agents' && item.key === 'agents' && result.agents?.map((a, i) => (
                        <div key={i} className="border-t border-zinc-700/50 p-3">
                          <p className="font-mono text-[10px] text-violet-400 mb-1">{a.name} ({a.model})</p>
                          <pre className="font-mono text-[10px] text-zinc-400 whitespace-pre-wrap max-h-40 overflow-y-auto">{a.content}</pre>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-md px-4 py-3">
                  <p className="text-xs text-zinc-300">
                    선택된 {enabledSections.size}개 항목을 <span className="text-fuchsia-400 font-medium">{projectName}</span> 프로젝트에 반영하시겠습니까?
                  </p>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setPhase('files')} className="flex-1 py-2 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-md transition-colors">
                    {t('wizard.reanalyze')}
                  </button>
                  <button onClick={applyResult} className="flex-1 py-2 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-medium rounded-md transition-colors">
                    {t('wizard.applyNow')}
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Phase 4: 완료 */}
          {phase === 'done' && (
            <div className="py-12 text-center">
              <div className="w-14 h-14 bg-fuchsia-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={24} className="text-fuchsia-400" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-100 mb-1">반영 완료</h3>
              <p className="text-xs text-zinc-500 mb-6">{projectName} 프로젝트에 harness 설정이 적용되었습니다.</p>
              <button onClick={onClose} className="px-6 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors">닫기</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 파일 편집 모달 (기존 로직 유지, FileNode 타입 적용)
function FileEditorModal({
  filePath,
  fileName,
  onClose,
}: {
  filePath: string
  fileName: string
  onClose: () => void
}) {
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)

  const loadFile = async (path: string) => {
    setLoading(true)
    setSaved(false)
    try {
      const resp = await fetch('/api/file/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      if (resp.ok) {
        const data = await resp.json()
        const loaded = data.content || ''
        setContent(loaded)
        setOriginalContent(loaded)
      } else {
        setContent('(파일을 읽을 수 없습니다)')
        setOriginalContent('')
      }
    } catch {
      setContent('(파일을 읽을 수 없습니다)')
      setOriginalContent('')
    }
    setLoading(false)
  }

  const saveFile = async () => {
    setSaving(true)
    try {
      await fetch('/api/file/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      })
      setOriginalContent(content)
      setSaved(true)
      setShowSaveConfirm(false)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // ignore
    }
    setSaving(false)
  }

  // 초기 로드
  useEffect(() => {
    loadFile(filePath)
  }, [filePath])

  const language = filePath.endsWith('.json')
    ? 'json'
    : filePath.endsWith('.toml')
    ? 'toml'
    : 'markdown'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[900px] max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-fuchsia-400">{fileName}</span>
              <span className="font-mono text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                편집 중
              </span>
            </div>
            <span className="font-mono text-[10px] text-zinc-600 truncate max-w-[500px]" title={filePath}>
              {filePath}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saved && <span className="text-[10px] text-fuchsia-400">저장됨</span>}
            <button
              onClick={() => setShowSaveConfirm(true)}
              disabled={saving || loading}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors disabled:opacity-50"
            >
              <Save size={12} />
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 에디터 */}
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={16} className="text-zinc-600 animate-spin" />
            </div>
          ) : (
            <MonacoWrapper value={content} onChange={setContent} language={language} height="60vh" />
          )}
        </div>
      </div>

      {showSaveConfirm && (
        <SaveConfirmDialog
          oldContent={originalContent}
          newContent={content}
          fileName={filePath.split('/').pop() ?? filePath}
          onConfirm={saveFile}
          onCancel={() => setShowSaveConfirm(false)}
          saving={saving}
        />
      )}
    </div>
  )
}

export default function ProjectOverview() {
  const { t } = useLang()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // 편집 모달 상태
  const [editingNode, setEditingNode] = useState<FileNode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(searchParams.get('select'))
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<{ name: string; encoded: string } | null>(null)
  const [showWizard, setShowWizard] = useState(searchParams.get('wizard') === '1')

  // URL 파라미터 소비 후 정리
  useEffect(() => {
    if (searchParams.has('select') || searchParams.has('wizard')) {
      setSearchParams({}, { replace: true })
    }
  }, [])

  // 즐겨찾기 (localStorage 기반)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('claude-hub-favorite-projects')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch { return new Set() }
  })
  const toggleFavorite = (path: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      localStorage.setItem('claude-hub-favorite-projects', JSON.stringify([...next]))
      return next
    })
  }

  // 프로젝트 삭제 뮤테이션
  const deleteProjectMutation = useMutation({
    mutationFn: (encoded: string) => api.wizard.deleteProject(encoded),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-trees'] })
      queryClient.invalidateQueries({ queryKey: ['projects-grouped'] })
      setDeleteProjectTarget(null)
      setSelectedPath(null)
    },
  })

  // compact 상태: 로딩 중인 경로, 결과 다이얼로그 표시용
  const [compactingPath, setCompactingPath] = useState<string | null>(null)
  const [compactResult, setCompactResult] = useState<{
    original_lines: number
    compacted: string
    compacted_lines: number
    path: string
    originalContent: string
  } | null>(null)
  const [savingCompact, setSavingCompact] = useState(false)

  // 그룹화된 프로젝트 정보 (워크트리 감지용)
  const { data: groupedProjects = [] } = useQuery({
    queryKey: ['projects-grouped'],
    queryFn: () => api.wizard.projectsGrouped(),
    staleTime: 60_000,
  })

  // 단일 API로 모든 프로젝트 트리 조회
  const { data: projects = [], isLoading, isError } = useQuery<ProjectTree[]>({
    queryKey: ['project-trees'],
    queryFn: async () => {
      const trees = (await api.wizard.projectTreesAll()) as (ProjectTree | null)[]
      return trees.filter(Boolean) as ProjectTree[]
    },
    staleTime: 30_000,
  })

  // 워크트리 경로 집합 — 빠른 조회용
  const worktreePaths = new Set<string>(
    groupedProjects.flatMap((g) => g.worktrees.map((w) => w.decoded))
  )

  // compact 뮤테이션
  const compactMutation = useMutation({
    mutationFn: async (path: string) => {
      // 원본 내용 먼저 읽기
      const readResp = await fetch('/api/file/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      const readData = await readResp.json()
      const originalContent = readData.content || ''

      const result = await api.wizard.compact(path)
      return { ...result, originalContent }
    },
    onMutate: (path) => {
      setCompactingPath(path)
    },
    onSuccess: (data) => {
      setCompactingPath(null)
      setCompactResult(data)
    },
    onError: () => {
      setCompactingPath(null)
    },
  })

  const handleCompact = (path: string) => {
    compactMutation.mutate(path)
  }

  const handleSaveCompact = async () => {
    if (!compactResult) return
    setSavingCompact(true)
    try {
      await fetch('/api/file/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: compactResult.path, content: compactResult.compacted }),
      })
      setCompactResult(null)
    } catch {
      // ignore
    }
    setSavingCompact(false)
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FolderKanban size={16} className="text-fuchsia-400" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
            {t('projects.title')}
          </h2>
          <InfoTooltip
            title={CATEGORY_INFO.projects.title}
            description={CATEGORY_INFO.projects.description}
            detail={CATEGORY_INFO.projects.detail}
          />
        </div>
        <p className="text-xs text-zinc-500">{t('projects.subtitle')}</p>
        <p className="mt-2 text-[11px] text-zinc-600 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 inline-block">
          {t('criteria.projectStatus')}
        </p>
      </div>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs py-8">
          <Loader2 size={14} className="animate-spin" />
          <span>불러오는 중...</span>
        </div>
      )}

      {/* 에러 상태 */}
      {isError && (
        <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">
          데이터를 불러오지 못했습니다.
        </p>
      )}

      {/* 데이터 없음 */}
      {!isLoading && !isError && projects.length === 0 && (
        <p className="text-xs text-zinc-500 py-8">
          등록된 프로젝트가 없습니다. (~/.claude/projects/ 에 memory 디렉토리가 있는 프로젝트를 추가하세요)
        </p>
      )}

      {/* compact 진행 중 오버레이 */}
      {compactingPath && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-zinc-900 border border-zinc-800 rounded-md px-6 py-4 flex items-center gap-3">
            <Loader2 size={16} className="text-amber-400 animate-spin" />
            <span className="text-sm text-zinc-300">{t('projects.compacting')}</span>
          </div>
        </div>
      )}

      {/* 좌우 분할: 왼쪽 프로젝트 목록 + 오른쪽 트리 뷰 */}
      {projects.length > 0 && (() => {
        // 원본 프로젝트만 추출 (워크트리 제외)
        const mainProjects = projects.filter((p) => !worktreePaths.has(p.project_path))
        const activeProject = selectedPath
          ? projects.find((p) => p.project_path === selectedPath) ?? mainProjects[0]
          : mainProjects[0]
        const activeGroup = activeProject
          ? groupedProjects.find((g) => g.path === activeProject.project_path)
          : null
        const activeWorktrees = activeGroup
          ? activeGroup.worktrees
              .map((w) => projects.find((p) => p.project_path === w.decoded))
              .filter(Boolean) as ProjectTree[]
          : []

        return (
          <div className="flex gap-4 h-[calc(100vh-220px)]">
            {/* 왼쪽: 프로젝트 목록 (즐겨찾기 상단 고정) */}
            <div className="w-64 shrink-0 bg-zinc-900 border border-zinc-800 rounded-md flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-800">
                <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-wider">
                  Projects ({mainProjects.length})
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {(() => {
                  const favProjects = mainProjects.filter((p) => favorites.has(p.project_path))
                  const otherProjects = mainProjects.filter((p) => !favorites.has(p.project_path))

                  const renderItem = (p: ProjectTree) => {
                    const isActive = activeProject?.project_path === p.project_path
                    const isFav = favorites.has(p.project_path)
                    const group = groupedProjects.find((g) => g.path === p.project_path)
                    const wtCount = group?.worktrees.length ?? 0
                    const existing = countExisting(p.nodes)
                    const total = countFiles(p.nodes)
                    // encoded name 추출
                    const encoded = groupedProjects.find((g) => g.path === p.project_path)?.main?.encoded
                      ?? p.project_path.replace(/\//g, '-').replace(/^-/, '-')

                    return (
                      <div
                        key={p.project_path}
                        className={`flex items-center gap-1 border-b border-zinc-800/40 transition-colors group ${
                          isActive
                            ? 'bg-zinc-800/60 border-l-2 border-l-fuchsia-500'
                            : 'border-l-2 border-l-transparent hover:bg-zinc-800/30'
                        }`}
                      >
                        <button
                          onClick={() => setSelectedPath(p.project_path)}
                          className="flex-1 text-left px-3 py-2.5 min-w-0"
                        >
                          <p className="font-mono text-xs text-zinc-200 truncate font-medium">
                            {isFav && <Star size={10} className="inline text-amber-400 mr-1 -mt-0.5" fill="currentColor" />}
                            {p.project_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[10px] text-fuchsia-400/80">{existing}/{total}</span>
                            {wtCount > 0 && (
                              <span className="font-mono text-[10px] text-zinc-600 flex items-center gap-0.5">
                                <GitBranch size={9} /> {wtCount}
                              </span>
                            )}
                          </div>
                        </button>
                        <div className="flex flex-col gap-0.5 pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(p.project_path) }}
                            className="p-0.5 text-zinc-600 hover:text-amber-400 transition-colors"
                            title={isFav ? '즐겨찾기 해제' : '즐겨찾기'}
                          >
                            <Star size={11} fill={isFav ? 'currentColor' : 'none'} className={isFav ? 'text-amber-400' : ''} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteProjectTarget({ name: p.project_name, encoded: encoded ?? '' }) }}
                            className="p-0.5 text-zinc-600 hover:text-red-400 transition-colors"
                            title="프로젝트 제거"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <>
                      {favProjects.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 bg-zinc-800/30">
                            <span className="font-mono text-[9px] text-amber-400/70 uppercase tracking-widest flex items-center gap-1">
                              <Star size={8} fill="currentColor" /> Favorites
                            </span>
                          </div>
                          {favProjects.map(renderItem)}
                        </>
                      )}
                      {otherProjects.length > 0 && (
                        <>
                          {favProjects.length > 0 && (
                            <div className="px-3 py-1.5 bg-zinc-800/30">
                              <span className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest">Others</span>
                            </div>
                          )}
                          {otherProjects.map(renderItem)}
                        </>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Harness Wizard 카드 */}
              {activeProject && (
                <div className="px-3 py-3 border-t border-zinc-800 shrink-0">
                  <button
                    onClick={() => setShowWizard(true)}
                    className="w-full bg-gradient-to-r from-fuchsia-500/8 to-violet-500/8 border border-fuchsia-500/25 rounded-lg p-3 hover:from-fuchsia-500/15 hover:to-violet-500/15 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <FlaskConical size={15} className="text-fuchsia-400" />
                      <span className="text-xs font-semibold text-zinc-200">Harness Wizard</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed mb-2">
                      {t('wizard.quickDesc')}
                    </p>
                    <div className="flex items-center gap-2 text-[9px] text-zinc-600">
                      <span>📝</span><span>⚙️</span><span>🧠</span><span>⚡</span><span>🤖</span><span>🔌</span>
                      <span className="ml-auto text-fuchsia-400/60">Official Guide →</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 오른쪽: 선택된 프로젝트 트리 (원본 + 워크트리 구분) */}
            <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md flex flex-col overflow-hidden">
              {activeProject ? (
                <>
                  {/* 헤더 */}
                  <div className="px-4 py-2.5 border-b border-zinc-800 shrink-0 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-zinc-100 font-medium">{activeProject.project_name}</p>
                      <p className="font-mono text-[10px] text-zinc-600 truncate">{activeProject.project_path}</p>
                    </div>
                    <PermissionToggle projectPath={activeProject.project_path} />
                  </div>

                  {/* CLAUDE.md가 없는 프로젝트 → Wizard 추천 배너 */}
                  {activeProject.nodes.every((n) => !(n.type === 'file' && n.name === 'CLAUDE.md' && n.exists)) &&
                   !localStorage.getItem(`wizard-dismissed-${activeProject.project_path}`) && (
                    <div className="mx-3 mt-3 mb-2 bg-gradient-to-r from-fuchsia-500/10 to-violet-500/10 border border-fuchsia-500/25 rounded-lg p-4 relative">
                      <button
                        onClick={() => {
                          localStorage.setItem(`wizard-dismissed-${activeProject.project_path}`, '1')
                          // force re-render
                          setSelectedPath(activeProject.project_path)
                        }}
                        className="absolute top-2 right-2 text-zinc-600 hover:text-zinc-400 text-xs"
                      >
                        ✕
                      </button>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-fuchsia-500/15 rounded-lg flex items-center justify-center shrink-0">
                          <FlaskConical size={20} className="text-fuchsia-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-100 mb-1">
                            {t('projects.noClaudeMd')}
                          </p>
                          <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                            Harness Wizard가{' '}
                            <a href="https://code.claude.com/docs/en/best-practices" target="_blank" rel="noopener noreferrer" className="text-fuchsia-400 underline">
                              Anthropic official guide
                            </a>
                            {' '}기반으로 최적의 설정을 AI로 생성합니다.
                          </p>
                          <div className="flex items-center gap-3 mb-3 text-[10px] text-zinc-500">
                            <span>📝 CLAUDE.md</span>
                            <span>⚙️ Hooks</span>
                            <span>🧠 Memory</span>
                            <span>⚡ Skills</span>
                            <span>🤖 Agents</span>
                            <span>🔌 MCP</span>
                          </div>
                          <button
                            onClick={() => setShowWizard(true)}
                            className="px-4 py-2 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-medium rounded-md transition-colors"
                          >
                            {t('projects.runWizard')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 워크트리가 있으면 섹션 목차(TOC) 표시 */}
                  {activeWorktrees.length > 0 && (
                    <div className="px-4 py-2 border-b border-zinc-800 shrink-0 bg-zinc-900/80">
                      <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
                        {/* Main */}
                        <button
                          onClick={() => document.getElementById('section-main')?.scrollIntoView({ behavior: 'smooth' })}
                          className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono text-fuchsia-400 hover:text-fuchsia-300 transition-colors"
                        >
                          <FolderKanban size={11} />
                          <span className="font-medium">main</span>
                        </button>

                        <span className="text-zinc-700 text-[10px]">/</span>

                        {/* 각 워크트리 개별 표시 */}
                        {activeWorktrees.map((wt, idx) => (
                          <span key={wt.project_path} className="flex items-center gap-1.5 shrink-0">
                            {idx > 0 && <span className="text-zinc-800 text-[10px]">·</span>}
                            <button
                              onClick={() => document.getElementById(`section-wt-${idx}`)?.scrollIntoView({ behavior: 'smooth' })}
                              className="flex items-center gap-1 text-[11px] font-mono text-amber-400/80 hover:text-amber-300 transition-colors"
                            >
                              <GitBranch size={10} />
                              {wt.project_name}
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 트리 본문 — 스크롤 */}
                  <div className="flex-1 overflow-y-auto px-2 py-2">
                    {/* 원본 레포 섹션 */}
                    <div id="section-main" className="mb-3">
                      <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                        <FolderKanban size={12} className="text-fuchsia-400" />
                        <span className="font-mono text-[11px] text-fuchsia-400 font-medium">Main Repository</span>
                        <span className="font-mono text-[10px] text-zinc-600">
                          {countExisting(activeProject.nodes)}/{countFiles(activeProject.nodes)} files
                        </span>
                      </div>
                      <div className="border-l-2 border-fuchsia-500/30 ml-3">
                        {activeProject.nodes.map((node, i) => (
                          <TreeNodeRow key={i} node={node} depth={0} onEdit={setEditingNode} onCompact={handleCompact} onDelete={(node) => setDeleteTarget(node)} />
                        ))}
                      </div>
                    </div>

                    {/* 워크트리 섹션 */}
                    {activeWorktrees.length > 0 && (
                      <div id="section-worktrees" className="mt-4 pt-3 border-t border-zinc-800/50">
                        <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                          <GitBranch size={12} className="text-amber-400" />
                          <span className="font-mono text-[11px] text-amber-400 font-medium">Worktrees</span>
                          <span className="font-mono text-[10px] text-zinc-600">{activeWorktrees.length}</span>
                        </div>
                        {activeWorktrees.map((wt, wtIdx) => (
                          <div key={wt.project_path} id={`section-wt-${wtIdx}`} className="mb-3">
                            <div className="flex items-center gap-2 px-2 py-1 ml-3">
                              <GitBranch size={10} className="text-zinc-500" />
                              <span className="font-mono text-xs text-zinc-300">{wt.project_name}</span>
                              <span className="font-mono text-[10px] text-zinc-600">
                                {countExisting(wt.nodes)}/{countFiles(wt.nodes)} files
                              </span>
                            </div>
                            <div className="border-l-2 border-amber-500/20 ml-3">
                              {wt.nodes.map((node, i) => (
                                <TreeNodeRow key={i} node={node} depth={0} onEdit={setEditingNode} onCompact={handleCompact} onDelete={(node) => setDeleteTarget(node)} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="font-mono text-xs text-zinc-600">프로젝트를 선택하세요</p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* 파일 편집 모달 */}
      {editingNode && (
        <FileEditorModal
          filePath={editingNode.path}
          fileName={editingNode.name}
          onClose={() => setEditingNode(null)}
        />
      )}

      {/* Compact 결과 저장 확인 다이얼로그 */}
      {compactResult && (
        <SaveConfirmDialog
          oldContent={compactResult.originalContent}
          newContent={compactResult.compacted}
          fileName={compactResult.path.split('/').pop() ?? compactResult.path}
          onConfirm={handleSaveCompact}
          onCancel={() => setCompactResult(null)}
          saving={savingCompact}
        />
      )}

      {/* 파일 삭제 확인 다이얼로그 */}
      {deleteTarget && (
        <DangerDeleteDialog
          title={`${deleteTarget.name} 파일을 삭제하시겠습니까?`}
          confirmText={deleteTarget.name}
          description={deleteTarget.path}
          onConfirm={async () => {
            try {
              await fetch('/api/file/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: deleteTarget.path }),
              })
              queryClient.invalidateQueries({ queryKey: ['project-trees'] })
            } catch {}
            setDeleteTarget(null)
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* 프로젝트 삭제 확인 */}
      {deleteProjectTarget && (
        <DangerDeleteDialog
          title={`'${deleteProjectTarget.name}' 프로젝트를 제거하시겠습니까?`}
          description="~/.claude/projects/ 내의 해당 프로젝트 디렉토리 (세션 로그, 메모리 등)가 모두 삭제됩니다."
          confirmText={deleteProjectTarget.name}
          onConfirm={() => deleteProjectMutation.mutate(deleteProjectTarget.encoded)}
          onCancel={() => setDeleteProjectTarget(null)}
        />
      )}

      {/* Inline Wizard 모달 */}
      {showWizard && (() => {
        const mainProjects = projects.filter((p) => !worktreePaths.has(p.project_path))
        const active = selectedPath
          ? projects.find((p) => p.project_path === selectedPath) ?? mainProjects[0]
          : mainProjects[0]
        return active ? (
          <InlineWizardModal
            projectPath={active.project_path}
            projectName={active.project_name}
            allProjects={mainProjects}
            onClose={() => setShowWizard(false)}
            onApplied={() => {
              queryClient.invalidateQueries({ queryKey: ['project-trees'] })
            }}
          />
        ) : null
      })()}
    </div>
  )
}
