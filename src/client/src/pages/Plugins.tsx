import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/shared/Badge'
import type { PluginSummary } from '../lib/types'

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
        enabled ? 'bg-emerald-500' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-3' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function UninstallConfirm({ plugin, onConfirm, onCancel, isPending }: {
  plugin: PluginSummary
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md p-5 w-80">
        <h3 className="text-sm font-medium text-zinc-100 mb-2">Uninstall plugin</h3>
        <p className="text-xs text-zinc-400 mb-4">
          Remove <span className="font-mono text-zinc-200">"{plugin.name}"</span> from{' '}
          <span className="font-mono text-zinc-400">{plugin.marketplace}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded disabled:opacity-50"
          >
            {isPending ? 'Removing...' : 'Uninstall'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Plugins() {
  const qc = useQueryClient()
  const [uninstallTarget, setUninstallTarget] = useState<PluginSummary | null>(null)

  const { data: plugins = [], isLoading } = useQuery<PluginSummary[]>({
    queryKey: ['plugins'],
    queryFn: () => api.plugins.list(),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      api.plugins.toggle(name, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plugins'] }),
  })

  const removeMutation = useMutation({
    mutationFn: (name: string) => api.plugins.remove(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plugins'] })
      setUninstallTarget(null)
    },
  })

  return (
    <div>
      <PageHeader title="Plugins" subtitle="Manage installed Claude plugins" />

      {isLoading ? (
        <p className="text-xs text-zinc-600 font-mono">loading...</p>
      ) : plugins.length === 0 ? (
        <p className="text-xs text-zinc-600">No plugins installed.</p>
      ) : (
        <div className="border border-zinc-800 rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Version</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Source</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Assets</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Enabled</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {plugins.map((plugin) => (
                <tr
                  key={plugin.name}
                  className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-zinc-200">{plugin.name}</span>
                    {plugin.description && (
                      <p className="text-zinc-600 mt-0.5">{plugin.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-zinc-500">v{plugin.version}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={plugin.source_type === 'official' ? 'emerald' : 'amber'}>
                      {plugin.source_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 font-mono text-zinc-500">
                      <span>{plugin.assets.skills}s</span>
                      <span>{plugin.assets.commands}c</span>
                      <span>{plugin.assets.agents}a</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Toggle
                      enabled={plugin.enabled}
                      onChange={(enabled) => toggleMutation.mutate({ name: plugin.name, enabled })}
                      disabled={toggleMutation.isPending}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setUninstallTarget(plugin)}
                      className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                      title="Uninstall"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {uninstallTarget && (
        <UninstallConfirm
          plugin={uninstallTarget}
          onConfirm={() => removeMutation.mutate(uninstallTarget.name)}
          onCancel={() => setUninstallTarget(null)}
          isPending={removeMutation.isPending}
        />
      )}
    </div>
  )
}
