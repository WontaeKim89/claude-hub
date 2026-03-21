import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit2, Trash2, Eye, X, Sparkles, BarChart2 } from 'lucide-react'
import { api } from '../lib/api-client'
import { Badge } from '../components/shared/Badge'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import { TableSkeleton } from '../components/shared/Skeleton'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
import { useLang } from '../hooks/useLang'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import { AnalysisPanel } from '../components/analysis/AnalysisPanel'
import type { SkillSummary, SkillDetail } from '../lib/types'

type FilterTab = 'all' | 'custom' | 'installed'

function buildSkillTemplate(name: string, description: string): string {
  return `---
name: ${name}
description: ${description}
---

# ${name}

## 목적
<이 스킬이 해결하는 문제를 설명하세요>

## 트리거 조건
<이 스킬이 언제 사용되어야 하는지 명시하세요>

## 동작
<스킬이 수행할 구체적인 작업 단계를 기술하세요>

## 제약 조건
<하지 말아야 할 것, 주의사항을 명시하세요>
`
}

function NewSkillModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState(() => buildSkillTemplate('', ''))
  const [contentEdited, setContentEdited] = useState(false)
  const [error, setError] = useState('')

  // name/description 변경 시 템플릿 갱신 (사용자가 직접 수정하지 않은 경우에만)
  useEffect(() => {
    if (!contentEdited) {
      setContent(buildSkillTemplate(name, description))
    }
  }, [name, description, contentEdited])

  const handleContentChange = (val: string) => {
    setContentEdited(true)
    setContent(val)
  }

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
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-mono text-xs text-zinc-500">content (SKILL.md)</label>
              <span className="text-[10px] text-emerald-500/70 font-mono">
                Claude 공식 스킬 포맷 기반 템플릿이 적용되었습니다
              </span>
            </div>
            <MonacoWrapper value={content} onChange={handleContentChange} height="280px" />
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


export default function Skills() {
  const qc = useQueryClient()
  const { t } = useLang()
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editSkill, setEditSkill] = useState<SkillSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SkillSummary | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)

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
      if (filter === 'installed') return s.source === 'installed'
      return true
    })
    .filter((s) => {
      if (!search) return true
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    })

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: t('skills.all') },
    { key: 'custom', label: t('skills.custom') },
    { key: 'installed', label: t('skills.installed') },
  ]

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-1.5">
          <div>
            <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
              {`${t('skills.title')}${!isLoading ? ` (${skills.length})` : ''}`}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">{t('skills.subtitle')}</p>
          </div>
          <InfoTooltip {...CATEGORY_INFO.skills} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnalysis(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-700 hover:bg-purple-600 text-white rounded transition-colors duration-150"
          >
            <BarChart2 size={13} strokeWidth={2} />
            사용량 분석
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors duration-150"
          >
            <Plus size={13} strokeWidth={2} />
            {t('skills.newSkill')}
          </button>
        </div>
      </div>

      {/* Filter + Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-0.5 bg-zinc-900 border border-zinc-800 rounded p-0.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-2.5 py-1 text-xs rounded transition-colors duration-150 ${
                filter === tab.key
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('skills.search')}
            className="bg-zinc-900 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 w-52 transition-colors duration-150"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Sparkles size={24} strokeWidth={1} className="text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No skills found.</p>
          <p className="text-xs text-zinc-600 mt-1">Try a different filter or create a new skill.</p>
        </div>
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
                    className={`border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/30 transition-colors duration-150 ${isCustom ? 'border-l-2 border-l-emerald-500/20' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-zinc-200">{skill.name}</span>
                      {skill.description && (
                        <p className="text-zinc-600 mt-0.5 text-xs">{skill.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={isCustom ? 'emerald' : 'zinc'}>
                        {isCustom ? 'custom' : 'installed'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <code className="font-mono text-zinc-500 text-xs">{skill.invoke_command}</code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditSkill(skill)}
                          className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors duration-150"
                          title={isCustom ? 'Edit' : 'View'}
                        >
                          {isCustom ? <Edit2 size={13} strokeWidth={1.5} /> : <Eye size={13} strokeWidth={1.5} />}
                        </button>
                        {isCustom && (
                          <button
                            onClick={() => setDeleteTarget(skill)}
                            className="p-1 text-zinc-600 hover:text-red-400 transition-colors duration-150"
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
      {showAnalysis && <AnalysisPanel type="skills" onClose={() => setShowAnalysis(false)} />}
      {deleteTarget && (
        <DangerDeleteDialog
          title={`'${deleteTarget.name}' 스킬을 삭제하시겠습니까?`}
          confirmText={deleteTarget.name}
          onConfirm={() => deleteMutation.mutate(deleteTarget.name)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
