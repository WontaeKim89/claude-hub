import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, X, Bot } from 'lucide-react'
import { api } from '../lib/api-client'
import { Badge } from '../components/shared/Badge'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import { TableSkeleton } from '../components/shared/Skeleton'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
import type { AgentSummary, AgentDetail } from '../lib/types'

function NewAgentModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('sonnet')
  const [tools, setTools] = useState('Read, Grep, Glob, Bash')
  const [maxTurns, setMaxTurns] = useState(15)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.agents.create({ name, description, model, tools, max_turns: maxTurns, content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[680px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-100">New Agent</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-zinc-500 mb-1.5">name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
                placeholder="my-agent"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-zinc-500 mb-1.5">model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="sonnet">claude-sonnet</option>
                <option value="opus">claude-opus</option>
                <option value="haiku">claude-haiku</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50"
              placeholder="What does this agent do?"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-zinc-500 mb-1.5">tools (comma-separated)</label>
              <input
                value={tools}
                onChange={(e) => setTools(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
                placeholder="Read, Grep, Bash"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-zinc-500 mb-1.5">max_turns</label>
              <input
                type="number"
                value={maxTurns}
                onChange={(e) => setMaxTurns(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
                min={1}
                max={100}
              />
            </div>
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">prompt content</label>
            <MonacoWrapper value={content} onChange={setContent} height="200px" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim()}
            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditAgentModal({ agent, onClose }: { agent: AgentSummary; onClose: () => void }) {
  const qc = useQueryClient()
  const { data } = useQuery<AgentDetail>({
    queryKey: ['agent', agent.name],
    queryFn: () => api.agents.get(agent.name),
  })
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  const editorValue = content || data?.content || ''

  const mutation = useMutation({
    mutationFn: () => api.agents.update(agent.name, editorValue),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      qc.invalidateQueries({ queryKey: ['agent', agent.name] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[720px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <div>
            <span className="text-sm font-medium text-zinc-100 font-mono">{agent.name}</span>
            {agent.description && (
              <p className="text-xs text-zinc-600 mt-0.5">{agent.description}</p>
            )}
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
            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Agents() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [editAgent, setEditAgent] = useState<AgentSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AgentSummary | null>(null)

  const { data: agents = [], isLoading } = useQuery<AgentSummary[]>({
    queryKey: ['agents'],
    queryFn: () => api.agents.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.agents.delete(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      setDeleteTarget(null)
    },
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-1.5">
          <div>
            <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Agents</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Manage your claude sub-agents</p>
          </div>
          <InfoTooltip {...CATEGORY_INFO.agents} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
          >
            <Plus size={13} strokeWidth={2} />
            New Agent
          </button>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bot size={24} strokeWidth={1} className="text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No agents found.</p>
          <p className="text-xs text-zinc-600 mt-1">Create an agent to get started.</p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Model</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Tools</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Max Turns</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr
                  key={agent.name}
                  className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/30 transition-colors duration-150"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-zinc-200">{agent.name}</span>
                    {agent.description && (
                      <p className="text-zinc-600 mt-0.5">{agent.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="teal">{agent.model}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {agent.tools.filter(Boolean).map((tool) => (
                        <span key={tool} className="font-mono text-zinc-600">{tool}</span>
                      )).reduce((acc: React.ReactNode[], el, i, arr) => {
                        acc.push(el)
                        if (i < arr.length - 1) acc.push(<span key={`sep-${i}`} className="text-zinc-700">,</span>)
                        return acc
                      }, [])}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-zinc-500">{agent.max_turns}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditAgent(agent)}
                        className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={13} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(agent)}
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

      {showNew && <NewAgentModal onClose={() => setShowNew(false)} />}
      {editAgent && <EditAgentModal agent={editAgent} onClose={() => setEditAgent(null)} />}

      {deleteTarget && (
        <DangerDeleteDialog
          title={`'${deleteTarget.name}' 에이전트를 삭제하시겠습니까?`}
          confirmText={deleteTarget.name}
          onConfirm={() => deleteMutation.mutate(deleteTarget.name)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
