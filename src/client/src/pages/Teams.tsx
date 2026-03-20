import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
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

      {error && <p className="text-sm text-red-400 bg-red-400/10 rounded p-2 mb-4">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : teams.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-sm text-zinc-500">No teams found.</p>
          <p className="text-xs text-zinc-600 mt-1">Teams are directories under ~/.claude/teams/</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {teams.map((team) => (
            <div
              key={team.name}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
            >
              <div className="mb-2">
                <span className="text-sm font-medium text-zinc-100">{team.name}</span>
              </div>
              <p className="text-xs font-mono text-zinc-500 mb-3 truncate">{team.path}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteTarget(team)}
                  className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-80">
            <h3 className="text-sm font-medium text-zinc-100 mb-2">Delete team</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Delete team <span className="text-zinc-100">"{deleteTarget.name}"</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.name)}
                disabled={deleteMutation.isPending}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-md disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
