import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit2, Trash2, Eye, X, Sparkles, BarChart2, ScanSearch, Loader2 } from 'lucide-react'
import { api } from '../lib/api-client'
import { Badge } from '../components/shared/Badge'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import { TableSkeleton } from '../components/shared/Skeleton'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
import { SaveConfirmDialog } from '../components/shared/SaveConfirmDialog'
import { useLang } from '../hooks/useLang'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import { AnalysisPanel } from '../components/analysis/AnalysisPanel'
import { SkillChat } from '../components/wizard/SkillChat'
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

type NewSkillTab = 'manual' | 'ai'

function ManualSkillForm({
  initialContent,
  onSuccess,
  onClose,
}: {
  initialContent?: string
  onSuccess: () => void
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState(() => initialContent || buildSkillTemplate('', ''))
  const [contentEdited, setContentEdited] = useState(!!initialContent)
  const [error, setError] = useState('')

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
      onSuccess()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="p-5 space-y-4 overflow-y-auto flex-1">
      {error && <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>}
      <div>
        <label className="block font-mono text-xs text-zinc-500 mb-1.5">name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-fuchsia-500/50"
          placeholder="my-skill"
        />
      </div>
      <div>
        <label className="block font-mono text-xs text-zinc-500 mb-1.5">description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-fuchsia-500/50"
          placeholder="What does this skill do?"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="font-mono text-xs text-zinc-500">content (SKILL.md)</label>
          {!contentEdited && (
            <span className="text-[10px] text-fuchsia-500/70 font-mono">
              Claude 공식 스킬 포맷 기반 템플릿이 적용되었습니다
            </span>
          )}
        </div>
        <MonacoWrapper value={content} onChange={handleContentChange} height="280px" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !name.trim()}
          className="px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded disabled:opacity-50"
        >
          {mutation.isPending ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  )
}

