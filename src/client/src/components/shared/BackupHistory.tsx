/**
 * 백업 이력을 모달로 표시하는 컴포넌트.
 * 각 항목에서 파일명, 타임스탬프, Restore 버튼을 제공한다.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'
import { useEscClose } from '../../hooks/useEscClose'
import type { BackupEntry } from '../../lib/types'

interface BackupHistoryProps {
  onClose: () => void
}

export function BackupHistory({ onClose }: BackupHistoryProps) {
  useEscClose(onClose)
  const qc = useQueryClient()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => api.backups.list(),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.backups.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backups'] })
      setConfirmId(null)
      setError('')
    },
    onError: (e: Error) => {
      setError(e.message)
      setConfirmId(null)
    },
  })

  const formatTime = (ts: number) =>
    new Date(ts * 1000).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

  const getFileName = (entry: BackupEntry) =>
    entry.target_path.split('/').pop() ?? entry.target_path

  const history = [...(data?.history ?? [])].reverse()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-200">Backup History</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 rounded p-2 mb-3">{error}</p>
          )}

          {isLoading ? (
            <p className="text-sm text-zinc-500 text-center py-8">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">No backup history yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between bg-zinc-800 rounded-md px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 font-mono truncate">{getFileName(entry)}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate" title={entry.target_path}>
                      {entry.target_path}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">{formatTime(entry.timestamp)}</p>
                  </div>

                  {confirmId === entry.id ? (
                    <div className="flex gap-2 ml-4 shrink-0">
                      <button
                        onClick={() => restoreMutation.mutate(entry.id)}
                        disabled={restoreMutation.isPending}
                        className="px-2.5 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-md disabled:opacity-50"
                      >
                        {restoreMutation.isPending ? 'Restoring...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 rounded-md"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(entry.id)}
                      className="ml-4 shrink-0 px-2.5 py-1 text-xs text-zinc-300 border border-zinc-600 hover:border-zinc-400 hover:text-zinc-100 rounded-md"
                    >
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
