import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import type { SkillSummary, SkillDetail } from '../lib/types'

type FilterTab = 'all' | 'custom' | 'plugin'

// 새 스킬 생성 폼
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[700px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-100">New Skill</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-sm text-red-400 bg-red-400/10 rounded p-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              placeholder="my-skill"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              placeholder="What does this skill do?"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Content (SKILL.md)</label>
            <MonacoWrapper value={content} onChange={setContent} height="300px" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
          >
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

// 스킬 편집 모달
function EditSkillModal({ skill, onClose }: { skill: SkillSummary; onClose: () => void }) {
  const qc = useQueryClient()
  const { data } = useQuery<SkillDetail>({
    queryKey: ['skill', skill.name],
    queryFn: () => api.skills.get(skill.name),
  })
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  // data 로드 후 초기화
  const editorValue = content || data?.content || ''

  const mutation = useMutation({
    mutationFn: () => api.skills.update(skill.name, editorValue),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] })
      qc.invalidateQueries({ queryKey: ['skill', skill.name] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const isReadOnly = data && !data.editable

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[700px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-sm font-medium text-zinc-100">{skill.name}</h3>
            <p className="text-xs text-zinc-500">{skill.path}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-hidden">
          {data ? (
            <MonacoWrapper
              value={editorValue}
              onChange={setContent}
              height="450px"
            />
          ) : (
            <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">Loading...</div>
          )}
        </div>
        {error && <p className="text-sm text-red-400 px-5 py-2">{error}</p>}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
            Cancel
          </button>
          {!isReadOnly && (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
          )}
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
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md"
        >
          + New Skill
        </button>
      </PageHeader>

      {/* Filter + Search */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-1">
          {filterTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1 text-sm rounded ${
                filter === t.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills..."
          className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 w-60"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No skills found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((skill) => {
            const isCustom = skill.source === 'custom'
            return (
              <div
                key={skill.name}
                className={`bg-zinc-900 border border-zinc-800 rounded-lg p-4 ${
                  isCustom ? 'border-l-2 border-l-indigo-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-zinc-100">{skill.name}</span>
                  {isCustom ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
                      CUSTOM
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                      {skill.source}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mb-2 line-clamp-2">{skill.description}</p>
                <p className="text-xs font-mono text-zinc-500 mb-3">{skill.invoke_command}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditSkill(skill)}
                    className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md"
                  >
                    {isCustom ? 'Edit' : 'View'}
                  </button>
                  {isCustom && (
                    <button
                      onClick={() => setDeleteTarget(skill)}
                      className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showNew && <NewSkillModal onClose={() => setShowNew(false)} />}
      {editSkill && <EditSkillModal skill={editSkill} onClose={() => setEditSkill(null)} />}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-80">
            <h3 className="text-sm font-medium text-zinc-100 mb-2">Delete skill</h3>
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
