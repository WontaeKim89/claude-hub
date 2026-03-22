import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban, Loader2 } from 'lucide-react'
import { api } from '../lib/api-client'
import { useLang } from '../hooks/useLang'
import { InfoTooltip } from '../components/shared/InfoTooltip'
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

function Cell({ item }: { item: OverviewItem }) {
  const content = getCellContent(item)
  const isExists = item.exists

  return (
    <td
      className="px-3 py-2 text-center"
      title={item.path || undefined}
    >
      <span className={`inline-flex items-center gap-1 font-mono text-[11px] ${isExists ? 'text-emerald-400' : 'text-red-400/70'}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isExists ? 'bg-emerald-400' : 'bg-red-400/70'}`} />
        {content}
      </span>
    </td>
  )
}

export default function ProjectOverview() {
  const { t } = useLang()
  const navigate = useNavigate()

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
                  className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors"
                >
                  {/* 프로젝트명 (클릭 시 Wizard 이동) */}
                  <td className="px-3 py-2">
                    <button
                      onClick={() => navigate('/wizard')}
                      className="font-mono text-xs text-zinc-300 hover:text-emerald-400 transition-colors text-left truncate max-w-[200px]"
                      title={project.project_path}
                    >
                      {project.project_name}
                    </button>
                    <p className="font-mono text-[10px] text-zinc-600 truncate max-w-[200px]" title={project.project_path}>
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
                    return <Cell key={type} item={item} />
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