function NewSkillModal({ onClose }: { onClose: () => void }) {
  const { t } = useLang()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<NewSkillTab>('manual')
  const [aiGeneratedContent, setAiGeneratedContent] = useState<string | undefined>()

  // AI 생성 스킬을 직접 저장
  const saveMutation = useMutation({
    mutationFn: ({ name, content }: { name: string; content: string }) => {
      // YAML frontmatter에서 description 추출 시도
      const descMatch = content.match(/^description:\s*(.+)$/m)
      const description = descMatch ? descMatch[1].trim() : ''
      return api.skills.create({ name, description, content })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] })
      onClose()
    },
  })

  const handleSwitchToManual = (content: string) => {
    setAiGeneratedContent(content)
    setActiveTab('manual')
  }

  const tabs: { key: NewSkillTab; label: string }[] = [
    { key: 'manual', label: t('wizard.manualWrite') },
    { key: 'ai', label: t('wizard.aiGenerate') },
  ]

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[680px] max-h-[90vh] flex flex-col">
        {/* 헤더 + 탭 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-zinc-100">New Skill</span>
            <div className="flex gap-0.5 bg-zinc-800 rounded p-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-2.5 py-1 text-xs rounded transition-colors duration-150 ${
                    activeTab === tab.key
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'manual' ? (
            <ManualSkillForm
              initialContent={aiGeneratedContent}
              onSuccess={onClose}
              onClose={onClose}
            />
          ) : (
            <SkillChat
              onSave={(name, content) => saveMutation.mutate({ name, content })}
              onSwitchToManual={handleSwitchToManual}
            />
          )}
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
  const [originalContent, setOriginalContent] = useState('')
  const [error, setError] = useState('')
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)

  const editorValue = content || data?.content || ''
  const isReadOnly = data && !data.editable

  // 데이터 로드 시 원본 내용 저장
  useEffect(() => {
    if (data?.content && !originalContent) {
      setOriginalContent(data.content)
    }
  }, [data?.content])

  const mutation = useMutation({
    mutationFn: () => api.skills.update(skill.name, editorValue),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] })
      qc.invalidateQueries({ queryKey: ['skill', skill.name] })
      setShowSaveConfirm(false)
      onClose()
    },
    onError: (e: Error) => {
      setError(e.message)
      setShowSaveConfirm(false)
    },
  })

  return (
    <>
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
                onClick={() => setShowSaveConfirm(true)}
                disabled={mutation.isPending}
                className="px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded disabled:opacity-50"
              >
                {mutation.isPending ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showSaveConfirm && (
        <SaveConfirmDialog
          oldContent={originalContent}
          newContent={editorValue}
          fileName="SKILL.md"
          onConfirm={() => mutation.mutate()}
          onCancel={() => setShowSaveConfirm(false)}
          saving={mutation.isPending}
        />
      )}
    </>
  )
}


// 중복 스킬 비교 팝업
function SkillCompareModal({ skillA, skillB, onClose }: { skillA: string; skillB: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['skill-compare', skillA, skillB],
    queryFn: () => api.skills.compare(skillA, skillB),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[90vw] max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-100">중복 스킬 비교</span>
            {data && (
              <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                data.similarity >= 90 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
              }`}>
                {data.similarity}% 유사
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-zinc-600 text-xs font-mono">Loading...</div>
        ) : data ? (
          <div className="flex-1 overflow-hidden flex">
            {/* 왼쪽 스킬 */}
            <div className="flex-1 flex flex-col border-r border-zinc-800 overflow-hidden">
              <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
                <span className="font-mono text-xs text-fuchsia-400 font-medium">{data.skill_a.name}</span>
                <span className="font-mono text-[10px] text-zinc-600 ml-2">{data.skill_a.source} · {data.skill_a.lines} lines</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <HighlightedContent
                  content={data.skill_a.content}
                  matchingBlocks={data.matching_blocks.map(b => ({ start: b.a_start, size: b.size }))}
                />
              </div>
            </div>
            {/* 오른쪽 스킬 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
                <span className="font-mono text-xs text-violet-400 font-medium">{data.skill_b.name}</span>
                <span className="font-mono text-[10px] text-zinc-600 ml-2">{data.skill_b.source} · {data.skill_b.lines} lines</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <HighlightedContent
                  content={data.skill_b.content}
                  matchingBlocks={data.matching_blocks.map(b => ({ start: b.b_start, size: b.size }))}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// 유사 부분 하이라이트 표시
function HighlightedContent({ content, matchingBlocks }: {
  content: string
  matchingBlocks: Array<{ start: number; size: number }>
}) {
  const lines = content.split('\n')
  const matchSet = new Set<number>()
  for (const block of matchingBlocks) {
    for (let i = block.start; i < block.start + block.size; i++) {
      matchSet.add(i)
    }
  }

  return (
    <pre className="px-4 py-2 text-[11px] font-mono leading-relaxed whitespace-pre-wrap">
      {lines.map((line, i) => (
        <div
          key={i}
          className={matchSet.has(i) ? 'bg-amber-500/8 border-l-2 border-amber-500/30 pl-2 -ml-2' : ''}
        >
          <span className="text-zinc-700 select-none inline-block w-8 text-right mr-3">{i + 1}</span>
          <span className={matchSet.has(i) ? 'text-zinc-300' : 'text-zinc-500'}>{line || ' '}</span>
        </div>
      ))}
    </pre>
  )
}

// 중복 검색 결과 패널
function DuplicateScanPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [compareTarget, setCompareTarget] = useState<{ a: string; b: string } | null>(null)

  const { data: pairs, isLoading } = useQuery({
    queryKey: ['skill-duplicates'],
    queryFn: () => api.skills.duplicates(),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.skills.delete(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] })
      qc.invalidateQueries({ queryKey: ['skill-duplicates'] })
    },
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[700px] max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 shrink-0">
            <div>
              <span className="text-sm font-medium text-zinc-100">중복 스킬 검색 결과</span>
              {pairs && <span className="ml-2 font-mono text-[10px] text-zinc-500">{pairs.length}건 발견</span>}
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
          </div>

          {/* 검사 기준 안내 */}
          <div className="px-5 py-3 border-b border-zinc-800/50 bg-zinc-800/20">
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              설치된 모든 스킬(custom + installed)의 SKILL.md 파일 내용을 1:1 쌍으로 비교합니다.
              텍스트 시퀀스 매칭(SequenceMatcher)으로 유사도를 산출하며,
              <span className="text-amber-400"> 70% 이상</span>이면 주의(yellow),
              <span className="text-red-400"> 90% 이상</span>이면 중복 의심(red)으로 표시합니다.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <Loader2 size={24} className="animate-spin text-fuchsia-500" />
                <p className="text-xs text-zinc-500 font-mono">전체 스킬 쌍 유사도 분석 중...</p>
              </div>
            ) : !pairs || pairs.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xs text-zinc-500">중복 스킬이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {pairs.map((pair, i) => (
                  <div key={i} className="px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${pair.grade === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <span className="font-mono text-xs text-zinc-200">{pair.skill_a}</span>
                        <span className="text-zinc-700 text-xs">vs</span>
                        <span className="font-mono text-xs text-zinc-200">{pair.skill_b}</span>
                      </div>
                      <span className={`font-mono text-xs font-semibold ${pair.grade === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                        {pair.similarity}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-600 mb-2">
                      <span>{pair.source_a}</span>
                      <span>·</span>
                      <span className="truncate max-w-[200px]">{pair.description_a}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCompareTarget({ a: pair.skill_a, b: pair.skill_b })}
                        className="px-2.5 py-1 text-[10px] font-mono border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 rounded transition-colors"
                      >
                        비교하기
                      </button>
                      {pair.source_a === 'custom' && (
                        <button
                          onClick={() => deleteMutation.mutate(pair.skill_a)}
                          className="px-2.5 py-1 text-[10px] font-mono border border-red-900/40 text-red-500 hover:text-red-400 hover:border-red-700/60 rounded transition-colors"
                        >
                          {pair.skill_a} 삭제
                        </button>
                      )}
                      {pair.source_b === 'custom' && (
                        <button
                          onClick={() => deleteMutation.mutate(pair.skill_b)}
                          className="px-2.5 py-1 text-[10px] font-mono border border-red-900/40 text-red-500 hover:text-red-400 hover:border-red-700/60 rounded transition-colors"
                        >
                          {pair.skill_b} 삭제
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {compareTarget && (
        <SkillCompareModal
          skillA={compareTarget.a}
          skillB={compareTarget.b}
          onClose={() => setCompareTarget(null)}
        />
      )}
    </>
  )
}

export default function Skills({ embedded }: { embedded?: boolean }) {
  const qc = useQueryClient()
  const { t } = useLang()
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editSkill, setEditSkill] = useState<SkillSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SkillSummary | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)

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
      {!embedded && (
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
              onClick={() => setShowDuplicates(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 hover:border-zinc-600 rounded transition-colors duration-150"
            >
              <ScanSearch size={13} strokeWidth={2} />
              중복 스킬 검색
            </button>
            <button
              onClick={() => setShowAnalysis(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-700 hover:bg-purple-600 text-white rounded transition-colors duration-150"
            >
              <BarChart2 size={13} strokeWidth={2} />
              사용량 분석
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors duration-150"
            >
              <Plus size={13} strokeWidth={2} />
              {t('skills.newSkill')}
            </button>
          </div>
        </div>
      )}
      {embedded && (
        <div className="flex items-center justify-end gap-2 mb-6">
          <button
            onClick={() => setShowDuplicates(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 hover:border-zinc-600 rounded transition-colors duration-150"
          >
            <ScanSearch size={13} strokeWidth={2} />
            중복 스킬 검색
          </button>
          <button
            onClick={() => setShowAnalysis(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-700 hover:bg-purple-600 text-white rounded transition-colors duration-150"
          >
            <BarChart2 size={13} strokeWidth={2} />
            사용량 분석
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors duration-150"
          >
            <Plus size={13} strokeWidth={2} />
            {t('skills.newSkill')}
          </button>
        </div>
      )}

      {/* Filter + Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-0.5 bg-zinc-900 border border-zinc-800 rounded p-0.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-2.5 py-1 text-xs rounded transition-colors duration-150 ${
                filter === tab.key
                  ? 'bg-fuchsia-600 text-white font-medium'
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
            className="bg-zinc-900 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-fuchsia-500/60 focus:ring-1 focus:ring-fuchsia-500/20 w-52 transition-colors duration-150"
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
                    className={`border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/30 transition-colors duration-150 ${isCustom ? 'border-l-2 border-l-fuchsia-500/20' : ''}`}
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
                          {isCustom ? <Edit2 size={16} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
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
      {showDuplicates && <DuplicateScanPanel onClose={() => setShowDuplicates(false)} />}
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
