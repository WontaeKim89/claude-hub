import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit2, Trash2, Eye, X, Sparkles, BarChart2, ScanSearch, Loader2, GitMerge } from 'lucide-react'
import { api } from '../lib/api-client'
import { Badge } from '../components/shared/Badge'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import { TableSkeleton } from '../components/shared/Skeleton'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
import { SaveConfirmDialog } from '../components/shared/SaveConfirmDialog'
import { useLang } from '../hooks/useLang'
import { useEscClose } from '../hooks/useEscClose'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import { AnalysisPanel } from '../components/analysis/AnalysisPanel'
import { SkillChat } from '../components/wizard/SkillChat'
import type { SkillSummary, SkillDetail } from '../lib/types'
import { SkillMergeModal } from '../components/skills/SkillMergeModal'

type FilterTab = 'all' | 'custom' | 'installed'

function buildSkillTemplate(name: string, description: string): string {
  return `---
name: ${name}
description: ${description}
---

# ${name}

## Purpose
<Describe the problem this skill solves>

## Trigger
<When should this skill be used>

## Action
<Specific steps the skill performs>

## Constraints
<What to avoid, caveats>
`
}

type NewSkillTab = 'manual' | 'ai'

type SimilarSkill = {
  name: string; source: string; description: string
  similarity: number; grade: 'red' | 'yellow' | 'low'
  dimensions?: {
    purpose?: { score: number; reason: string }
    trigger?: { score: number; reason: string }
    process?: { score: number; reason: string }
    output?: { score: number; reason: string }
  }
  recommendation?: string
}

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
  const { t } = useLang()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState(() => initialContent || buildSkillTemplate('', ''))
  const [contentEdited, setContentEdited] = useState(!!initialContent)
  const [error, setError] = useState('')

  // 유사성 체크 관련 상태
  const [similarSkills, setSimilarSkills] = useState<SimilarSkill[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [mergeTarget, setMergeTarget] = useState<SimilarSkill | null>(null)

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

  // Create 클릭 → 유사성 체크 먼저 수행
  const handleCreate = async () => {
    setError('')
    setSimilarSkills(null)
    setChecking(true)
    try {
      const result = await api.skills.checkSimilarity(name, content)
      if (result.similar_skills.length > 0) {
        // 유사 스킬 발견 → 경고 표시
        setSimilarSkills(result.similar_skills)
        setChecking(false)
      } else {
        // 유사 스킬 없음 → 바로 생성
        setChecking(false)
        mutation.mutate()
      }
    } catch {
      setChecking(false)
      mutation.mutate()
    }
  }

  // "그래도 추가" → 경고 무시하고 생성
  const handleForceCreate = () => {
    setSimilarSkills(null)
    mutation.mutate()
  }

  return (
    <div className="p-5 space-y-4 overflow-y-auto flex-1">
      {error && <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>}

      {/* 유사 스킬 경고 */}
      {similarSkills && similarSkills.length > 0 && (
        <SimilarSkillWarning
          skills={similarSkills}
          onForceCreate={handleForceCreate}
          onMerge={(skill) => { setSimilarSkills(null); setMergeTarget(skill) }}
          creating={mutation.isPending}
          t={t}
        />
      )}

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
              Claude official skill format template applied
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
          onClick={handleCreate}
          disabled={checking || mutation.isPending || !name.trim()}
          className="px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded disabled:opacity-50"
        >
          {checking ? t('similarity.checking') : mutation.isPending ? t('similarity.creating') : t('similarity.create')}
        </button>
      </div>

      {/* 병합: 파일 생성 없이 content를 직접 전달 */}
      {mergeTarget && (
        <SkillMergeModal
          skillA={mergeTarget.name}
          skillB={name}
          sourceA={mergeTarget.source}
          sourceB="new"
          contentB={content}
          onClose={() => setMergeTarget(null)}
          onMerged={() => {
            qc.invalidateQueries({ queryKey: ['skills'] })
            onSuccess()
          }}
        />
      )}
    </div>
  )
}


