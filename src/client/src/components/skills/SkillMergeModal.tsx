import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, ChevronRight, ChevronLeft, Check, Loader2, GitMerge } from 'lucide-react'
import { api } from '../../lib/api-client'
import { MonacoWrapper } from '../editors/MonacoWrapper'
import { useLang } from '../../hooks/useLang'
import { useEscClose } from '../../hooks/useEscClose'

interface SkillMergeModalProps {
  skillA: string
  skillB: string
  sourceA: string
  sourceB: string
  // skill_b가 아직 파일로 존재하지 않을 때, raw content를 직접 전달
  contentB?: string
  onClose: () => void
  onMerged?: () => void
}

type Step = 1 | 2 | 3 | 4

// 출처별 색상 정의
const SOURCE_COLORS = {
  a: { bg: 'bg-blue-500/10', border: 'border-l-blue-500', text: 'text-blue-400', dot: 'bg-blue-500' },
  b: { bg: 'bg-purple-500/10', border: 'border-l-purple-500', text: 'text-purple-400', dot: 'bg-purple-500' },
  common: { bg: 'bg-emerald-500/10', border: 'border-l-emerald-500', text: 'text-emerald-400', dot: 'bg-emerald-500' },
} as const

interface MergePreviewData {
  merged_content: string
  merged_name: string
  merged_description: string
  source_map: Array<{ line: number; source: 'a' | 'b' | 'common' }>
  skill_a: { name: string; source: string; content: string }
  skill_b: { name: string; source: string; content: string }
}

