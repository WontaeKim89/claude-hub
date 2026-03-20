import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
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

// hooks dict를 평탄한 행 목록으로 변환
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

// 평탄한 행 목록에서 hooks dict 재구성
function buildHooksDict(rows: FlatHook[]): Record<string, HookEntry[]> {
  const result: Record<string, HookEntry[]> = {}
  for (const row of rows) {
    if (!result[row.eventType]) {
      result[row.eventType] = []
    }
    // entryIndex 기준으로 entry 찾거나 새로 생성
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
  // undefined 슬롯 제거
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[480px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">
            &times;
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Event Type</label>
            <select
              value={form.eventType}
              onChange={(e) => setForm({ ...form, eventType: e.target.value as HookEventType })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Matcher <span className="text-zinc-600">(optional regex)</span>
            </label>
            <input
              value={form.matcher}
              onChange={(e) => setForm({ ...form, matcher: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              placeholder="e.g. Bash|Edit"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Command</label>
            <input
              value={form.command}
              onChange={(e) => setForm({ ...form, command: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm font-mono text-zinc-100 focus:outline-none focus:border-indigo-500"
              placeholder="e.g. echo hello"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Timeout (ms) <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              type="number"
              value={form.timeout}
              onChange={(e) => setForm({ ...form, timeout: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              placeholder="e.g. 2000"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.command.trim()}
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md disabled:opacity-50"
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
    const updated = buildHooksDict([...rows, newRow])
    saveMutation.mutate(updated as Record<string, HookEntry[]>)
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
  }

  return (
    <div>
      <PageHeader title="Hooks" subtitle="Event-driven shell commands for Claude lifecycle events">
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md"
        >
          + Add Hook
        </button>
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No hooks configured.</p>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Event Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Matcher
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Command
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Timeout (ms)
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={`${row.eventType}-${row.entryIndex}-${row.hookIndex}`}
                  className={i % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/30'}
                >
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
                      {row.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 font-mono text-xs">
                    {row.matcher || <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-100 font-mono text-xs">{row.command}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {row.timeout > 0 ? row.timeout : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditTarget(row)}
                        className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        disabled={saveMutation.isPending}
                        className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md disabled:opacity-50"
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
    </div>
  )
}
