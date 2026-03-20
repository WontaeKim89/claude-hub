import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import type { MarketplacePlugin, MarketplaceSource } from '../lib/types'

function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 animate-pulse">
      <div className="h-4 bg-zinc-800 rounded w-2/3 mb-2" />
      <div className="h-3 bg-zinc-800 rounded w-full mb-1" />
      <div className="h-3 bg-zinc-800 rounded w-4/5 mb-4" />
      <div className="flex gap-2">
        <div className="h-5 bg-zinc-800 rounded w-16" />
        <div className="h-5 bg-zinc-800 rounded w-20" />
      </div>
    </div>
  )
}

function PluginCard({ plugin }: { plugin: MarketplacePlugin }) {
  const qc = useQueryClient()

  const installMutation = useMutation({
    mutationFn: () => api.plugins.install(plugin.name, plugin.marketplace),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace', 'browse'] }),
  })

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium text-zinc-100">{plugin.name}</span>
          {plugin.version && (
            <span className="ml-2 text-xs text-zinc-500">v{plugin.version}</span>
          )}
        </div>
        {plugin.category && (
          <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
            {plugin.category}
          </span>
        )}
      </div>

      {/* Description */}
      {plugin.description && (
        <p className="text-xs text-zinc-400 line-clamp-2 flex-1">{plugin.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
        <span className="text-xs text-zinc-500">{plugin.marketplace}</span>
        {plugin.installed ? (
          <span className="px-2.5 py-1 text-xs text-emerald-400 bg-emerald-500/10 rounded-md">
            Installed
          </span>
        ) : (
          <button
            onClick={() => installMutation.mutate()}
            disabled={installMutation.isPending}
            className="px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-md disabled:opacity-50"
          >
            {installMutation.isPending ? 'Installing...' : 'Install'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Marketplace() {
  const [activeSource, setActiveSource] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  const { data: sources = [] } = useQuery<MarketplaceSource[]>({
    queryKey: ['marketplace', 'sources'],
    queryFn: () => api.marketplace.sources(),
  })

  const { data: plugins = [], isLoading } = useQuery<MarketplacePlugin[]>({
    queryKey: ['marketplace', 'browse', activeSource, query, category],
    queryFn: () =>
      api.marketplace.browse({
        source: activeSource === 'all' ? undefined : activeSource,
        q: query || undefined,
        category: category || undefined,
      }),
  })

  // 브라우즈 결과에서 카테고리 목록 추출
  const categories = Array.from(new Set(plugins.map((p) => p.category).filter(Boolean)))

  const tabs = [{ name: 'all', label: 'All' }, ...sources.map((s) => ({ name: s.name, label: s.name }))]

  return (
    <div>
      <PageHeader title="Marketplace" subtitle="Browse and install plugins from registered marketplaces" />

      {/* Source tabs */}
      <div className="flex gap-1 mb-4 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveSource(tab.name)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeSource === tab.name
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search plugins..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Plugin grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : plugins.length === 0 ? (
        <p className="text-sm text-zinc-500">No plugins found.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {plugins.map((plugin) => (
            <PluginCard key={`${plugin.marketplace}/${plugin.name}`} plugin={plugin} />
          ))}
        </div>
      )}
    </div>
  )
}
