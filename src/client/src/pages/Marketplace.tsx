import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Package, Server, Trash2, Download, X, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react'
import { api } from '../lib/api-client'
import { useLang } from '../hooks/useLang'
import { useEscClose } from '../hooks/useEscClose'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
import type { MarketplacePlugin, McpBrowseResponse } from '../lib/types'

function getSourceStyle(marketplace: string): string {
  if (marketplace.includes('official')) return 'text-fuchsia-400 bg-fuchsia-500/10'
  if (marketplace.includes('attention') || marketplace.includes('team')) return 'text-violet-400 bg-violet-500/10'
  return 'text-amber-400 bg-amber-500/10'
}

function getMcpSourceStyle(source: string): string {
  if (source === 'Anthropic') return 'text-violet-400 bg-violet-500/10'
  if (source === 'MCP Official') return 'text-blue-400 bg-blue-500/10'
  return 'text-zinc-400 bg-zinc-500/10'
}

function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-3.5 w-3.5 bg-zinc-800 rounded" />
        <div className="h-3.5 bg-zinc-800 rounded w-2/3" />
      </div>
      <div className="h-2.5 bg-zinc-800 rounded w-full mb-1" />
      <div className="h-2.5 bg-zinc-800 rounded w-4/5 mb-4" />
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
        <div className="h-4 bg-zinc-800 rounded w-20" />
        <div className="h-4 bg-zinc-800 rounded w-14" />
      </div>
    </div>
  )
}