// 유사 스킬 경고 패널
function SimilarSkillWarning({
  skills,
  onForceCreate,
  onMerge,
  creating,
  t,
}: {
  skills: SimilarSkill[]
  onForceCreate: () => void
  onMerge: (skill: SimilarSkill) => void
  creating: boolean
  t: (key: string) => string
}) {
  const topSimilarity = skills[0].similarity

  return (
    <div className="border border-amber-600/40 bg-amber-900/10 rounded-md p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="text-xs font-medium text-amber-400">{t('similarity.warning')}</span>
      </div>

      <p className="text-[11px] text-zinc-400">
        {topSimilarity}%{t('similarity.desc')}
      </p>

      {/* 유사 스킬 목록 */}
      <div className="space-y-2">
        {skills.map((s) => (
          <div key={s.name} className="p-2.5 rounded bg-zinc-800/50 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${s.grade === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <span className="font-mono text-xs text-zinc-200">{s.name}</span>
                <span className={`font-mono text-[10px] font-semibold ${s.grade === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                  {s.similarity}% {t('similarity.similarTo')}
                </span>
                <span className="text-[10px] text-zinc-600">{s.source}</span>
              </div>
              <button
                onClick={() => onMerge(s)}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono border border-fuchsia-900/40 text-fuchsia-400 hover:text-fuchsia-300 hover:border-fuchsia-700/60 rounded transition-colors"
              >
                <GitMerge size={10} />
                {t('similarity.mergeInstead')}
              </button>
            </div>
            {/* 4차원 점수 */}
            {s.dimensions && (
              <div className="space-y-0.5 ml-4">
                <DimensionBar label="Purpose" score={s.dimensions.purpose?.score ?? 0} reason={s.dimensions.purpose?.reason ?? ''} />
                <DimensionBar label="Trigger" score={s.dimensions.trigger?.score ?? 0} reason={s.dimensions.trigger?.reason ?? ''} />
                <DimensionBar label="Process" score={s.dimensions.process?.score ?? 0} reason={s.dimensions.process?.reason ?? ''} />
                <DimensionBar label="Output" score={s.dimensions.output?.score ?? 0} reason={s.dimensions.output?.reason ?? ''} />
              </div>
            )}
            {s.recommendation && (
              <p className="text-[10px] text-zinc-500 ml-4 italic">{s.recommendation}</p>
            )}
          </div>
        ))}
      </div>

      {/* 하단 액션 */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onForceCreate}
          disabled={creating}
          className="px-3 py-1.5 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded transition-colors disabled:opacity-50"
        >
          {creating ? t('similarity.creating') : t('similarity.addAnyway')}
        </button>
      </div>
    </div>
  )
}

function NewSkillModal({ onClose }: { onClose: () => void }) {
  useEscClose(onClose)
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
  useEscClose(onClose)
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


// Skill Comparison 팝업
function SkillCompareModal({ skillA, skillB, onClose, onMerge }: { skillA: string; skillB: string; onClose: () => void; onMerge?: () => void }) {
  useEscClose(onClose)
  const { t } = useLang()
  const { data, isLoading } = useQuery({
    queryKey: ['skill-compare', skillA, skillB],
    queryFn: () => api.skills.compare(skillA, skillB),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[90vw] max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-100">Skill Comparison</span>
            {data && (
              <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                data.similarity >= 90 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
              }`}>
                {data.similarity}% similar
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

        {/* Merge 버튼 — 하단 */}
        {onMerge && (
          <div className="px-5 py-3 border-t border-zinc-800 flex justify-end shrink-0">
            <button
              onClick={onMerge}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors"
            >
              <GitMerge size={14} />
              {t('merge.btnInCompare')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// similar 부분 하이라이트 표시
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

// 4차원 점수 바
function DimensionBar({ label, score, reason }: { label: string; score: number; reason: string }) {
  const color = score >= 90 ? 'bg-red-500' : score >= 70 ? 'bg-amber-500' : 'bg-zinc-600'
  const textColor = score >= 90 ? 'text-red-400' : score >= 70 ? 'text-amber-400' : 'text-zinc-500'
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-14 text-zinc-500 font-mono shrink-0">{label}</span>
      <span className={`w-8 text-right font-mono font-semibold ${textColor}`}>{score}%</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-zinc-600 truncate max-w-[180px]">{reason}</span>
    </div>
  )
}

// 중복 검색 결과 패널
function DuplicateScanPanel({ onClose }: { onClose: () => void }) {
  useEscClose(onClose)
  const { t } = useLang()
  const qc = useQueryClient()
  const [compareTarget, setCompareTarget] = useState<{ a: string; b: string } | null>(null)
  const [mergeTarget, setMergeTarget] = useState<{ a: string; b: string; srcA: string; srcB: string } | null>(null)
  // Auto-Skip: 삭제/병합된 스킬 추적
  const [removedSkills, setRemovedSkills] = useState<Set<string>>(new Set())

  const { data: pairs, isLoading } = useQuery({
    queryKey: ['skill-duplicates'],
    queryFn: () => api.skills.duplicates(),
  })

  // Auto-Skip: removedSkills에 포함된 스킬이 있는 쌍 필터링
  const activePairs = pairs?.filter(p =>
    !removedSkills.has(p.skill_a) && !removedSkills.has(p.skill_b)
  ) ?? []
  const skippedCount = (pairs?.length ?? 0) - activePairs.length

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[780px] max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-100">Duplicate Scan Results</span>
              {pairs && <span className="font-mono text-[10px] text-zinc-500">{activePairs.length} found</span>}
              {skippedCount > 0 && (
                <span className="font-mono text-[10px] text-zinc-600">{skippedCount} {t('dupScan.autoSkipped')}</span>
              )}
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
          </div>

          <div className="px-5 py-3 border-b border-zinc-800/50 bg-zinc-800/20">
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              {t('dupScan.desc')}{' '}
              <span className="text-amber-400">{t('dupScan.yellow')}</span>,{' '}
              <span className="text-red-400">{t('dupScan.red')}</span>
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <Loader2 size={24} className="animate-spin text-fuchsia-500" />
                <p className="text-xs text-zinc-500 font-mono">{t('dupScan.analyzing')}</p>
              </div>
            ) : activePairs.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xs text-zinc-500">No duplicate skills found.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {activePairs.map((pair, i) => (
                  <div key={i} className="px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                    {/* 헤더: 스킬 이름 + 총점 */}
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

                    {/* 4차원 점수 바 */}
                    {pair.dimensions && (
                      <div className="space-y-1 mb-2 ml-4">
                        <DimensionBar label={t('dupScan.purpose')} score={pair.dimensions.purpose?.score ?? 0} reason={pair.dimensions.purpose?.reason ?? ''} />
                        <DimensionBar label={t('dupScan.trigger')} score={pair.dimensions.trigger?.score ?? 0} reason={pair.dimensions.trigger?.reason ?? ''} />
                        <DimensionBar label={t('dupScan.process')} score={pair.dimensions.process?.score ?? 0} reason={pair.dimensions.process?.reason ?? ''} />
                        <DimensionBar label={t('dupScan.output')} score={pair.dimensions.output?.score ?? 0} reason={pair.dimensions.output?.reason ?? ''} />
                      </div>
                    )}

                    {/* 권장사항 */}
                    {pair.recommendation && (
                      <p className="text-[10px] text-zinc-500 mb-2 ml-4 italic">{pair.recommendation}</p>
                    )}

                    {/* 액션 버튼 — 중앙 정렬 */}
                    <div className="flex items-center justify-center gap-3 mt-3 pt-2 border-t border-zinc-800/30">
                      <button
                        onClick={() => setCompareTarget({ a: pair.skill_a, b: pair.skill_b })}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-mono font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-500 rounded-md transition-all"
                      >
                        <Eye size={12} />
                        Compare
                      </button>
                      <button
                        onClick={() => setMergeTarget({ a: pair.skill_a, b: pair.skill_b, srcA: pair.source_a, srcB: pair.source_b })}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-mono font-medium bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-400 hover:text-fuchsia-300 border border-fuchsia-600/40 hover:border-fuchsia-500/60 rounded-md transition-all"
                      >
                        <GitMerge size={12} />
                        {t('merge.btn')}
                      </button>
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
          onMerge={() => {
            // Compare 모달 닫고 Merge 모달 열기
            const a = compareTarget.a
            const b = compareTarget.b
            setCompareTarget(null)
            // source 정보는 pairs에서 찾기
            const pair = pairs?.find(p => (p.skill_a === a && p.skill_b === b) || (p.skill_a === b && p.skill_b === a))
            setMergeTarget({ a, b, srcA: pair?.source_a ?? 'custom', srcB: pair?.source_b ?? 'custom' })
          }}
        />
      )}

      {mergeTarget && (
        <SkillMergeModal
          skillA={mergeTarget.a}
          skillB={mergeTarget.b}
          sourceA={mergeTarget.srcA}
          sourceB={mergeTarget.srcB}
          onClose={() => setMergeTarget(null)}
          onMerged={() => {
            // Auto-Skip: 병합된 스킬 추적
            setRemovedSkills(prev => {
              const next = new Set(prev)
              next.add(mergeTarget.a)
              next.add(mergeTarget.b)
              return next
            })
            qc.invalidateQueries({ queryKey: ['skills'] })
            qc.invalidateQueries({ queryKey: ['skill-duplicates'] })
          }}
        />
      )}
    </>
  )
}

export default function Skills({ embedded, initialFilter }: { embedded?: boolean; initialFilter?: string }) {
  const qc = useQueryClient()
  const { t } = useLang()
  const [filter, setFilter] = useState<FilterTab>(
    initialFilter === 'installed' ? 'installed' : initialFilter === 'custom' ? 'custom' : 'all'
  )
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium rounded transition-colors duration-150"
            >
              <ScanSearch size={13} strokeWidth={2} />
              Duplicate Scan
            </button>
            <button
              onClick={() => setShowAnalysis(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-700 hover:bg-purple-600 text-white rounded transition-colors duration-150"
            >
              <BarChart2 size={13} strokeWidth={2} />
              Usage Analysis
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
      {/* Filter + Search + Actions — 같은 줄 */}
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
            className="bg-zinc-900 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-fuchsia-500/60 focus:ring-1 focus:ring-fuchsia-500/20 w-44 transition-colors duration-150"
          />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={() => setShowDuplicates(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] bg-amber-600 hover:bg-amber-500 text-white font-medium rounded transition-colors">
            <ScanSearch size={12} /> Duplicate Scan
          </button>
          <button onClick={() => setShowAnalysis(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] bg-purple-700 hover:bg-purple-600 text-white rounded transition-colors">
            <BarChart2 size={12} /> Usage Analysis
          </button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors">
            <Plus size={12} /> {t('skills.newSkill')}
          </button>
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
          title={`'${deleteTarget.name}' 스킬을 Delete하시겠습니까?`}
          confirmText={deleteTarget.name}
          onConfirm={() => deleteMutation.mutate(deleteTarget.name)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
