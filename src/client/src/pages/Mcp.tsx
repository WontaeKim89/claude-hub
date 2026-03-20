import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import type { McpServer } from '../lib/types'

// env 딕셔너리를 key-value 배열로 변환 (편집용)
function envToEntries(env?: Record<string, string>): { key: string; value: string }[] {
  if (!env) return []
  return Object.entries(env).map(([key, value]) => ({ key, value }))
}

// key-value 배열을 env 딕셔너리로 변환
function entriesToEnv(entries: { key: string; value: string }[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const { key, value } of entries) {
    if (key.trim()) result[key.trim()] = value
  }
  return result
}

// 서버 목록을 API 전송용 딕셔너리로 변환 (name 필드 제거)
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
  function updateEntry(index: number, field: 'key' | 'value', val: string) {
    const updated = entries.map((e, i) => (i === index ? { ...e, [field]: val } : e))
    onChange(updated)
  }

  function addEntry() {
    onChange([...entries, { key: '', value: '' }])
  }

  function removeEntry(index: number) {
    onChange(entries.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={entry.key}
            onChange={(e) => updateEntry(i, 'key', e.target.value)}
            placeholder="KEY"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
          />
          <input
            value={entry.value}
            onChange={(e) => updateEntry(i, 'value', e.target.value)}
            placeholder="value"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => removeEntry(i)}
            className="px-2 text-zinc-500 hover:text-red-400 text-sm"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        onClick={addEntry}
        className="text-xs text-indigo-400 hover:text-indigo-300"
      >
        + Add env var
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
  const [form, setForm] = useState<ServerFormState>({
    name: '',
    command: '',
    args: '',
    envEntries: [],
  })
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
      const updatedServers = [...current.servers, newServer]
      return api.mcp.update({
        servers: serversToDict(updatedServers),
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[560px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-100">Add MCP Server</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-sm text-red-400 bg-red-400/10 rounded p-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="github"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Command</label>
            <input
              value={form.command}
              onChange={(e) => setForm({ ...form, command: e.target.value })}
              placeholder="npx"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Args (comma-separated)</label>
            <input
              value={form.args}
              onChange={(e) => setForm({ ...form, args: e.target.value })}
              placeholder="-y, @modelcontextprotocol/server-github"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Environment Variables</label>
            <EnvEditor
              entries={form.envEntries}
              onChange={(envEntries) => setForm({ ...form, envEntries })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name.trim() || !form.command.trim()}
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md disabled:opacity-50"
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
      if (!mcpData) throw new Error('데이터를 불러올 수 없습니다.')
      const updatedServer: McpServer = {
        name: server.name,
        command: form.command.trim(),
        args: form.args ? form.args.split(',').map((a) => a.trim()).filter(Boolean) : [],
        env: entriesToEnv(form.envEntries),
      }
      const updatedServers = mcpData.servers.map((s) =>
        s.name === server.name ? updatedServer : s
      )
      return api.mcp.update({
        servers: serversToDict(updatedServers),
        last_mtime: mcpData.last_mtime,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[560px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-100">Edit: {server.name}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-sm text-red-400 bg-red-400/10 rounded p-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Command</label>
            <input
              value={form.command}
              onChange={(e) => setForm({ ...form, command: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Args (comma-separated)</label>
            <input
              value={form.args}
              onChange={(e) => setForm({ ...form, args: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Environment Variables</label>
            <p className="text-xs text-zinc-500 mb-2">마스킹된 값(***) 그대로 두면 기존 값이 유지됩니다.</p>
            <EnvEditor
              entries={form.envEntries}
              onChange={(envEntries) => setForm({ ...form, envEntries })}
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

export default function Mcp() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editServer, setEditServer] = useState<McpServer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<McpServer | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['mcp'], queryFn: api.mcp.get })

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!data) throw new Error('데이터를 불러올 수 없습니다.')
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
      <PageHeader title="MCP Servers" subtitle="Manage Model Context Protocol servers">
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md"
        >
          + Add Server
        </button>
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : servers.length === 0 ? (
        <p className="text-sm text-zinc-500">No MCP servers configured.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 max-w-3xl">
          {servers.map((server) => (
            <div
              key={server.name}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 border-l-2 border-l-violet-500"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-sm font-medium text-zinc-100">{server.name}</span>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">
                    {server.command} {server.args?.join(' ')}
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-violet-500/20 text-violet-400 shrink-0">
                  MCP
                </span>
              </div>

              {server.env && Object.keys(server.env).length > 0 && (
                <div className="mb-3 space-y-1">
                  {Object.entries(server.env).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-zinc-400">{k}</span>
                      <span className="text-zinc-600">=</span>
                      <span className="text-amber-400">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setEditServer(server)}
                  className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(server)}
                  className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddServerModal onClose={() => setShowAdd(false)} />}
      {editServer && <EditServerModal server={editServer} onClose={() => setEditServer(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-80">
            <h3 className="text-sm font-medium text-zinc-100 mb-2">Delete server</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Are you sure you want to delete <span className="text-zinc-100">"{deleteTarget.name}"</span>? This cannot be undone.
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
