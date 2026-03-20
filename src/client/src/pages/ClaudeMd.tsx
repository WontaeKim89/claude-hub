import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import { DiffModal } from '../components/shared/DiffModal'
import type { ClaudeMdEntry, DiffResult } from '../lib/types'

export default function ClaudeMd() {
  const qc = useQueryClient()
  const [activeScope, setActiveScope] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)

  const { data: entries = [], isLoading } = useQuery<ClaudeMdEntry[]>({
    queryKey: ['claude-md'],
    queryFn: () => api.claudeMd.list(),
  })

  useEffect(() => {
    if (entries.length > 0 && activeScope === null) {
      setActiveScope(entries[0].scope)
    }
  }, [entries, activeScope])

  const { data: scopeData, isLoading: contentLoading } = useQuery({
    queryKey: ['claude-md', activeScope],
    queryFn: () => api.claudeMd.get(activeScope!),
    enabled: activeScope !== null,
  })

  useEffect(() => {
    if (scopeData) {
      setContent(scopeData.content)
    }
  }, [scopeData])

  const mutation = useMutation({
    mutationFn: () => api.claudeMd.update(activeScope!, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['claude-md', activeScope] })
      setError('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleTabChange = (scope: string) => {
    setActiveScope(scope)
    setContent('')
    setError('')
  }

  const handlePreviewDiff = async () => {
    if (!activeScope) return
    const result = await api.previewDiff({ target: 'claude-md', scope: activeScope, content })
    setDiffResult(result)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="font-mono text-zinc-600 text-xs">loading...</span>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="CLAUDE.md" subtitle="Manage your Claude instruction files" />

      {/* Scope tabs */}
      {entries.length > 0 && (
        <div className="flex gap-0.5 mb-5 bg-zinc-900 border border-zinc-800 rounded p-0.5 w-fit">
          {entries.map((entry) => (
            <button
              key={entry.scope}
              onClick={() => handleTabChange(entry.scope)}
              className={`px-3 py-1.5 text-xs rounded flex items-center gap-1.5 transition-colors ${
                activeScope === entry.scope
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              <span className="font-mono">{entry.scope}</span>
              {!entry.exists && (
                <span className="text-xs opacity-60">(new)</span>
              )}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2 mb-4">{error}</p>}
      {success && <p className="text-xs text-emerald-400 bg-emerald-400/10 rounded px-3 py-2 mb-4">Saved successfully.</p>}

      {activeScope && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          {/* File path header */}
          {scopeData && (
            <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
              <span className="font-mono text-xs text-zinc-600">{scopeData.path}</span>
            </div>
          )}

          {contentLoading ? (
            <div className="flex items-center justify-center h-40 text-zinc-600 text-xs font-mono">loading...</div>
          ) : (
            <MonacoWrapper value={content} onChange={setContent} height="500px" />
          )}

          <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800">
            <button
              onClick={handlePreviewDiff}
              disabled={mutation.isPending || contentLoading}
              className="px-3 py-1.5 text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 rounded transition-colors disabled:opacity-50"
            >
              Preview Diff
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || contentLoading}
              className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-8 text-center">
          <p className="text-xs text-zinc-600">No CLAUDE.md files found.</p>
        </div>
      )}

      {diffResult && (
        <DiffModal
          diff={diffResult.diff}
          targetPath={diffResult.target_path}
          onClose={() => setDiffResult(null)}
        />
      )}
    </div>
  )
}
