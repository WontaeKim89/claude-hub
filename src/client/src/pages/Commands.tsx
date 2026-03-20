import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import type { CommandSummary, CommandDetail } from '../lib/types'

function NewCommandModal({ onClose }: { onClose: () => void }) {
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[700px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-100">New Command</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-sm text-red-400 bg-red-400/10 rounded p-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              placeholder="my-command"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Content</label>
            <MonacoWrapper value={content} onChange={setContent} height="300px" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim()}
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditCommandModal({ command, onClose }: { command: CommandSummary; onClose: () => void }) {
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[700px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-sm font-medium text-zinc-100">{command.name}</h3>
            <p className="text-xs text-zinc-500">{command.path}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-hidden">
          {data ? (
            <MonacoWrapper value={editorValue} onChange={setContent} height="450px" />
          ) : (
            <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">Loading...</div>
          )}
        </div>
        {error && <p className="text-sm text-red-400 px-5 py-2">{error}</p>}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md disabled:opacity-50"
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
      <PageHeader title="Commands" subtitle="Manage your slash commands">
        <button
          onClick={() => setShowNew(true)}
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md"
        >
          + New Command
        </button>
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : commands.length === 0 ? (
        <p className="text-sm text-zinc-500">No commands found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {commands.map((cmd) => (
            <div
              key={cmd.name}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 border-l-2 border-l-emerald-500"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-sm font-medium text-zinc-100 font-mono">/{cmd.name}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  COMMAND
                </span>
              </div>
              <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{cmd.content_preview}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditCommand(cmd)}
                  className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(cmd)}
                  className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && <NewCommandModal onClose={() => setShowNew(false)} />}
      {editCommand && <EditCommandModal command={editCommand} onClose={() => setEditCommand(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-80">
            <h3 className="text-sm font-medium text-zinc-100 mb-2">Delete command</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Are you sure you want to delete <span className="text-zinc-100">"/{deleteTarget.name}"</span>? This cannot be undone.
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
