import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Puzzle, BarChart2 } from 'lucide-react'
import { api } from '../lib/api-client'
import { Badge } from '../components/shared/Badge'
import { TableSkeleton } from '../components/shared/Skeleton'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import { AnalysisPanel } from '../components/analysis/AnalysisPanel'
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


export default function Plugins() {
  const qc = useQueryClient()
  const [uninstallTarget, setUninstallTarget] = useState<PluginSummary | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)

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
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-1.5">
          <div>
            <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Plugins</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Manage installed Claude plugins</p>
          </div>
          <InfoTooltip {...CATEGORY_INFO.plugins} />
        </div>
        <button
          onClick={() => setShowAnalysis(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-700 hover:bg-purple-600 text-white rounded transition-colors duration-150"
        >
          <BarChart2 size={13} strokeWidth={2} />
          사용량 분석
        </button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : plugins.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Puzzle size={24} strokeWidth={1} className="text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No plugins installed.</p>
          <p className="text-xs text-zinc-600 mt-1">Browse the Marketplace to find plugins.</p>
        </div>
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
                  className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/30 transition-colors duration-150"
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
        <DangerDeleteDialog
          title={`'${uninstallTarget.name}' 플러그인을 제거하시겠습니까?`}
          confirmText={uninstallTarget.name}
          onConfirm={() => removeMutation.mutate(uninstallTarget.name)}
          onCancel={() => setUninstallTarget(null)}
        />
      )}
      {showAnalysis && <AnalysisPanel type="plugins" onClose={() => setShowAnalysis(false)} />}
    </div>
  )
}
