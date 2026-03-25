import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import { api } from '../lib/api-client'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'

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
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-fuchsia-500/50"
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
            className="px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded disabled:opacity-50"
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
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-fuchsia-500/50"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">shortcut</label>
            <input
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder="Ctrl+P"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-fuchsia-500/50"
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
            className="px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded disabled:opacity-50"
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
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-1.5">
          <div>
            <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Keybindings</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Manage keyboard shortcuts</p>
          </div>
          <InfoTooltip {...CATEGORY_INFO.keybindings} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors"
          >
            <Plus size={13} strokeWidth={2} />
            Add Keybinding
          </button>
        </div>
      </div>

      {/* 키바인딩 기능 설명 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-md p-5 mb-6 max-w-2xl">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">키바인딩이란?</h3>
        <p className="text-xs text-zinc-400 leading-relaxed mb-3">
          Claude Code CLI에서 사용하는 <span className="text-zinc-200">키보드 단축키</span>를 커스터마이징하는 기능입니다.
          자주 사용하는 동작에 원하는 키 조합을 매핑하여 작업 효율을 높일 수 있습니다.
        </p>
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
          설정 파일: <code className="font-mono text-fuchsia-400 bg-zinc-800 px-1.5 py-0.5 rounded text-[11px]">~/.claude/keybindings.json</code>
        </p>

        <h4 className="text-xs font-semibold text-zinc-300 mb-2">사용 예시</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex gap-0.5 shrink-0">
              <kbd className="px-1.5 py-0.5 font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-[11px]">Ctrl</kbd>
              <span className="text-zinc-700 mx-0.5">+</span>
              <kbd className="px-1.5 py-0.5 font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-[11px]">L</kbd>
            </div>
            <span className="text-zinc-500">→</span>
            <span className="text-zinc-400">채팅 히스토리 초기화</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex gap-0.5 shrink-0">
              <kbd className="px-1.5 py-0.5 font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-[11px]">Ctrl</kbd>
              <span className="text-zinc-700 mx-0.5">+</span>
              <kbd className="px-1.5 py-0.5 font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-[11px]">R</kbd>
            </div>
            <span className="text-zinc-500">→</span>
            <span className="text-zinc-400">이전 세션 resume</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex gap-0.5 shrink-0">
              <kbd className="px-1.5 py-0.5 font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-[11px]">Escape</kbd>
            </div>
            <span className="text-zinc-500">→</span>
            <span className="text-zinc-400">현재 생성 중단 / 입력 취소</span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800">
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            Action: 바인딩할 동작 이름 (예: clearHistory, resume, cancel) &nbsp;|&nbsp;
            Shortcut: 키 조합 (예: Ctrl+L, Ctrl+Shift+P)
          </p>
        </div>
      </div>

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
