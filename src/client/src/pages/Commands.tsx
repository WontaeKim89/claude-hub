import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, X, Terminal } from 'lucide-react'
import { api } from '../lib/api-client'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import { TableSkeleton } from '../components/shared/Skeleton'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
import { useEscClose } from '../hooks/useEscClose'
import type { CommandSummary, CommandDetail } from '../lib/types'

function NewCommandModal({ onClose }: { onClose: () => void }) {
  useEscClose(onClose)
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.commands.create({ name, content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commands'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[680px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-100">New Command</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">name</label>
            <div className="flex items-center gap-0">
              <span className="px-3 py-2 text-sm text-zinc-600 bg-zinc-800 border border-r-0 border-zinc-700 rounded-l font-mono">/</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-r px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-fuchsia-500/50"
                placeholder="my-command"
              />
            </div>
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">content</label>
            <MonacoWrapper value={content} onChange={setContent} height="300px" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim()}
            className="px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditCommandModal({ command, onClose }: { command: CommandSummary; onClose: () => void }) {
  useEscClose(onClose)
  const qc = useQueryClient()
  const { data } = useQuery<CommandDetail>({
    queryKey: ['command', command.name],
    queryFn: () => api.commands.get(command.name),
  })
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  const editorValue = content || data?.content || ''

  const mutation = useMutation({
    mutationFn: () => api.commands.update(command.name, editorValue),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commands'] })
      qc.invalidateQueries({ queryKey: ['command', command.name] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[720px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <div>
            <span className="text-sm font-medium text-zinc-100 font-mono">/{command.name}</span>
            {data?.path && <p className="text-xs text-zinc-600 font-mono mt-0.5">{data.path}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {data ? (
            <MonacoWrapper value={editorValue} onChange={setContent} height="480px" />
          ) : (
            <div className="flex items-center justify-center h-40 text-zinc-600 text-xs font-mono">loading...</div>
          )}
        </div>
        {error && <p className="text-xs text-red-400 px-5 py-2">{error}</p>}
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Commands() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [editCommand, setEditCommand] = useState<CommandSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CommandSummary | null>(null)

  const { data: commands = [], isLoading } = useQuery<CommandSummary[]>({
    queryKey: ['commands'],
    queryFn: () => api.commands.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.commands.delete(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commands'] })
      setDeleteTarget(null)
    },
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-1.5">
          <div>
            <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Commands</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Manage your slash commands</p>
          </div>
          <InfoTooltip {...CATEGORY_INFO.commands} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors"
          >
            <Plus size={13} strokeWidth={2} />
            New Command
          </button>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={3} cols={3} />
      ) : commands.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Terminal size={24} strokeWidth={1} className="text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No commands found.</p>
          <p className="text-xs text-zinc-600 mt-1">Create a slash command to automate common tasks.</p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Preview</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {commands.map((cmd) => (
                <tr
                  key={cmd.name}
                  className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/30 transition-colors duration-150"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-fuchsia-400">/{cmd.name}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 truncate max-w-md">
                    {cmd.content_preview}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditCommand(cmd)}
                        className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={13} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cmd)}
                        className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewCommandModal onClose={() => setShowNew(false)} />}
      {editCommand && <EditCommandModal command={editCommand} onClose={() => setEditCommand(null)} />}

      {deleteTarget && (
        <DangerDeleteDialog
          title={`'/${deleteTarget.name}' Delete this command?`}
          confirmText={deleteTarget.name}
          onConfirm={() => deleteMutation.mutate(deleteTarget.name)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
