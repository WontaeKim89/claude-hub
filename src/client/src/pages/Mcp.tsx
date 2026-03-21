import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, X, Server } from 'lucide-react'
import { api } from '../lib/api-client'
import { TableSkeleton } from '../components/shared/Skeleton'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
import type { McpServer } from '../lib/types'

function envToEntries(env?: Record<string, string>): { key: string; value: string }[] {
  if (!env) return []
  return Object.entries(env).map(([key, value]) => ({ key, value }))
}

function entriesToEnv(entries: { key: string; value: string }[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const { key, value } of entries) {
    if (key.trim()) result[key.trim()] = value
  }
  return result
}

function serversToDict(servers: McpServer[]): Record<string, unknown> {
  const dict: Record<string, unknown> = {}
  for (const server of servers) {
    const { name, ...rest } = server
    dict[name] = rest
  }
  return dict
}

interface EnvEditorProps {
  entries: { key: string; value: string }[]
  onChange: (entries: { key: string; value: string }[]) => void
}

function EnvEditor({ entries, onChange }: EnvEditorProps) {
  return (
    <div className="space-y-1.5">
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={entry.key}
            onChange={(e) => {
              const updated = entries.map((en, idx) => idx === i ? { ...en, key: e.target.value } : en)
              onChange(updated)
            }}
            placeholder="KEY"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
          />
          <input
            value={entry.value}
            onChange={(e) => {
              const updated = entries.map((en, idx) => idx === i ? { ...en, value: e.target.value } : en)
              onChange(updated)
            }}
            placeholder="value"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
          />
          <button
            onClick={() => onChange(entries.filter((_, idx) => idx !== i))}
            className="text-zinc-600 hover:text-red-400 px-1 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...entries, { key: '', value: '' }])}
        className="text-xs font-mono text-teal-500 hover:text-teal-400 transition-colors"
      >
        + add env var
      </button>
    </div>
  )
}

interface ServerFormState {
  name: string
  command: string
  args: string
  envEntries: { key: string; value: string }[]
}

function AddServerModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<ServerFormState>({ name: '', command: '', args: '', envEntries: [] })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const current = await api.mcp.get()
      const newServer: McpServer = {
        name: form.name.trim(),
        command: form.command.trim(),
        args: form.args ? form.args.split(',').map((a) => a.trim()).filter(Boolean) : [],
        env: entriesToEnv(form.envEntries),
      }
      return api.mcp.update({
        servers: serversToDict([...current.servers, newServer]),
        last_mtime: current.last_mtime,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[540px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-100">Add MCP Server</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="github"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">command</label>
            <input
              value={form.command}
              onChange={(e) => setForm({ ...form, command: e.target.value })}
              placeholder="npx"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">args (comma-separated)</label>
            <input
              value={form.args}
              onChange={(e) => setForm({ ...form, args: e.target.value })}
              placeholder="-y, @modelcontextprotocol/server-github"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">env</label>
            <EnvEditor
              entries={form.envEntries}
              onChange={(envEntries) => setForm({ ...form, envEntries })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name.trim() || !form.command.trim()}
            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            {mutation.isPending ? 'Adding...' : 'Add Server'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditServerModal({ server, onClose }: { server: McpServer; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: mcpData } = useQuery({ queryKey: ['mcp'], queryFn: api.mcp.get })
  const [form, setForm] = useState<ServerFormState>({
    name: server.name,
    command: server.command,
    args: server.args?.join(', ') ?? '',
    envEntries: envToEntries(server.env),
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      if (!mcpData) throw new Error('No data')
      const updatedServer: McpServer = {
        name: server.name,
        command: form.command.trim(),
        args: form.args ? form.args.split(',').map((a) => a.trim()).filter(Boolean) : [],
        env: entriesToEnv(form.envEntries),
      }
      const updatedServers = mcpData.servers.map((s) =>
        s.name === server.name ? updatedServer : s
      )
      return api.mcp.update({ servers: serversToDict(updatedServers), last_mtime: mcpData.last_mtime })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[540px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-100 font-mono">{server.name}</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">command</label>
            <input
              value={form.command}
              onChange={(e) => setForm({ ...form, command: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">args (comma-separated)</label>
            <input
              value={form.args}
              onChange={(e) => setForm({ ...form, args: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">env</label>
            <p className="text-xs text-zinc-600 mb-2 font-mono">masked values (***) will be preserved</p>
            <EnvEditor
              entries={form.envEntries}
              onChange={(envEntries) => setForm({ ...form, envEntries })}
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

export default function Mcp() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editServer, setEditServer] = useState<McpServer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<McpServer | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['mcp'], queryFn: api.mcp.get })

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!data) throw new Error('No data')
      const updatedServers = data.servers.filter((s) => s.name !== name)
      return api.mcp.update({
        servers: serversToDict(updatedServers),
        last_mtime: data.last_mtime,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp'] })
      setDeleteTarget(null)
    },
  })

  const servers = data?.servers ?? []

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-1.5">
          <div>
            <h2 className="text-base font-semibold text-zinc-100 tracking-tight">MCP Servers</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Manage Model Context Protocol servers</p>
          </div>
          <InfoTooltip {...CATEGORY_INFO.mcp} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
          >
            <Plus size={13} strokeWidth={2} />
            Add Server
          </button>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Server size={24} strokeWidth={1} className="text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No MCP servers configured.</p>
          <p className="text-xs text-zinc-600 mt-1">Add a server to connect external tools via MCP.</p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Command</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Env</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {servers.map((server) => (
                <tr
                  key={server.name}
                  className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/30 transition-colors duration-150"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-zinc-200">{server.name}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-500">
                    {server.command} {server.args?.join(' ')}
                  </td>
                  <td className="px-4 py-3">
                    {server.env && Object.keys(server.env).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(server.env).map((k) => (
                          <span
                            key={k}
                            className="font-mono text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded text-xs"
                          >
                            {k}=<span className="text-amber-600">***</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditServer(server)}
                        className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={13} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(server)}
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

      {showAdd && <AddServerModal onClose={() => setShowAdd(false)} />}
      {editServer && <EditServerModal server={editServer} onClose={() => setEditServer(null)} />}

      {deleteTarget && (
        <DangerDeleteDialog
          title={`'${deleteTarget.name}' MCP 서버를 삭제하시겠습니까?`}
          confirmText={deleteTarget.name}
          onConfirm={() => deleteMutation.mutate(deleteTarget.name)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
