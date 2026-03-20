import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import type { PluginSummary } from '../lib/types'

function PluginCard({ plugin }: { plugin: PluginSummary }) {
  const qc = useQueryClient()
  const [uninstallTarget, setUninstallTarget] = useState(false)

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => api.plugins.toggle(plugin.name, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plugins'] }),
  })

  const removeMutation = useMutation({
    mutationFn: () => api.plugins.remove(plugin.name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plugins'] })
      setUninstallTarget(false)
    },
  })

  const isOfficial = plugin.source_type === 'official'
  const assetItems = [
    { label: 'Skills', count: plugin.assets.skills },
    { label: 'Commands', count: plugin.assets.commands },
    { label: 'Agents', count: plugin.assets.agents },
  ]

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-sm font-medium text-zinc-100">{plugin.name}</span>
            <span className="ml-2 text-xs text-zinc-500">v{plugin.version}</span>
          </div>
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
              isOfficial
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}
          >
            {isOfficial ? 'official' : 'community'}
          </span>
        </div>

        {/* Description */}
        {plugin.description && (
          <p className="text-xs text-zinc-400 line-clamp-2">{plugin.description}</p>
        )}

        {/* Assets */}
        <div className="flex gap-3">
          {assetItems.map(({ label, count }) => (
            <div key={label} className="text-center">
              <p className="text-sm font-medium text-zinc-100">{count}</p>
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Footer: toggle + uninstall */}
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
          {/* Toggle switch */}
          <button
            onClick={() => toggleMutation.mutate(!plugin.enabled)}
            disabled={toggleMutation.isPending}
            className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            <span
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                plugin.enabled ? 'bg-indigo-600' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  plugin.enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
            {plugin.enabled ? 'Enabled' : 'Disabled'}
          </button>

          <button
            onClick={() => setUninstallTarget(true)}
            className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md"
          >
            Uninstall
          </button>
        </div>
      </div>

      {/* Uninstall confirm dialog */}
      {uninstallTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-80">
            <h3 className="text-sm font-medium text-zinc-100 mb-2">Uninstall plugin</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Remove{' '}
              <span className="text-zinc-100">"{plugin.name}"</span> from{' '}
              <span className="text-zinc-100">{plugin.marketplace}</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setUninstallTarget(false)}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={() => removeMutation.mutate()}
                disabled={removeMutation.isPending}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-md disabled:opacity-50"
              >
                {removeMutation.isPending ? 'Removing...' : 'Uninstall'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function Plugins() {
  const { data: plugins = [], isLoading } = useQuery<PluginSummary[]>({
    queryKey: ['plugins'],
    queryFn: () => api.plugins.list(),
  })

  return (
    <div>
      <PageHeader title="Plugins" subtitle="Manage installed Claude plugins" />

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : plugins.length === 0 ? (
        <p className="text-sm text-zinc-500">No plugins installed.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {plugins.map((plugin) => (
            <PluginCard key={plugin.name} plugin={plugin} />
          ))}
        </div>
      )}
    </div>
  )
}
