import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Package } from 'lucide-react'
import { api } from '../lib/api-client'
import { useLang } from '../hooks/useLang'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import type { MarketplacePlugin, MarketplaceSource } from '../lib/types'

// 마켓플레이스 소스별 뱃지 색상 매핑
function getSourceStyle(marketplace: string): string {
  if (marketplace.includes('official')) return 'text-emerald-400 bg-emerald-500/10'
  if (marketplace.includes('attention') || marketplace.includes('team')) return 'text-teal-400 bg-teal-500/10'
  return 'text-amber-400 bg-amber-500/10'
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

function PluginCard({ plugin, t }: { plugin: MarketplacePlugin; t: (key: string) => string }) {
  const qc = useQueryClient()

  const installMutation = useMutation({
    mutationFn: () => api.plugins.install(plugin.name, plugin.marketplace),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace', 'browse'] }),
  })

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4 flex flex-col gap-2.5 hover:border-zinc-700 transition-colors">
      {/* 헤더: 아이콘 + 이름 */}
      <div className="flex items-center gap-2">
        <Package size={13} className="text-zinc-600 shrink-0" strokeWidth={1.5} />
        <span className="font-mono text-sm font-bold text-zinc-100 truncate">{plugin.name}</span>
        {plugin.version && (
          <span className="font-mono text-[10px] text-zinc-600 shrink-0">v{plugin.version}</span>
        )}
      </div>

      {/* 설명 */}
      {plugin.description && (
        <p className="text-xs text-zinc-500 line-clamp-2 flex-1 leading-relaxed">{plugin.description}</p>
      )}

      {/* 카테고리 뱃지 */}
      {plugin.category && (
        <div>
          <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-400 rounded">
            {plugin.category}
          </span>
        </div>
      )}

      {/* 하단: 마켓플레이스 소스 + 설치 버튼 */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800 mt-auto">
        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-mono rounded ${getSourceStyle(plugin.marketplace)}`}>
          {plugin.marketplace}
        </span>
        {plugin.installed ? (
          <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
            {t('marketplace.installed')}
          </span>
        ) : (
          <button
            onClick={() => installMutation.mutate()}
            disabled={installMutation.isPending}
            className="px-2.5 py-0.5 text-[10px] font-mono border border-emerald-600 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded transition-colors disabled:opacity-50"
          >
            {installMutation.isPending ? '...' : t('marketplace.install')}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Marketplace() {
  const { t } = useLang()
  const [activeSource, setActiveSource] = useState<string>('all')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [query, setQuery] = useState('')

  // 소스 목록 조회
  const { data: sources = [] } = useQuery<MarketplaceSource[]>({
    queryKey: ['marketplace', 'sources'],
    queryFn: () => api.marketplace.sources(),
  })

  // 전체 플러그인 목록 조회 (필터는 클라이언트에서 처리)
  const { data: allPlugins = [], isLoading } = useQuery<MarketplacePlugin[]>({
    queryKey: ['marketplace', 'browse'],
    queryFn: () => api.marketplace.browse({}),
  })

  // 소스 탭 목록 + 각 소스별 count
  const sourceTabs = useMemo(() => {
    const counts = allPlugins.reduce<Record<string, number>>((acc, p) => {
      acc[p.marketplace] = (acc[p.marketplace] ?? 0) + 1
      return acc
    }, {})

    const fromSources = sources.map((s) => ({
      name: s.name,
      count: counts[s.name] ?? 0,
    }))

    return [{ name: 'all', count: allPlugins.length }, ...fromSources]
  }, [sources, allPlugins])

  // 카테고리 목록 (현재 선택된 소스 기준)
  const categories = useMemo(() => {
    const base = activeSource === 'all' ? allPlugins : allPlugins.filter((p) => p.marketplace === activeSource)
    const unique = Array.from(new Set(base.map((p) => p.category).filter(Boolean))) as string[]
    return unique.sort()
  }, [allPlugins, activeSource])

  // 필터 적용
  const filtered = useMemo(() => {
    return allPlugins.filter((p) => {
      if (activeSource !== 'all' && p.marketplace !== activeSource) return false
      if (activeCategory !== 'all' && p.category !== activeCategory) return false
      if (query && !p.name.toLowerCase().includes(query.toLowerCase()) &&
          !p.description?.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [allPlugins, activeSource, activeCategory, query])

  // 소스 탭 변경 시 카테고리 초기화
  function handleSourceChange(name: string) {
    setActiveSource(name)
    setActiveCategory('all')
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('marketplace.title')}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{t('marketplace.subtitle')}</p>
        </div>
        <InfoTooltip {...CATEGORY_INFO.marketplace} />
      </div>

      {/* 소스 탭 — 가로 pill 방식 */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {sourceTabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => handleSourceChange(tab.name)}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-full transition-colors ${
              activeSource === tab.name
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            {tab.name === 'all' ? t('marketplace.all') : tab.name}
            <span className={`ml-1.5 ${activeSource === tab.name ? 'text-emerald-200' : 'text-zinc-600'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 카테고리 필터 — 가로 스크롤 pill 행 */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-2 py-0.5 text-[10px] font-mono rounded-full shrink-0 transition-colors ${
              activeCategory === 'all'
                ? 'bg-emerald-600 text-white'
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
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800/80 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* 검색 바 */}
      <div className="relative mb-5 max-w-xs">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" strokeWidth={1.5} />
        <input
          type="text"
          placeholder={t('marketplace.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      {/* 결과 그리드 */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-xs text-zinc-600 font-mono">{t('marketplace.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((plugin) => (
            <PluginCard key={`${plugin.marketplace}/${plugin.name}`} plugin={plugin} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}
