import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban, Loader2, X, Save, Pencil } from 'lucide-react'
import { api } from '../lib/api-client'
import { useLang } from '../hooks/useLang'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import { CATEGORY_INFO } from '../lib/category-info'

type OverviewItem = {
  name: string
  type: string
  exists: boolean
  count?: number
  lines?: number
  files?: string[]
  path: string
}

type ProjectOverview = {
  project_path: string
  project_name: string
  items: OverviewItem[]
}

// 항목 타입별로 표시할 컬럼 순서
const COLUMN_TYPES = ['claude_md', 'memory', 'docs', 'file', 'tests', 'package_manager'] as const

// README.md 는 type:"file" 이며 name으로 구분
const COLUMN_LABELS: Record<string, string> = {
  claude_md: 'CLAUDE.md',
  memory: 'Memory',
  docs: 'docs/',
  file: 'README.md',
  tests: 'tests/',
  package_manager: '패키지',
}

function getCellContent(item: OverviewItem): string {
  if (!item.exists) return '없음'
  if (item.type === 'claude_md' && item.lines) return `${item.lines}줄`
  if (item.type === 'file' && item.lines) return `${item.lines}줄`
  if (item.type === 'memory' && item.count !== undefined) return `${item.count}개`
  if (item.type === 'docs' && item.count !== undefined) return `${item.count}개`
  if (item.type === 'tests' && item.count !== undefined) return `${item.count}개`
  if (item.type === 'package_manager') return item.name === '패키지 관리자' ? '없음' : item.name
  return '있음'
}

function Cell({ item, onOpen }: { item: OverviewItem; onOpen: (item: OverviewItem) => void }) {
  const content = getCellContent(item)
  const canOpen = item.exists && !!item.path

  if (canOpen) {
    return (
      <td className="px-2 py-1.5 text-center whitespace-nowrap">
        <button
          onClick={() => onOpen(item)}
          className="group inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all cursor-pointer"
          title={`클릭하여 편집: ${item.path}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="font-mono text-[11px] text-emerald-400">{content}</span>
          <Pencil size={10} className="text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      </td>
    )
  }

  return (
    <td className="px-2 py-1.5 text-center whitespace-nowrap">
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800/30 border border-zinc-800/50">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400/50 shrink-0" />
        <span className="font-mono text-[11px] text-zinc-600">{content}</span>
      </span>
    </td>
  )
}

// 파일 편집 모달
function FileEditorModal({ item, onClose }: { item: OverviewItem; onClose: () => void }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string>(
    item.type === 'memory' || item.type === 'docs'
      ? item.files?.[0] || ''
      : ''
  )

  const filePath = (item.type === 'memory' || item.type === 'docs') && selectedFile
    ? `${item.path}/${selectedFile}`
    : item.path

  // 파일 내용 읽기
  const loadFile = async (path: string) => {
    setLoading(true)
    setSaved(false)
    try {
      const resp = await fetch(`/api/file/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      if (resp.ok) {
        const data = await resp.json()
        setContent(data.content || '')
      } else {
        setContent('(파일을 읽을 수 없습니다)')
      }
    } catch {
      setContent('(파일을 읽을 수 없습니다)')
    }
    setLoading(false)
  }

  // 파일 저장
  const saveFile = async () => {
    setSaving(true)
    try {
      await fetch(`/api/file/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // ignore
    }
    setSaving(false)
  }

  // 초기 로드
  useEffect(() => { loadFile(filePath) }, [])

  const language = filePath.endsWith('.json') ? 'json' : filePath.endsWith('.toml') ? 'toml' : 'markdown'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[900px] max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-emerald-400">{item.name}</span>
              <span className="font-mono text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                편집 중
              </span>
            </div>
            <span
              className="font-mono text-[10px] text-zinc-600 truncate max-w-[500px]"
              title={filePath}
            >
              {filePath}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saved && <span className="text-[10px] text-emerald-400">저장됨</span>}
            <button
              onClick={saveFile}
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

        {/* memory/docs인 경우 파일 선택 탭 */}
        {(item.type === 'memory' || item.type === 'docs') && item.files && item.files.length > 1 && (
          <div className="flex gap-0 border-b border-zinc-800 px-4 overflow-x-auto">
            {item.files.map((f) => (
              <button
                key={f}
                onClick={() => { setSelectedFile(f); loadFile(`${item.path}/${f}`) }}
                className={`px-3 py-2 text-[11px] font-mono whitespace-nowrap border-b-2 transition-colors ${
                  selectedFile === f
                    ? 'border-emerald-500 text-zinc-100'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* 에디터 */}
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={16} className="text-zinc-600 animate-spin" />
            </div>
          ) : (
            <MonacoWrapper
              value={content}
              onChange={setContent}
              language={language}
              height="60vh"
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProjectOverview() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [editingItem, setEditingItem] = useState<OverviewItem | null>(null)

  const { data: projects = [], isLoading, isError } = useQuery<ProjectOverview[]>({
    queryKey: ['project-overviews'],
    queryFn: () => api.wizard.projectOverviews(),
    staleTime: 30_000,
  })

  // 각 프로젝트 items를 컬럼 순서로 정렬: claude_md, memory, docs, file(README), tests, package_manager
  function getItemByType(items: OverviewItem[], type: string): OverviewItem | undefined {
    if (type === 'file') {
      return items.find((i) => i.type === 'file' && i.name === 'README.md')
    }
    return items.find((i) => i.type === type)
  }

  return (
    <div className="max-w-5xl">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FolderKanban size={16} className="text-emerald-400" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('projects.title')}</h2>
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

      {/* 테이블 */}
      {projects.length > 0 && (
        <div className="overflow-x-auto border border-zinc-800 rounded-md">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-3 py-2 text-left font-mono text-zinc-500 font-medium whitespace-nowrap">
                  프로젝트
                </th>
                {COLUMN_TYPES.map((type) => (
                  <th
                    key={type}
                    className="px-3 py-2 text-center font-mono text-zinc-500 font-medium whitespace-nowrap"
                  >
                    {COLUMN_LABELS[type]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.project_path}
                  className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20 transition-colors"
                >
                  {/* 프로젝트명 (클릭 시 Wizard 이동) */}
                  <td className="px-3 py-2">
                    <button
                      onClick={() => navigate('/wizard')}
                      className="font-mono text-xs text-zinc-300 hover:text-emerald-400 transition-colors text-left truncate max-w-[250px] block"
                      title={project.project_path}
                    >
                      {project.project_name}
                    </button>
                    <p
                      className="font-mono text-[10px] text-zinc-600 truncate max-w-[250px]"
                      title={project.project_path}
                    >
                      {project.project_path}
                    </p>
                  </td>

                  {/* 각 설정 항목 셀 */}
                  {COLUMN_TYPES.map((type) => {
                    const item = getItemByType(project.items, type)
                    if (!item) {
                      return (
                        <td key={type} className="px-3 py-2 text-center">
                          <span className="font-mono text-[11px] text-zinc-700">—</span>
                        </td>
                      )
                    }
                    return <Cell key={type} item={item} onOpen={setEditingItem} />
                  })}

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 파일 편집 모달 */}
      {editingItem && (
        <FileEditorModal item={editingItem} onClose={() => setEditingItem(null)} />
      )}
    </div>
  )
}