export function SkillMergeModal({ skillA, skillB, sourceA, sourceB, contentB, onClose, onMerged }: SkillMergeModalProps) {
  const { t } = useLang()
  const qc = useQueryClient()
  useEscClose(onClose)

  // Step 관리
  const [step, setStep] = useState<Step>(1)

  // Step 1: 이름 선택
  const [nameChoice, setNameChoice] = useState<'a' | 'b' | 'custom'>('a')
  const [customName, setCustomName] = useState('')
  const [description, setDescription] = useState('')

  // Step 2: 미리보기
  const [preview, setPreview] = useState<MergePreviewData | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [isEdited, setIsEdited] = useState(false)

  // 병합 미리보기 API 호출
  const previewMutation = useMutation({
    mutationFn: () => api.skills.mergePreview(skillA, skillB, contentB ? { content_b: contentB, name_b: skillB } : undefined),
    onSuccess: (data) => {
      setPreview(data)
      // 사용자가 선택한 이름/설명으로 frontmatter 교체
      const chosenName = nameChoice === 'a' ? skillA : nameChoice === 'b' ? skillB : customName
      const chosenDesc = description || data.merged_description
      const content = data.merged_content.replace(
        /^---\n[\s\S]*?\n---/,
        `---\nname: ${chosenName}\ndescription: ${chosenDesc}\n---`
      )
      setEditedContent(content)
      if (!description) setDescription(data.merged_description)
      setStep(2)
    },
  })

  // 병합 실행 API 호출
  const mergeMutation = useMutation({
    mutationFn: () => {
      const targetName = nameChoice === 'a' ? skillA : nameChoice === 'b' ? skillB : customName
      return api.skills.merge({
        skill_a: skillA,
        skill_b: skillB,
        target_name: targetName,
        content: editedContent,
        delete_sources: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] })
      onMerged?.()
      setStep(4)
    },
  })

  const targetName = nameChoice === 'a' ? skillA : nameChoice === 'b' ? skillB : customName
  const canProceedStep1 = nameChoice !== 'custom' || customName.trim().length > 0

  const handleNext = useCallback(() => {
    if (step === 1) {
      previewMutation.mutate()
    } else if (step === 2) {
      setStep(3)
    }
  }, [step, previewMutation])

  const handleContentChange = useCallback((val: string) => {
    setEditedContent(val)
    setIsEdited(true)
  }, [])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[900px] max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <GitMerge size={16} className="text-fuchsia-400" />
            <span className="text-sm font-medium text-zinc-100">{t('merge.title')}</span>
            <StepIndicator current={step} />
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto">
          {step === 1 && (
            <StepSelectName
              skillA={skillA}
              skillB={skillB}
              nameChoice={nameChoice}
              setNameChoice={setNameChoice}
              customName={customName}
              setCustomName={setCustomName}
              description={description}
              setDescription={setDescription}
              t={t}
            />
          )}
          {step === 2 && preview && (
            <StepPreview
              preview={preview}
              editedContent={editedContent}
              isEdited={isEdited}
              onContentChange={handleContentChange}
              skillA={skillA}
              skillB={skillB}
              t={t}
            />
          )}
          {step === 3 && (
            <StepConfirm
              targetName={targetName}
              skillA={skillA}
              skillB={skillB}
              sourceA={sourceA}
              sourceB={sourceB}
              t={t}
            />
          )}
          {step === 4 && (
            <StepComplete
              targetName={targetName}
              skillA={skillA}
              skillB={skillB}
              t={t}
            />
          )}
        </div>

        {/* 푸터 — 네비게이션 버튼 */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 shrink-0">
          <div>
            {step > 1 && step < 4 && (
              <button
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded transition-colors"
              >
                <ChevronLeft size={14} />
                {t('merge.prev')}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mergeMutation.isError && (
              <span className="text-[10px] text-red-400 font-mono">{(mergeMutation.error as Error).message}</span>
            )}
            {previewMutation.isError && (
              <span className="text-[10px] text-red-400 font-mono">{(previewMutation.error as Error).message}</span>
            )}
            {step === 4 ? (
              <button
                onClick={onClose}
                className="flex items-center gap-1 px-4 py-1.5 text-xs font-mono bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors"
              >
                <Check size={14} />
                {t('merge.close')}
              </button>
            ) : step < 3 ? (
              <button
                onClick={handleNext}
                disabled={!canProceedStep1 || previewMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {previewMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ChevronRight size={14} />
                )}
                {t('merge.next')}
              </button>
            ) : (
              <button
                onClick={() => mergeMutation.mutate()}
                disabled={mergeMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors disabled:opacity-40"
              >
                {mergeMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                {t('merge.execute')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


// -- Step Indicator --
function StepIndicator({ current }: { current: Step }) {
  const steps = [1, 2, 3, 4] as const
  return (
    <div className="flex items-center gap-1 ml-3">
      {steps.map((s) => (
        <div
          key={s}
          className={`w-2 h-2 rounded-full transition-colors ${
            s === current ? 'bg-fuchsia-500' : s < current ? 'bg-fuchsia-700' : 'bg-zinc-700'
          }`}
        />
      ))}
    </div>
  )
}


// -- Step 1: 이름 선택 --
interface StepSelectNameProps {
  skillA: string
  skillB: string
  nameChoice: 'a' | 'b' | 'custom'
  setNameChoice: (v: 'a' | 'b' | 'custom') => void
  customName: string
  setCustomName: (v: string) => void
  description: string
  setDescription: (v: string) => void
  t: (key: string) => string
}

function StepSelectName({ skillA, skillB, nameChoice, setNameChoice, customName, setCustomName, description, setDescription, t }: StepSelectNameProps) {
  return (
    <div className="p-5 space-y-5">
      <p className="text-xs text-zinc-400">{t('merge.selectName')}</p>

      <div className="space-y-2">
        {/* skill_a 이름 사용 */}
        <label className="flex items-center gap-3 p-3 rounded border border-zinc-800 hover:border-zinc-600 cursor-pointer transition-colors">
          <input
            type="radio"
            name="merge-name"
            checked={nameChoice === 'a'}
            onChange={() => setNameChoice('a')}
            className="accent-fuchsia-500"
          />
          <span className="font-mono text-sm text-zinc-200">{skillA}</span>
          <span className="text-[10px] text-zinc-600">(skill A{t('merge.useNameOf')})</span>
        </label>

        {/* skill_b 이름 사용 */}
        <label className="flex items-center gap-3 p-3 rounded border border-zinc-800 hover:border-zinc-600 cursor-pointer transition-colors">
          <input
            type="radio"
            name="merge-name"
            checked={nameChoice === 'b'}
            onChange={() => setNameChoice('b')}
            className="accent-fuchsia-500"
          />
          <span className="font-mono text-sm text-zinc-200">{skillB}</span>
          <span className="text-[10px] text-zinc-600">(skill B{t('merge.useNameOf')})</span>
        </label>

        {/* 새 이름 입력 */}
        <label className="flex items-center gap-3 p-3 rounded border border-zinc-800 hover:border-zinc-600 cursor-pointer transition-colors">
          <input
            type="radio"
            name="merge-name"
            checked={nameChoice === 'custom'}
            onChange={() => setNameChoice('custom')}
            className="accent-fuchsia-500"
          />
          <input
            type="text"
            value={customName}
            onChange={(e) => { setCustomName(e.target.value); setNameChoice('custom') }}
            placeholder={t('merge.newName')}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-fuchsia-600"
          />
        </label>
      </div>

      {/* Description */}
      <div>
        <label className="block text-[10px] text-zinc-500 font-mono mb-1">{t('merge.description')}</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-fuchsia-600"
        />
      </div>
    </div>
  )
}


// -- Step 2: 미리보기 + 편집 --
interface StepPreviewProps {
  preview: MergePreviewData
  editedContent: string
  isEdited: boolean
  onContentChange: (val: string) => void
  skillA: string
  skillB: string
  t: (key: string) => string
}

function StepPreview({ preview, editedContent, isEdited, onContentChange, skillA, skillB, t }: StepPreviewProps) {
  // source_map을 라인 인덱스 -> source 맵으로 변환
  const sourceByLine = new Map<number, 'a' | 'b' | 'common'>()
  for (const item of preview.source_map) {
    sourceByLine.set(item.line, item.source)
  }

  const lines = editedContent.split('\n')

  return (
    <div className="flex flex-col h-[60vh]">
      {/* 범례 — 색상별 의미 설명 */}
      <div className="px-5 py-2.5 border-b border-zinc-800/50 shrink-0">
        <div className="flex items-center gap-5">
          <span className="text-[10px] text-zinc-600 font-mono">{t('merge.legend')}:</span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${SOURCE_COLORS.common.dot}`} />
            <span className="text-[10px] text-emerald-400 font-medium">{t('merge.common')}</span>
            <span className="text-[10px] text-zinc-600">— {t('merge.legendCommon')}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${SOURCE_COLORS.a.dot}`} />
            <span className="text-[10px] text-blue-400 font-medium">{skillA}</span>
            <span className="text-[10px] text-zinc-600">— {t('merge.legendA')}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${SOURCE_COLORS.b.dot}`} />
            <span className="text-[10px] text-purple-400 font-medium">{skillB}</span>
            <span className="text-[10px] text-zinc-600">— {t('merge.legendB')}</span>
          </span>
        </div>
        {isEdited && (
          <p className="text-[10px] text-amber-500 font-mono mt-1">{t('merge.editNotice')}</p>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* 좌측: source map 시각화 */}
        <div className="w-[280px] border-r border-zinc-800 overflow-y-auto shrink-0">
          <div className="font-mono text-[11px] leading-[20px]">
            {lines.map((line, idx) => {
              const src = isEdited ? undefined : sourceByLine.get(idx)
              const colors = src ? SOURCE_COLORS[src] : null
              return (
                <div
                  key={idx}
                  className={`flex px-2 ${colors ? `${colors.bg} border-l-2 ${colors.border}` : 'border-l-2 border-l-transparent'}`}
                >
                  <span className="w-6 text-right text-zinc-700 select-none mr-2 shrink-0">{idx + 1}</span>
                  <span className={`truncate ${colors ? colors.text : 'text-zinc-500'}`}>
                    {line || '\u00A0'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 우측: Monaco 에디터 */}
        <div className="flex-1 min-w-0">
          <MonacoWrapper
            value={editedContent}
            onChange={onContentChange}
            language="markdown"
            height="100%"
          />
        </div>
      </div>
    </div>
  )
}


// -- Step 3: 최종 확인 --
interface StepConfirmProps {
  targetName: string
  skillA: string
  skillB: string
  sourceA: string
  sourceB: string
  t: (key: string) => string
}

function StepConfirm({ targetName, skillA, skillB, sourceA, sourceB, t }: StepConfirmProps) {
  // 삭제될 스킬 목록 (target과 다른 것만, custom만 삭제 가능)
  const deletions = [
    { name: skillA, source: sourceA },
    { name: skillB, source: sourceB },
  ].filter((s) => s.name !== targetName)

  return (
    <div className="p-5 space-y-4">
      <p className="text-xs text-zinc-400">{t('merge.confirmDesc')}</p>

      <div className="space-y-3">
        {/* 생성할 스킬 */}
        <div className="flex items-center gap-2 p-3 rounded border border-emerald-900/40 bg-emerald-900/10">
          <Check size={14} className="text-emerald-500" />
          <span className="text-xs text-zinc-300">{t('merge.createSkill')}:</span>
          <span className="font-mono text-sm text-emerald-400">{targetName}</span>
        </div>

        {/* 삭제될 스킬 */}
        {deletions.map((d) => (
          <div
            key={d.name}
            className="flex items-center gap-2 p-3 rounded border border-red-900/40 bg-red-900/10"
          >
            <X size={14} className="text-red-500" />
            <span className="text-xs text-zinc-300">{t('merge.deleteSkill')}:</span>
            <span className="font-mono text-sm text-red-400">{d.name}</span>
            {d.source !== 'custom' && (
              <span className="text-[10px] text-zinc-600 ml-auto">({t('merge.cannotDelete')})</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}


// -- Step 4: 완료 --
function StepComplete({
  targetName,
  skillA,
  skillB,
  t,
}: {
  targetName: string
  skillA: string
  skillB: string
  t: (key: string) => string
}) {
  return (
    <div className="p-8 flex flex-col items-center gap-4 text-center">
      <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
        <Check size={24} className="text-emerald-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-100 mb-2">{t('merge.completeTitle')}</p>
        <p className="text-xs text-zinc-400">
          <span className="font-mono text-blue-400">{skillA}</span>
          {' '}{t('merge.completeAnd')}{' '}
          <span className="font-mono text-purple-400">{skillB}</span>
          {t('merge.completeTo')}
          <span className="font-mono text-emerald-400 font-medium"> {targetName}</span>
          {t('merge.completeDone')}
        </p>
      </div>
    </div>
  )
}