function PluginCard({
  plugin,
  t,
  onDelete,
  onClick,
}: {
  plugin: MarketplacePlugin
  t: (key: string) => string
  onDelete?: () => void
  onClick: () => void
}) {
  const qc = useQueryClient()

  const installMutation = useMutation({
    mutationFn: () => api.plugins.install(plugin.name, plugin.marketplace),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace', 'browse'] }),
  })

  return (
    <div
      onClick={onClick}
      className="bg-zinc-900 border border-zinc-800 rounded-md p-4 flex flex-col gap-2.5 hover:border-zinc-700 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <Package size={13} className="text-zinc-600 shrink-0" strokeWidth={1.5} />
        <span className="font-mono text-sm font-bold text-zinc-100 truncate">{plugin.name}</span>
        {plugin.version && (
          <span className="font-mono text-[10px] text-zinc-600 shrink-0">v{plugin.version}</span>
        )}
      </div>

      {plugin.description && (
        <p className="text-xs text-zinc-500 line-clamp-2 flex-1 leading-relaxed">{plugin.description}</p>
      )}

      {plugin.category && (
        <div>
          <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-400 rounded">
            {plugin.category}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-zinc-800 mt-auto">
        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-mono rounded ${getSourceStyle(plugin.marketplace)}`}>
          {plugin.marketplace}
        </span>
        <div className="flex items-center gap-1.5">
          {plugin.installed ? (
            <>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-fuchsia-500/10 text-fuchsia-400 rounded border border-fuchsia-500/20">
                {t('marketplace.installed')}
              </span>
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete() }}
                  className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); installMutation.mutate() }}
              disabled={installMutation.isPending}
              className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-mono border border-fuchsia-600 text-fuchsia-400 hover:bg-fuchsia-600 hover:text-white rounded transition-colors disabled:opacity-50"
            >
              <Download size={10} />
              {installMutation.isPending ? '...' : t('marketplace.install')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

type McpServer = {
  name: string
  description: string
  package: string
  category: string
  source: string
  installed: boolean
  homepage?: string
}

function McpCard({
  server,
  t,
  onInstall,
  onUninstall,
  isInstalling,
  onClick,
}: {
  server: McpServer
  t: (key: string) => string
  onInstall: () => void
  onUninstall: () => void
  isInstalling: boolean
  onClick: () => void
}) {
  return (
    <div onClick={onClick} className="bg-zinc-900 border border-zinc-800 rounded-md p-4 flex flex-col gap-2.5 hover:border-zinc-700 transition-colors cursor-pointer">
      <div className="flex items-center gap-2">
        <Server size={13} className="text-zinc-600 shrink-0" strokeWidth={1.5} />
        <span className="font-mono text-sm font-bold text-zinc-100 truncate">{server.name}</span>
        <span className={`ml-auto inline-block px-1.5 py-0.5 text-[10px] font-mono rounded shrink-0 ${getMcpSourceStyle(server.source)}`}>
          {server.source}
        </span>
      </div>

      {server.description && (
        <p className="text-xs text-zinc-500 line-clamp-2 flex-1 leading-relaxed">{server.description}</p>
      )}

      <p className="font-mono text-[10px] text-zinc-600 truncate" title={server.package}>
        {server.package}
      </p>

      {server.category && (
        <div>
          <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-400 rounded">
            {server.category}
          </span>
        </div>
      )}

      <div className="flex items-center justify-end pt-2 border-t border-zinc-800 mt-auto">
        {server.installed ? (
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 text-[10px] font-mono bg-fuchsia-500/10 text-fuchsia-400 rounded border border-fuchsia-500/20">
              {t('marketplace.installed')}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onUninstall() }}
              className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ) : server.package ? (
          <button
            onClick={(e) => { e.stopPropagation(); onInstall() }}
            disabled={isInstalling}
            className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-mono border border-fuchsia-600 text-fuchsia-400 hover:bg-fuchsia-600 hover:text-white rounded transition-colors disabled:opacity-50"
          >
            <Download size={10} />
            {isInstalling ? '...' : t('marketplace.install')}
          </button>
        ) : (
          <span className="px-2 py-0.5 text-[10px] font-mono text-zinc-600">
            설치 불가
          </span>
        )}
      </div>
    </div>
  )
}

type DetailTarget =
  | { type: 'plugin'; data: MarketplacePlugin }
  | { type: 'mcp'; data: McpServer }

function DetailModal({ target, t, onClose, onInstall, onUninstall, isInstalling }: {
  target: DetailTarget
  t: (key: string) => string
  onClose: () => void
  onInstall: () => void
  onUninstall: () => void
  isInstalling: boolean
}) {
  useEscClose(onClose)
  const isPlugin = target.type === 'plugin'
  const d = target.data

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[480px] max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            {isPlugin ? <Package size={15} className="text-zinc-400" /> : <Server size={15} className="text-zinc-400" />}
            <span className="text-sm font-medium text-zinc-100 font-mono">{d.name}</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {d.description && (
            <p className="text-xs text-zinc-400 leading-relaxed">{d.description}</p>
          )}

          {/* GitHub 링크 */}
          {(() => {
            const link = isPlugin
              ? (target.data as MarketplacePlugin).homepage || (target.data as MarketplacePlugin).source_url
              : (target.data as McpServer).homepage
            return link ? (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition-colors"
              >
                <ExternalLink size={12} />
                GitHub에서 보기
              </a>
            ) : null
          })()}

          <div className="grid grid-cols-2 gap-3">
            {isPlugin && (target.data as MarketplacePlugin).version && (
              <div>
                <p className="text-[10px] font-mono text-zinc-600 mb-1">{t('marketplace.version')}</p>
                <p className="text-xs text-zinc-300 font-mono">v{(target.data as MarketplacePlugin).version}</p>
              </div>
            )}
            {d.category && (
              <div>
                <p className="text-[10px] font-mono text-zinc-600 mb-1">{t('marketplace.category')}</p>
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-400 rounded">
                  {d.category}
                </span>
              </div>
            )}
            <div>
              <p className="text-[10px] font-mono text-zinc-600 mb-1">{t('marketplace.source')}</p>
              <span className={`inline-block px-1.5 py-0.5 text-[10px] font-mono rounded ${
                isPlugin ? getSourceStyle((target.data as MarketplacePlugin).marketplace) : getMcpSourceStyle((target.data as McpServer).source)
              }`}>
                {isPlugin ? (target.data as MarketplacePlugin).marketplace : (target.data as McpServer).source}
              </span>
            </div>
            {isPlugin && (target.data as MarketplacePlugin).author && (
              <div>
                <p className="text-[10px] font-mono text-zinc-600 mb-1">Author</p>
                <p className="text-xs text-zinc-300 font-mono">{(target.data as MarketplacePlugin).author}</p>
              </div>
            )}
            {!isPlugin && (target.data as McpServer).package && (
              <div>
                <p className="text-[10px] font-mono text-zinc-600 mb-1">{t('marketplace.package')}</p>
                <p className="text-xs text-zinc-300 font-mono truncate" title={(target.data as McpServer).package}>
                  {(target.data as McpServer).package}
                </p>
              </div>
            )}
          </div>

          {isPlugin && (target.data as MarketplacePlugin).tags && (target.data as MarketplacePlugin).tags!.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(target.data as MarketplacePlugin).tags!.map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-500 rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Install / Uninstall action */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-600">{t('common.status')}:</span>
              {d.installed ? (
                <span className="px-2 py-0.5 text-[10px] font-mono bg-fuchsia-500/10 text-fuchsia-400 rounded border border-fuchsia-500/20">
                  {t('marketplace.installed')}
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-500 rounded">
                  Not installed
                </span>
              )}
            </div>
            {d.installed ? (
              <button
                onClick={onUninstall}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-red-900/40 text-red-500 hover:text-red-400 hover:border-red-700/60 rounded transition-colors"
              >
                <Trash2 size={12} />
                {t('delete.remove')}
              </button>
            ) : !isPlugin && !(target.data as McpServer).package ? (
              <span className="px-2 py-0.5 text-[10px] font-mono text-zinc-600">
                설치 불가
              </span>
            ) : (
              <button
                onClick={onInstall}
                disabled={isInstalling}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors disabled:opacity-50"
              >
                <Download size={12} />
                {isInstalling ? '...' : t('marketplace.install')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

type MainTab = 'plugins' | 'mcp'
type FilterMode = 'all' | 'installed'

export default function Marketplace() {
  const { t } = useLang()
  const qc = useQueryClient()
  const [mainTab, setMainTab] = useState<MainTab>('plugins')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [activeSource, setActiveSource] = useState<string>('all')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'plugin' | 'mcp'; name: string } | null>(null)
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // query 변경 시 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: allPlugins = [], isLoading: pluginsLoading } = useQuery<MarketplacePlugin[]>({
    queryKey: ['marketplace', 'browse'],
    queryFn: () => api.marketplace.browse({}),
  })

  const { data: mcpData, isLoading: mcpLoading } = useQuery<McpBrowseResponse>({
    queryKey: ['marketplace', 'mcp'],
    queryFn: () => api.marketplace.mcp(),
  })
  const mcpServers = mcpData?.servers ?? []
  const mcpSource = mcpData?.source ?? 'error'

  const { data: mcpSearchData, isFetching: mcpSearching } = useQuery<McpBrowseResponse>({
    queryKey: ['marketplace', 'mcp', 'search', debouncedQuery],
    queryFn: () => api.marketplace.mcpSearch(debouncedQuery),
    enabled: mainTab === 'mcp' && debouncedQuery.length >= 2,
    staleTime: 30_000,
  })

  const mcpSyncMutation = useMutation({
    mutationFn: () => api.marketplace.mcpSync(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace', 'mcp'] }),
  })

  const mcpInstallMutation = useMutation({
    mutationFn: ({ name, pkg }: { name: string; pkg: string }) => api.marketplace.installMcp(name, pkg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace', 'mcp'] }),
  })

  const mcpUninstallMutation = useMutation({
    mutationFn: (name: string) => api.marketplace.uninstallMcp(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace', 'mcp'] }),
  })

  const pluginDeleteMutation = useMutation({
    mutationFn: (name: string) => api.plugins.remove(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace', 'browse'] })
      setDeleteTarget(null)
    },
  })

  // 소스 탭 목록
  const sourceTabs = useMemo(() => {
    const counts = allPlugins.reduce<Record<string, number>>((acc, p) => {
      acc[p.marketplace] = (acc[p.marketplace] ?? 0) + 1
      return acc
    }, {})
    const marketplaces = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }))
    return [{ name: 'all', count: allPlugins.length }, ...marketplaces]
  }, [allPlugins])

  const categories = useMemo(() => {
    const base = activeSource === 'all' ? allPlugins : allPlugins.filter((p) => p.marketplace === activeSource)
    const unique = Array.from(new Set(base.map((p) => p.category).filter(Boolean))) as string[]
    return unique.sort()
  }, [allPlugins, activeSource])

  // 필터 적용 (플러그인)
  const filteredPlugins = useMemo(() => {
    return allPlugins.filter((p) => {
      if (filterMode === 'installed' && !p.installed) return false
      if (activeSource !== 'all' && p.marketplace !== activeSource) return false
      if (activeCategory !== 'all' && p.category !== activeCategory) return false
      if (query && !p.name.toLowerCase().includes(query.toLowerCase()) &&
          !p.description?.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [allPlugins, filterMode, activeSource, activeCategory, query])

  // 필터 적용 (MCP)
  const filteredMcp = useMemo(() => {
    if (mainTab === 'mcp' && debouncedQuery.length >= 2 && mcpSearchData?.servers) {
      let list = mcpSearchData.servers as McpServer[]
      if (filterMode === 'installed') list = list.filter((s) => s.installed)
      return list
    }
    let list = mcpServers as McpServer[]
    if (filterMode === 'installed') list = list.filter((s) => s.installed)
    if (query) {
      list = list.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.description.toLowerCase().includes(query.toLowerCase())
      )
    }
    return list
  }, [mcpServers, mcpSearchData, filterMode, query, debouncedQuery, mainTab])

  function handleSourceChange(name: string) {
    setActiveSource(name)
    setActiveCategory('all')
  }

  function handleDelete() {
    if (!deleteTarget) return
    if (deleteTarget.type === 'plugin') {
      pluginDeleteMutation.mutate(deleteTarget.name)
    } else {
      mcpUninstallMutation.mutate(deleteTarget.name)
      setDeleteTarget(null)
    }
  }

  const installedPluginCount = allPlugins.filter((p) => p.installed).length
  const installedMcpCount = mcpServers.filter((s) => s.installed).length
  const isLoading = mainTab === 'plugins' ? pluginsLoading : (mcpLoading || mcpSearching)

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('marketplace.title')}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{t('marketplace.subtitle')}</p>
        </div>
        <InfoTooltip {...CATEGORY_INFO.marketplace} />
      </div>

      {/* 메인 탭: 플러그인 / MCP 서버 */}
      <div className="flex items-center justify-between mb-5 border-b border-zinc-800 pb-0">
        <div className="flex gap-1">
          <button
            onClick={() => setMainTab('plugins')}
            className={`px-3 py-1.5 text-xs font-mono rounded-t transition-colors -mb-px border-b-2 ${
              mainTab === 'plugins'
                ? 'text-zinc-100 border-fuchsia-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {t('marketplace.plugins')}
            <span className={`ml-1.5 text-[10px] ${mainTab === 'plugins' ? 'text-fuchsia-400' : 'text-zinc-600'}`}>
              {allPlugins.length}
            </span>
          </button>
          <button
            onClick={() => setMainTab('mcp')}
            className={`px-3 py-1.5 text-xs font-mono rounded-t transition-colors -mb-px border-b-2 ${
              mainTab === 'mcp'
                ? 'text-zinc-100 border-fuchsia-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {t('marketplace.mcp')}
            <span className={`ml-1.5 text-[10px] ${mainTab === 'mcp' ? 'text-fuchsia-400' : 'text-zinc-600'}`}>
              {mcpServers.length}
            </span>
          </button>
        </div>

        {/* 설치됨 필터 토글 */}
        <div className="flex gap-1 -mb-px">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-t border-b-2 transition-colors ${
              filterMode === 'all'
                ? 'text-zinc-200 border-zinc-500'
                : 'text-zinc-600 border-transparent hover:text-zinc-400'
            }`}
          >
            {t('marketplace.filterAll')}
          </button>
          <button
            onClick={() => setFilterMode('installed')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-t border-b-2 transition-colors ${
              filterMode === 'installed'
                ? 'text-fuchsia-400 border-fuchsia-500'
                : 'text-zinc-600 border-transparent hover:text-zinc-400'
            }`}
          >
            {t('marketplace.filterInstalled')}
            <span className="ml-1 text-[10px]">
              {mainTab === 'plugins' ? installedPluginCount : installedMcpCount}
            </span>
          </button>
        </div>
      </div>

      {/* 플러그인 탭 전용: 소스 탭 + 카테고리 필터 */}
      {mainTab === 'plugins' && filterMode === 'all' && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {sourceTabs.map((tab) => (
              <button
                key={tab.name}
                onClick={() => handleSourceChange(tab.name)}
                className={`px-2.5 py-1 text-[11px] font-mono rounded-full transition-colors ${
                  activeSource === tab.name
                    ? 'bg-fuchsia-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                }`}
              >
                {tab.name === 'all' ? t('marketplace.all') : tab.name}
                <span className={`ml-1.5 ${activeSource === tab.name ? 'text-fuchsia-200' : 'text-zinc-600'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {categories.length > 0 && (
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-2 py-0.5 text-[10px] font-mono rounded-full shrink-0 transition-colors ${
                  activeCategory === 'all'
                    ? 'bg-fuchsia-600 text-white'
                    : 'bg-zinc-800/80 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t('marketplace.all')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded-full shrink-0 transition-colors ${
                    activeCategory === cat
                      ? 'bg-fuchsia-600 text-white'
                      : 'bg-zinc-800/80 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* 검색 바 */}
      <div className="relative mb-5 max-w-xs">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" strokeWidth={1.5} />
        <input
          type="text"
          placeholder={t('marketplace.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-fuchsia-500/50"
        />
      </div>

      {/* MCP 레지스트리 상태 배너 */}
      {mainTab === 'mcp' && (mcpSource === 'fallback' || mcpSource === 'error') && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">
            {mcpSource === 'fallback'
              ? '레지스트리 캐시가 없습니다. 기본 MCP 서버만 표시됩니다.'
              : 'MCP 레지스트리 로드에 실패했습니다.'}
          </span>
          <button
            onClick={() => mcpSyncMutation.mutate()}
            disabled={mcpSyncMutation.isPending}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono border border-amber-500/30 rounded hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={10} className={mcpSyncMutation.isPending ? 'animate-spin' : ''} />
            {mcpSyncMutation.isPending ? '동기화 중...' : '재시도'}
          </button>
        </div>
      )}

      {/* 결과 그리드 */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : mainTab === 'plugins' ? (
        filteredPlugins.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-xs text-zinc-600 font-mono">{t('marketplace.noResults')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filteredPlugins.map((plugin) => (
              <PluginCard
                key={`${plugin.marketplace}/${plugin.name}`}
                plugin={plugin}
                t={t}
                onDelete={plugin.installed ? () => setDeleteTarget({ type: 'plugin', name: plugin.name }) : undefined}
                onClick={() => setDetailTarget({ type: 'plugin', data: plugin })}
              />
            ))}
          </div>
        )
      ) : (
        filteredMcp.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-xs text-zinc-600 font-mono">{t('marketplace.noResults')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filteredMcp.map((server) => (
              <McpCard
                key={server.name}
                server={server}
                t={t}
                onInstall={() => mcpInstallMutation.mutate({ name: server.name, pkg: server.package })}
                onUninstall={() => setDeleteTarget({ type: 'mcp', name: server.name })}
                isInstalling={mcpInstallMutation.isPending}
                onClick={() => setDetailTarget({ type: 'mcp', data: server })}
              />
            ))}
          </div>
        )
      )}

      {detailTarget && (
        <DetailModal
          target={detailTarget}
          t={t}
          onClose={() => setDetailTarget(null)}
          isInstalling={detailTarget.type === 'plugin' ? false : mcpInstallMutation.isPending}
          onInstall={() => {
            if (detailTarget.type === 'plugin') {
              const p = detailTarget.data as MarketplacePlugin
              api.plugins.install(p.name, p.marketplace).then(() => {
                qc.invalidateQueries({ queryKey: ['marketplace', 'browse'] })
                setDetailTarget(null)
              })
            } else {
              const s = detailTarget.data as McpServer
              mcpInstallMutation.mutate({ name: s.name, pkg: s.package }, { onSuccess: () => setDetailTarget(null) })
            }
          }}
          onUninstall={() => {
            setDeleteTarget({
              type: detailTarget.type === 'plugin' ? 'plugin' : 'mcp',
              name: detailTarget.data.name,
            })
            setDetailTarget(null)
          }}
        />
      )}

      {deleteTarget && (
        <DangerDeleteDialog
          title={deleteTarget.type === 'plugin' ? t('marketplace.deletePlugin') : t('marketplace.deleteMcp')}
          description={deleteTarget.name}
          confirmText={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
