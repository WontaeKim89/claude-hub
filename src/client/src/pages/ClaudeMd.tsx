import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import type { ClaudeMdEntry } from '../lib/types'

export default function ClaudeMd() {
  const qc = useQueryClient()
  const [activeScope, setActiveScope] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const { data: entries = [], isLoading } = useQuery<ClaudeMdEntry[]>({
    queryKey: ['claude-md'],
    queryFn: () => api.claudeMd.list(),
  })

  // 첫 번째 항목을 기본 탭으로 설정
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

  // 탭 전환 시 콘텐츠 동기화
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-40"><span className="text-zinc-500 text-sm">Loading...</span></div>
  }

  return (
    <div>
      <PageHeader title="CLAUDE.md" subtitle="Manage your Claude instruction files" />

      {/* Scope tabs */}
      {entries.length > 0 && (
        <div className="flex gap-1 mb-5 bg-zinc-900 border border-zinc-800 rounded-md p-1 w-fit">
          {entries.map((entry) => (
            <button
              key={entry.scope}
              onClick={() => handleTabChange(entry.scope)}
              className={`px-3 py-1 text-sm rounded flex items-center gap-1.5 ${
                activeScope === entry.scope
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {entry.scope}
              {!entry.exists && (
                <span className="text-xs opacity-60">(new)</span>
              )}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400 bg-red-400/10 rounded p-2 mb-4">{error}</p>}
      {success && <p className="text-sm text-emerald-400 bg-emerald-400/10 rounded p-2 mb-4">Saved successfully.</p>}

      {activeScope && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          {/* 파일 경로 표시 */}
          {scopeData && (
            <div className="px-4 py-2 border-b border-zinc-800">
              <span className="text-xs text-zinc-500 font-mono">{scopeData.path}</span>
            </div>
          )}

          {contentLoading ? (
            <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">Loading...</div>
          ) : (
            <MonacoWrapper value={content} onChange={setContent} height="500px" />
          )}

          <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800">
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || contentLoading}
              className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-sm text-zinc-500">No CLAUDE.md files found.</p>
        </div>
      )}
    </div>
  )
}
