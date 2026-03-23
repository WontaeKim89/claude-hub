import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FolderKanban, Loader2, X, Save, ChevronRight,
  FileText, FolderOpen, FileCode, Settings2, TestTube, BookOpen, Brain, Pencil, Shrink, FolderDot, GitBranch
} from 'lucide-react'
import { api } from '../lib/api-client'
import { useLang } from '../hooks/useLang'
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

function countWarnings(nodes: TreeNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.type === 'file' && node.needs_compact) {
      count++
    } else if (node.type === 'dir' && node.children) {
      count += countWarnings(node.children)
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
    if (name.includes('.claude')) return <FolderDot size={14} className="text-emerald-400" />
    return <FolderOpen size={14} className="text-zinc-400" />
  }
  const color = exists ? 'text-zinc-300' : 'text-zinc-600'
  if (name === 'CLAUDE.md') return <Settings2 size={14} className="text-emerald-400" />
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
              (node as FileNode).needs_compact ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {(node as FileNode).needs_compact ? '⚠' : '●'} {(node as FileNode).lines}줄
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
              className="inline-flex items-center gap-0.5 text-[10px] text-emerald-500 hover:text-emerald-400 px-1.5 py-0.5 rounded hover:bg-emerald-500/10 transition-colors"
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

  const { data } = useQuery({
    queryKey: ['permissions-status', projectPath],
    queryFn: () => api.wizard.permissionsStatus(projectPath),
    staleTime: 30_000,
  })

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => api.wizard.togglePermissions(projectPath, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['permissions-status', projectPath] }),
  })

  const allAllowed = data?.all_allowed ?? false

  return (
    <div
      className="flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()} // 카드 토글 이벤트 차단
    >
      <span className="text-[10px] text-zinc-500 font-mono">전체 권한</span>
      <button
        onClick={() => toggleMutation.mutate(!allAllowed)}
        disabled={toggleMutation.isPending}
        className={`relative w-8 h-4 rounded-full transition-colors disabled:opacity-50 ${
          allAllowed ? 'bg-emerald-500' : 'bg-zinc-700'
        }`}
        title={allAllowed ? '전체 권한 허용 중 (클릭으로 해제)' : '전체 권한 해제 (클릭으로 허용)'}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
            allAllowed ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

// 프로젝트 카드 (아코디언)
function ProjectCard({
  project,
  defaultOpen,
  isWorktree,
  onEdit,
  onCompact,
  onDelete,
}: {
  project: ProjectTree
  defaultOpen: boolean
  isWorktree?: boolean
  onEdit: (node: FileNode) => void
  onCompact: (path: string) => void
  onDelete: (node: FileNode) => void
}) {
  const [open, setOpen] = useState(defaultOpen)

  const totalFiles = countFiles(project.nodes)
  const existingFiles = countExisting(project.nodes)
  const warningCount = countWarnings(project.nodes)

  return (
    <div className={`bg-zinc-900 border rounded-md overflow-hidden ${isWorktree ? 'border-zinc-700/50 ml-6' : 'border-zinc-800'}`}>
      {/* 헤더 - 클릭 시 토글 */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight
            size={14}
            className={`text-zinc-600 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`}
          />
          {isWorktree && (
            <GitBranch size={12} className="text-zinc-500 shrink-0" strokeWidth={1.5} />
          )}
          <span className="font-mono text-sm text-zinc-100 font-medium shrink-0">
            {project.project_name}
          </span>
          {isWorktree && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded">worktree</span>
          )}
          <span
            className="font-mono text-[10px] text-zinc-600 truncate"
            title={project.project_path}
          >
            {project.project_path}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <PermissionToggle projectPath={project.project_path} />
          <span className="font-mono text-[10px] text-emerald-400">
            {existingFiles}/{totalFiles} files
          </span>
          {warningCount > 0 && (
            <span className="font-mono text-[10px] text-amber-400">
              ⚠ {warningCount} need compact
            </span>
          )}
        </div>
      </button>

      {/* 트리 바디 */}
      {open && (
        <div className="px-2 pb-3 border-t border-zinc-800/50">
          {project.nodes.map((node, i) => (
            <TreeNodeRow key={i} node={node} depth={0} onEdit={onEdit} onCompact={onCompact} onDelete={onDelete} />
          ))}
        </div>
      )}
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
              <span className="font-mono text-xs text-emerald-400">{fileName}</span>
              <span className="font-mono text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                편집 중
              </span>
            </div>
            <span className="font-mono text-[10px] text-zinc-600 truncate max-w-[500px]" title={filePath}>
              {filePath}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saved && <span className="text-[10px] text-emerald-400">저장됨</span>}
            <button
              onClick={() => setShowSaveConfirm(true)}
              disabled={saving || loading}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50"
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

  // 편집 모달 상태
  const [editingNode, setEditingNode] = useState<FileNode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null)

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

  // 프로젝트 목록 조회 후 각 project tree 조회
  const { data: projects = [], isLoading, isError } = useQuery<ProjectTree[]>({
    queryKey: ['project-trees'],
    queryFn: async () => {
      const overviews = await api.wizard.projectOverviews()
      const trees = await Promise.all(
        overviews.map(async (p) => {
          try {
            const tree = await api.wizard.projectTree(p.project_path)
            return tree as ProjectTree
          } catch {
            return null
          }
        })
      )
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
    <div className="max-w-5xl">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FolderKanban size={16} className="text-emerald-400" strokeWidth={1.5} />
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

      {/* 프로젝트 카드 목록 — 워크트리는 부모 아래 들여쓰기 */}
      {projects.length > 0 && (
        <div className="flex flex-col gap-2">
          {projects.map((project, i) => {
            const isWorktree = worktreePaths.has(project.project_path)
            // 워크트리는 부모 카드 바로 뒤에 렌더링하므로 독립 렌더링은 skip
            if (isWorktree) return null

            // 이 프로젝트에 속한 워크트리 목록
            const group = groupedProjects.find((g) => g.path === project.project_path)
            const worktreeTrees = group
              ? group.worktrees
                  .map((w) => projects.find((p) => p.project_path === w.decoded))
                  .filter(Boolean) as ProjectTree[]
              : []

            return (
              <div key={project.project_path} className="flex flex-col gap-1.5">
                <ProjectCard
                  project={project}
                  defaultOpen={i === 0}
                  isWorktree={false}
                  onEdit={setEditingNode}
                  onCompact={handleCompact}
                  onDelete={(node) => setDeleteTarget(node)}
                />
                {worktreeTrees.map((wt) => (
                  <ProjectCard
                    key={wt.project_path}
                    project={wt}
                    defaultOpen={false}
                    isWorktree={true}
                    onEdit={setEditingNode}
                    onCompact={handleCompact}
                    onDelete={(node) => setDeleteTarget(node)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}

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
    </div>
  )
}
