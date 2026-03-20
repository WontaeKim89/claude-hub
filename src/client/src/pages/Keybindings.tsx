import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'

interface KeybindingEntry {
  action: string
  shortcut: string
}

function dataToEntries(data: Record<string, string>): KeybindingEntry[] {
  return Object.entries(data).map(([action, shortcut]) => ({ action, shortcut }))
}

function EditKeybindingModal({ entry, onClose }: { entry: KeybindingEntry; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: kbData } = useQuery({ queryKey: ['keybindings'], queryFn: api.keybindings.get })
  const [shortcut, setShortcut] = useState(entry.shortcut)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      if (!kbData) throw new Error('No data')
      const updated = { ...kbData.data, [entry.action]: shortcut }
      return api.keybindings.update({ data: updated, last_mtime: kbData.last_mtime })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keybindings'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-96">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-100">Edit Keybinding</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">action</label>
            <input
              value={entry.action}
              readOnly
              className="w-full bg-zinc-800/50 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-600 font-mono cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">shortcut</label>
            <input
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder="Ctrl+Shift+P"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddKeybindingModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [action, setAction] = useState('')
  const [shortcut, setShortcut] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const current = await api.keybindings.get()
      const updated = { ...current.data, [action.trim()]: shortcut }
      return api.keybindings.update({ data: updated, last_mtime: current.last_mtime })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keybindings'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-96">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-100">Add Keybinding</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">action</label>
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="openFile"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">shortcut</label>
            <input
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder="Ctrl+P"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !action.trim() || !shortcut.trim()}
            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            {mutation.isPending ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Keybindings() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editEntry, setEditEntry] = useState<KeybindingEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KeybindingEntry | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['keybindings'], queryFn: api.keybindings.get })

  const deleteMutation = useMutation({
    mutationFn: async (action: string) => {
      if (!data) throw new Error('No data')
      const updated = { ...data.data }
      delete updated[action]
      return api.keybindings.update({ data: updated, last_mtime: data.last_mtime })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keybindings'] })
      setDeleteTarget(null)
    },
  })

  const entries = data ? dataToEntries(data.data) : []

  return (
    <div>
      <PageHeader title="Keybindings" subtitle="Manage keyboard shortcuts">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
        >
          <Plus size={13} strokeWidth={2} />
          Add Keybinding
        </button>
      </PageHeader>

      {isLoading ? (
        <p className="text-xs text-zinc-600 font-mono">loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-zinc-600">No keybindings configured.</p>
      ) : (
        <div className="border border-zinc-800 rounded-md overflow-hidden max-w-2xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Action</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Shortcut</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.action}
                  className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-zinc-300">{entry.action}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-0.5">
                      {entry.shortcut.split('+').map((key, i) => (
                        <span key={i} className="flex items-center">
                          {i > 0 && <span className="text-zinc-700 mx-0.5 text-xs">+</span>}
                          <kbd className="px-1.5 py-0.5 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-300 leading-none">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditEntry(entry)}
                        className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={13} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(entry)}
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

      {showAdd && <AddKeybindingModal onClose={() => setShowAdd(false)} />}
      {editEntry && <EditKeybindingModal entry={editEntry} onClose={() => setEditEntry(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-md p-5 w-80">
            <h3 className="text-sm font-medium text-zinc-100 mb-2">Delete keybinding</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Delete <span className="font-mono text-zinc-200">"{deleteTarget.action}"</span>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.action)}
                disabled={deleteMutation.isPending}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded disabled:opacity-50"
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
