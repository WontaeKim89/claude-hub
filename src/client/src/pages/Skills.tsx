import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit2, Trash2, Eye, X } from 'lucide-react'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/shared/Badge'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import type { SkillSummary, SkillDetail } from '../lib/types'

type FilterTab = 'all' | 'custom' | 'plugin'

function NewSkillModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.skills.create({ name, description, content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[680px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-100">New Skill</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
              placeholder="my-skill"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50"
              placeholder="What does this skill do?"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">content (SKILL.md)</label>
            <MonacoWrapper value={content} onChange={setContent} height="280px" />
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

function EditSkillModal({ skill, onClose }: { skill: SkillSummary; onClose: () => void }) {
  const qc = useQueryClient()
  const { data } = useQuery<SkillDetail>({
    queryKey: ['skill', skill.name],
    queryFn: () => api.skills.get(skill.name),
  })
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  const editorValue = content || data?.content || ''
  const isReadOnly = data && !data.editable

  const mutation = useMutation({
    mutationFn: () => api.skills.update(skill.name, editorValue),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] })
      qc.invalidateQueries({ queryKey: ['skill', skill.name] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[720px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <div>
            <span className="text-sm font-medium text-zinc-100 font-mono">{skill.name}</span>
            {data?.path && (
              <p className="text-xs text-zinc-600 font-mono mt-0.5">{data.path}</p>
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
            Close
          </button>
          {!isReadOnly && (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DeleteConfirm({ name, onConfirm, onCancel, isPending }: {
  name: string
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md p-5 w-80">
        <h3 className="text-sm font-medium text-zinc-100 mb-2">Delete skill</h3>
        <p className="text-xs text-zinc-400 mb-4">
          Delete <span className="font-mono text-zinc-200">"{name}"</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded disabled:opacity-50"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Skills() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editSkill, setEditSkill] = useState<SkillSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SkillSummary | null>(null)

  const { data: skills = [], isLoading } = useQuery<SkillSummary[]>({
    queryKey: ['skills'],
    queryFn: () => api.skills.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.skills.delete(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] })
      setDeleteTarget(null)
    },
  })

  const filtered = skills
    .filter((s) => {
      if (filter === 'custom') return s.source === 'custom'
      if (filter === 'plugin') return s.source !== 'custom'
      return true
    })
    .filter((s) => {
      if (!search) return true
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    })

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'custom', label: 'Custom' },
    { key: 'plugin', label: 'Plugin' },
  ]

  return (
    <div>
      <PageHeader title="Skills" subtitle="Manage your claude skills">
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
        >
          <Plus size={13} strokeWidth={2} />
          New Skill
        </button>
      </PageHeader>

      {/* Filter + Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-0.5 bg-zinc-900 border border-zinc-800 rounded p-0.5">
          {filterTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                filter === t.key
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="bg-zinc-900 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 w-52"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-xs text-zinc-600 font-mono">loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-zinc-600">No skills found.</p>
      ) : (
        <div className="border border-zinc-800 rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Source</th>
                <th className="text-left px-4 py-2.5 font-mono text-zinc-600 uppercase tracking-wider font-medium">Invoke</th>
                <th className="px-4 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((skill) => {
                const isCustom = skill.source === 'custom'
                return (
                  <tr
                    key={skill.name}
                    className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-zinc-200">{skill.name}</span>
                      {skill.description && (
                        <p className="text-zinc-600 mt-0.5 text-xs">{skill.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={isCustom ? 'emerald' : 'zinc'}>
                        {isCustom ? 'custom' : skill.source}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <code className="font-mono text-zinc-500 text-xs">{skill.invoke_command}</code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditSkill(skill)}
                          className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                          title={isCustom ? 'Edit' : 'View'}
                        >
                          {isCustom ? <Edit2 size={13} strokeWidth={1.5} /> : <Eye size={13} strokeWidth={1.5} />}
                        </button>
                        {isCustom && (
                          <button
                            onClick={() => setDeleteTarget(skill)}
                            className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewSkillModal onClose={() => setShowNew(false)} />}
      {editSkill && <EditSkillModal skill={editSkill} onClose={() => setEditSkill(null)} />}
      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={() => deleteMutation.mutate(deleteTarget.name)}
          onCancel={() => setDeleteTarget(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
