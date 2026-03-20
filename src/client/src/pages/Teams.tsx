import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
import type { TeamSummary } from '../lib/types'

export default function Teams() {
  const qc = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<TeamSummary | null>(null)
  const [error, setError] = useState('')

  const { data: teams = [], isLoading } = useQuery<TeamSummary[]>({
    queryKey: ['teams'],
    queryFn: () => api.teams.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.teams.delete(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] })
      setDeleteTarget(null)
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div>
      <PageHeader title="Teams" subtitle="Shared team configurations at ~/.claude/teams/" />

      {error && <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2 mb-4">{error}</p>}

      {isLoading ? (
        <p className="text-xs text-zinc-600 font-mono">loading...</p>
      ) : teams.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-8 text-center">
          <p className="text-xs text-zinc-600">No teams found.</p>
          <p className="font-mono text-xs text-zinc-700 mt-1">~/.claude/teams/</p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-md overflow-hidden max-w-2xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Path</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr
                  key={team.name}
                  className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-zinc-200">{team.name}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-600 truncate max-w-xs">{team.path}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDeleteTarget(team)}
                      className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                      title="Delete"
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

      {deleteTarget && (
        <DangerDeleteDialog
          title={`'${deleteTarget.name}' 팀을 삭제하시겠습니까?`}
          confirmText={deleteTarget.name}
          onConfirm={() => deleteMutation.mutate(deleteTarget.name)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
