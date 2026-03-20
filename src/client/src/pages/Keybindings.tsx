import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'

interface KeybindingEntry {
  action: string
  shortcut: string
}

// Record<string, string>을 편집 가능한 배열로 변환
function dataToEntries(data: Record<string, string>): KeybindingEntry[] {
  return Object.entries(data).map(([action, shortcut]) => ({ action, shortcut }))
}

interface EditKeybindingModalProps {
  entry: KeybindingEntry
  onClose: () => void
}

function EditKeybindingModal({ entry, onClose }: EditKeybindingModalProps) {
  const qc = useQueryClient()
  const { data: kbData } = useQuery({ queryKey: ['keybindings'], queryFn: api.keybindings.get })
  const [shortcut, setShortcut] = useState(entry.shortcut)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      if (!kbData) throw new Error('데이터를 불러올 수 없습니다.')
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-96">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-100">Edit Keybinding</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-400/10 rounded p-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Action</label>
            <input
              value={entry.action}
              readOnly
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-500 font-mono cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Shortcut</label>
            <input
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder="Ctrl+Shift+P"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-96">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-100">Add Keybinding</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-400/10 rounded p-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Action</label>
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="openFile"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Shortcut</label>
            <input
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder="Ctrl+P"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !action.trim() || !shortcut.trim()}
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md disabled:opacity-50"
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
      if (!data) throw new Error('데이터를 불러올 수 없습니다.')
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
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md"
        >
          + Add Keybinding
        </button>
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No keybindings configured.</p>
      ) : (
        <div className="max-w-2xl bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Shortcut</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.action} className="border-b border-zinc-800/50 last:border-0">
                  <td className="px-4 py-3 text-zinc-100 font-mono text-xs">{entry.action}</td>
                  <td className="px-4 py-3">
                    <kbd className="px-2 py-0.5 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-300">
                      {entry.shortcut}
                    </kbd>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditEntry(entry)}
                        className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(entry)}
                        className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md"
                      >
                        Delete
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-80">
            <h3 className="text-sm font-medium text-zinc-100 mb-2">Delete keybinding</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Are you sure you want to delete <span className="text-zinc-100 font-mono">"{deleteTarget.action}"</span>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.action)}
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
