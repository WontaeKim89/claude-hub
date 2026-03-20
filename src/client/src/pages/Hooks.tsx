import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, X, Webhook } from 'lucide-react'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/shared/Badge'
import { TableSkeleton } from '../components/shared/Skeleton'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
import type { HooksData, HookEntry, HookEventType } from '../lib/types'

const EVENT_TYPES: HookEventType[] = [
  'SessionStart',
  'SessionEnd',
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'PermissionRequest',
  'Notification',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
]

interface FlatHook {
  eventType: string
  entryIndex: number
  hookIndex: number
  matcher: string
  command: string
  timeout: number
}

function flattenHooks(hooks: Record<string, HookEntry[]>): FlatHook[] {
  const rows: FlatHook[] = []
  for (const [eventType, entries] of Object.entries(hooks)) {
    entries.forEach((entry, entryIndex) => {
      entry.hooks.forEach((h, hookIndex) => {
        rows.push({
          eventType,
          entryIndex,
          hookIndex,
          matcher: entry.matcher ?? '',
          command: h.command,
          timeout: h.timeout ?? 0,
        })
      })
    })
  }
  return rows
}

function buildHooksDict(rows: FlatHook[]): Record<string, HookEntry[]> {
  const result: Record<string, HookEntry[]> = {}
  for (const row of rows) {
    if (!result[row.eventType]) result[row.eventType] = []
    let entry = result[row.eventType][row.entryIndex]
    if (!entry) {
      entry = { hooks: [] }
      if (row.matcher) entry.matcher = row.matcher
      result[row.eventType][row.entryIndex] = entry
    }
    entry.hooks.push({
      type: 'command',
      command: row.command,
      ...(row.timeout > 0 ? { timeout: row.timeout } : {}),
    })
  }
  for (const key of Object.keys(result)) {
    result[key] = result[key].filter(Boolean)
  }
  return result
}

interface HookFormState {
  eventType: HookEventType
  matcher: string
  command: string
  timeout: string
}

const DEFAULT_FORM: HookFormState = {
  eventType: 'SessionStart',
  matcher: '',
  command: '',
  timeout: '',
}

function HookFormModal({
  initial,
  title,
  onSave,
  onClose,
}: {
  initial: HookFormState
  title: string
  onSave: (form: HookFormState) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<HookFormState>(initial)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[480px]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-100">{title}</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">event_type</label>
            <select
              value={form.eventType}
              onChange={(e) => setForm({ ...form, eventType: e.target.value as HookEventType })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">
              matcher <span className="text-zinc-700">(optional regex)</span>
            </label>
            <input
              value={form.matcher}
              onChange={(e) => setForm({ ...form, matcher: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
              placeholder="Bash|Edit"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">command</label>
            <input
              value={form.command}
              onChange={(e) => setForm({ ...form, command: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-100 focus:outline-none focus:border-emerald-500/50"
              placeholder="echo hello"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">
              timeout_ms <span className="text-zinc-700">(optional)</span>
            </label>
            <input
              type="number"
              value={form.timeout}
              onChange={(e) => setForm({ ...form, timeout: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-100 focus:outline-none focus:border-emerald-500/50"
              placeholder="2000"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.command.trim()}
            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Hooks() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<FlatHook | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FlatHook | null>(null)

  const { data, isLoading } = useQuery<HooksData>({
    queryKey: ['hooks'],
    queryFn: () => api.hooks.get(),
  })

  const saveMutation = useMutation({
    mutationFn: (hooks: Record<string, HookEntry[]>) => {
      if (!data) throw new Error('No data')
      return api.hooks.update({ hooks: hooks as Record<string, unknown>, last_mtime: data.last_mtime })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hooks'] })
    },
  })

  const rows = data ? flattenHooks(data.hooks) : []

  function handleAdd(form: HookFormState) {
    const newRow: FlatHook = {
      eventType: form.eventType,
      entryIndex: rows.filter((r) => r.eventType === form.eventType).length,
      hookIndex: 0,
      matcher: form.matcher,
      command: form.command,
      timeout: form.timeout ? parseInt(form.timeout, 10) : 0,
    }
    saveMutation.mutate(buildHooksDict([...rows, newRow]) as Record<string, HookEntry[]>)
    setShowAdd(false)
  }

  function handleEdit(form: HookFormState) {
    if (!editTarget) return
    const updated = rows.map((r) => {
      if (
        r.eventType === editTarget.eventType &&
        r.entryIndex === editTarget.entryIndex &&
        r.hookIndex === editTarget.hookIndex
      ) {
        return {
          ...r,
          eventType: form.eventType,
          matcher: form.matcher,
          command: form.command,
          timeout: form.timeout ? parseInt(form.timeout, 10) : 0,
        }
      }
      return r
    })
    saveMutation.mutate(buildHooksDict(updated) as Record<string, HookEntry[]>)
    setEditTarget(null)
  }

  function handleDelete(target: FlatHook) {
    const updated = rows.filter(
      (r) =>
        !(
          r.eventType === target.eventType &&
          r.entryIndex === target.entryIndex &&
          r.hookIndex === target.hookIndex
        )
    )
    saveMutation.mutate(buildHooksDict(updated) as Record<string, HookEntry[]>)
    setDeleteTarget(null)
  }

  return (
    <div>
      <PageHeader title="Hooks" subtitle="Event-driven shell commands for Claude lifecycle events">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
        >
          <Plus size={13} strokeWidth={2} />
          Add Hook
        </button>
      </PageHeader>

      {isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Webhook size={24} strokeWidth={1} className="text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No hooks configured.</p>
          <p className="text-xs text-zinc-600 mt-1">Add a hook to run commands on Claude lifecycle events.</p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Event</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Matcher</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Command</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Timeout</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.eventType}-${row.entryIndex}-${row.hookIndex}`}
                  className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/30 transition-colors duration-150"
                >
                  <td className="px-4 py-3">
                    <Badge variant="zinc">{row.eventType}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-500">
                    {row.matcher || <span className="text-zinc-700">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-300 max-w-xs truncate">
                    {row.command}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-500">
                    {row.timeout > 0 ? row.timeout : <span className="text-zinc-700">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditTarget(row)}
                        className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={13} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(row)}
                        disabled={saveMutation.isPending}
                        className="p-1 text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50"
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

      {showAdd && (
        <HookFormModal
          initial={DEFAULT_FORM}
          title="Add Hook"
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editTarget && (
        <HookFormModal
          initial={{
            eventType: editTarget.eventType as HookEventType,
            matcher: editTarget.matcher,
            command: editTarget.command,
            timeout: editTarget.timeout > 0 ? String(editTarget.timeout) : '',
          }}
          title="Edit Hook"
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <DangerDeleteDialog
          title={`'${deleteTarget.eventType}' 훅을 삭제하시겠습니까?`}
          confirmText={deleteTarget.eventType}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
