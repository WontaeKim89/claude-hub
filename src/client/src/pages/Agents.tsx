import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[700px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-100">New Agent</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-sm text-red-400 bg-red-400/10 rounded p-2">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                placeholder="my-agent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="sonnet">claude-sonnet</option>
                <option value="opus">claude-opus</option>
                <option value="haiku">claude-haiku</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              placeholder="What does this agent do?"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Tools (comma-separated)</label>
              <input
                value={tools}
                onChange={(e) => setTools(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                placeholder="Read, Grep, Bash"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Max Turns</label>
              <input
                type="number"
                value={maxTurns}
                onChange={(e) => setMaxTurns(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                min={1}
                max={100}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Prompt Content</label>
            <MonacoWrapper value={content} onChange={setContent} height="200px" />
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[700px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-sm font-medium text-zinc-100">{agent.name}</h3>
            <p className="text-xs text-zinc-500">{agent.description}</p>
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
      <PageHeader title="Agents" subtitle="Manage your claude sub-agents">
        <button
          onClick={() => setShowNew(true)}
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md"
        >
          + New Agent
        </button>
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-zinc-500">No agents found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 border-l-2 border-l-violet-500"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-sm font-medium text-zinc-100">{agent.name}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-violet-500/20 text-violet-400">
                  {agent.model}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mb-2 line-clamp-2">{agent.description}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {agent.tools.filter(Boolean).map((tool) => (
                  <span
                    key={tool}
                    className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400"
                  >
                    {tool}
                  </span>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mb-3">Max turns: {agent.max_turns}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditAgent(agent)}
                  className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(agent)}
                  className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && <NewAgentModal onClose={() => setShowNew(false)} />}
      {editAgent && <EditAgentModal agent={editAgent} onClose={() => setEditAgent(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-80">
            <h3 className="text-sm font-medium text-zinc-100 mb-2">Delete agent</h3>
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
