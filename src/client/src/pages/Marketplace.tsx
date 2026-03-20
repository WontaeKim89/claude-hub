import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/shared/Badge'
import type { MarketplacePlugin, MarketplaceSource } from '../lib/types'

function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4 animate-pulse">
      <div className="h-3.5 bg-zinc-800 rounded w-2/3 mb-2" />
      <div className="h-2.5 bg-zinc-800 rounded w-full mb-1" />
      <div className="h-2.5 bg-zinc-800 rounded w-4/5 mb-4" />
      <div className="flex gap-2">
        <div className="h-4 bg-zinc-800 rounded w-14" />
        <div className="h-4 bg-zinc-800 rounded w-18" />
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4 flex flex-col gap-3 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium text-zinc-100">{plugin.name}</span>
          {plugin.version && (
            <span className="ml-2 font-mono text-xs text-zinc-600">v{plugin.version}</span>
          )}
        </div>
        {plugin.category && (
          <Badge variant="zinc">{plugin.category}</Badge>
        )}
      </div>

      {plugin.description && (
        <p className="text-xs text-zinc-500 line-clamp-2 flex-1">{plugin.description}</p>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
        <span className="font-mono text-xs text-zinc-700">{plugin.marketplace}</span>
        {plugin.installed ? (
          <Badge variant="emerald">installed</Badge>
        ) : (
          <button
            onClick={() => installMutation.mutate()}
            disabled={installMutation.isPending}
            className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50"
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

  const categories = Array.from(new Set(plugins.map((p) => p.category).filter(Boolean)))
  const tabs = [{ name: 'all', label: 'All' }, ...sources.map((s) => ({ name: s.name, label: s.name }))]

  return (
    <div>
      <PageHeader title="Marketplace" subtitle="Browse and install plugins from registered marketplaces" />

      {/* Source tabs — underline style */}
      <div className="flex gap-0 mb-5 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveSource(tab.name)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeSource === tab.name
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search plugins..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Plugin grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : plugins.length === 0 ? (
        <p className="text-xs text-zinc-600">No plugins found.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {plugins.map((plugin) => (
            <PluginCard key={`${plugin.marketplace}/${plugin.name}`} plugin={plugin} />
          ))}
        </div>
      )}
    </div>
  )
}
