import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { FlaskConical, Wand2, ChevronRight, FolderOpen, FileSearch, Sparkles, Check, ArrowLeft } from 'lucide-react'
import { api } from '../lib/api-client'
import { useLang } from '../hooks/useLang'
import { AnalysisResult } from '../components/wizard/AnalysisResult'
import type { WizardResult, MemoryProject } from '../lib/types'

// 위자드 전체 흐름: intro → select → confirm → analyzing → result → done
type WizardStep = 'intro' | 'select' | 'confirm' | 'analyzing' | 'result' | 'done'

function getAnalysisSteps(t: (key: string) => string) {
  return [
    { icon: '📁', label: t('wizard.analysisStep1'), detail: t('wizard.analysisStep1Detail') },
    { icon: '📖', label: t('wizard.analysisStep2'), detail: t('wizard.analysisStep2Detail') },
    { icon: '🧠', label: t('wizard.analysisStep3'), detail: t('wizard.analysisStep3Detail') },
    { icon: '💾', label: t('wizard.analysisStep4'), detail: t('wizard.analysisStep4Detail') },
    { icon: '⚡', label: t('wizard.analysisStep5'), detail: t('wizard.analysisStep5Detail') },
    { icon: '🤖', label: t('wizard.analysisStep6'), detail: t('wizard.analysisStep6Detail') },
  ]
}

type StepStatus = 'waiting' | 'running' | 'done'

// 상단 스텝 인디케이터
function StepIndicator({ current, t }: { current: WizardStep; t: (key: string) => string }) {
  const steps = [
    { key: 'intro', label: t('wizard.stepIntro') },
    { key: 'select', label: t('wizard.stepSelect') },
    { key: 'confirm', label: t('wizard.stepReference') },
    { key: 'analyzing', label: t('wizard.stepAnalyze') },
    { key: 'result', label: t('wizard.stepResult') },
  ] as const

  const order = ['intro', 'select', 'confirm', 'analyzing', 'result', 'done']
  const currentIdx = order.indexOf(current)

  return (
    <div className="flex items-center gap-1 mb-8">
      {steps.map((s, i) => {
        const stepIdx = order.indexOf(s.key)
        const isDone = currentIdx > stepIdx
        const isActive = currentIdx === stepIdx || (current === 'done' && s.key === 'result')

        return (
          <div key={s.key} className="flex items-center gap-1">
            {i > 0 && (
              <div className={`w-8 h-px mx-1 ${isDone ? 'bg-fuchsia-500' : 'bg-zinc-800'}`} />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  isDone
                    ? 'bg-fuchsia-500 text-white'
                    : isActive
                      ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/40'
                      : 'bg-zinc-800 text-zinc-600 border border-zinc-700'
                }`}
              >
                {isDone ? <Check size={12} strokeWidth={3} /> : i + 1}
              </div>
              <span
                className={`text-[11px] font-mono hidden sm:inline ${
                  isActive ? 'text-zinc-200' : isDone ? 'text-fuchsia-400' : 'text-zinc-600'
                }`}
              >
                {s.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Analyze 진행 애니메이션
function AnalysisProgress({ currentStep, steps }: { currentStep: number; steps: Array<{ icon: string; label: string; detail: string }> }) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const status: StepStatus =
          i < currentStep ? 'done' : i === currentStep ? 'running' : 'waiting'

        return (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
              status === 'running'
                ? 'bg-fuchsia-500/5 border border-fuchsia-500/20'
                : status === 'done'
                  ? 'bg-zinc-800/30'
                  : 'opacity-40'
            }`}
          >
            <span className="text-base shrink-0">
              {status === 'done' ? '✓' : step.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div
                className={`text-xs font-medium ${
                  status === 'done'
                    ? 'text-fuchsia-400'
                    : status === 'running'
                      ? 'text-zinc-100'
                      : 'text-zinc-500'
                }`}
              >
                {step.label}
              </div>
              <div className="text-[10px] text-zinc-600 mt-0.5">{step.detail}</div>
              {status === 'running' && (
                <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-fuchsia-500 rounded-full"
                    style={{ animation: 'progress 2s ease-in-out infinite' }}
                  />
                </div>
              )}
            </div>
            <div className="shrink-0">
              {status === 'done' && (
                <span className="text-fuchsia-400 text-xs">✓</span>
              )}
              {status === 'running' && (
                <div className="w-4 h-4 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function getReferenceFiles(t: (key: string) => string) {
  return [
    { category: t('wizard.refCategory1'), items: [
      { name: 'README.md', desc: t('wizard.refItem1Desc') },
      { name: 'pyproject.toml / package.json', desc: t('wizard.refItem2Desc') },
      { name: 'src/, tests/, docs/', desc: t('wizard.refItem3Desc') },
    ]},
    { category: t('wizard.refCategory2'), items: [
      { name: '~/.claude/CLAUDE.md', desc: t('wizard.refItem4Desc') },
      { name: '~/.claude/projects/*/memory/', desc: t('wizard.refItem5Desc') },
    ]},
    { category: t('wizard.refCategory3'), items: [
      { name: '{project}/CLAUDE.md', desc: t('wizard.refItem6Desc') },
    ]},
  ]
}

export default function Wizard() {
  const { t } = useLang()
  const ANALYSIS_STEPS = getAnalysisSteps(t)
  const REFERENCE_FILES = getReferenceFiles(t)
  const [step, setStep] = useState<WizardStep>('intro')
  const [selectedPath, setSelectedPath] = useState('')
  const [customPath, setCustomPath] = useState('')
  const [result, setResult] = useState<WizardResult | null>(null)
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState(0)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const apiDoneRef = useRef(false)
  const apiResultRef = useRef<WizardResult | null>(null)

  const { data: projects = [] } = useQuery<MemoryProject[]>({
    queryKey: ['memory-projects'],
    queryFn: () => api.memory.projects(),
  })

  const analyzeMutation = useMutation({
    mutationFn: (path: string) => api.wizard.analyze(path),
    onMutate: () => {
      apiDoneRef.current = false
      apiResultRef.current = null
      setCurrentAnalysisStep(0)
      setStep('analyzing')
    },
    onSuccess: (data) => {
      apiDoneRef.current = true
      apiResultRef.current = data
    },
    onError: () => {
      if (timerRef.current) clearInterval(timerRef.current)
      setStep('select')
    },
  })

  // Analyze 중 단계 타이머
  useEffect(() => {
    if (step !== 'analyzing') return

    timerRef.current = setInterval(() => {
      setCurrentAnalysisStep((prev) => {
        const next = prev + 1
        if (next >= ANALYSIS_STEPS.length) {
          if (timerRef.current) clearInterval(timerRef.current)
          if (apiDoneRef.current && apiResultRef.current) {
            setResult(apiResultRef.current)
            setStep('result')
          }
          return ANALYSIS_STEPS.length - 1
        }
        return next
      })
    }, 1600)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [step])

  // 타이머가 마지막 단계에서 API 응답 대기
  useEffect(() => {
    if (
      step === 'analyzing' &&
      currentAnalysisStep === ANALYSIS_STEPS.length - 1 &&
      apiDoneRef.current &&
      apiResultRef.current
    ) {
      setResult(apiResultRef.current)
      setStep('result')
    }
  }, [step, currentAnalysisStep, analyzeMutation.isSuccess])

  const applyMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.wizard.apply>[0]) => api.wizard.apply(data),
    onSuccess: () => setStep('done'),
  })

  const activePath = customPath.trim() || selectedPath

  const handleStartAnalysis = () => {
    if (!activePath) return
    analyzeMutation.mutate(activePath)
  }

  const resetWizard = () => {
    setStep('intro')
    setSelectedPath('')
    setCustomPath('')
    setResult(null)
    setCurrentAnalysisStep(0)
  }

  return (
    <div className="max-w-2xl">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical size={16} className="text-fuchsia-400" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('wizard.title')}</h2>
        </div>
        <p className="text-xs text-zinc-500">{t('wizard.subtitle')}</p>
      </div>

      {/* 스텝 인디케이터 */}
      <StepIndicator current={step} t={t} />

      {/* Step 1: Intro */}
      {step === 'intro' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-fuchsia-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Wand2 size={28} className="text-fuchsia-400" />
              </div>
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-zinc-100">{t('wizard.introHeading')}</h3>
                <div className="bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-lg px-3 py-2 mb-2">
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    {t('wizard.introBestPractice')}
                  </p>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {t('wizard.introDetail')}
                </p>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { icon: <FileSearch size={16} />, label: t('wizard.introCard1'), color: 'fuchsia' },
                    { icon: <Sparkles size={16} />, label: t('wizard.introCard2'), color: 'violet' },
                    { icon: <Wand2 size={16} />, label: t('wizard.introCard3'), color: 'purple' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg bg-${item.color}-500/5 border border-${item.color}-500/10`}
                    >
                      <span className="text-fuchsia-400">{item.icon}</span>
                      <span className="text-[10px] text-zinc-400 text-center">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep('select')}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg transition-colors"
          >
            {t('wizard.getStarted')}
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Step 2: Select Project */}
      {step === 'select' && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setStep('intro')} className="text-zinc-600 hover:text-zinc-300 transition-colors">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">{t('wizard.selectProjectTitle')}</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">{t('wizard.selectProjectDesc')}</p>
            </div>
          </div>

          {projects.length > 0 && (
            <div>
              <label className="flex items-center gap-1.5 font-mono text-xs text-zinc-500 mb-2">
                <FolderOpen size={12} />
                {t('wizard.existingProjects')}
              </label>
              <div className="space-y-1 max-h-56 overflow-y-auto border border-zinc-800 rounded-lg p-1.5">
                {projects.map((p) => (
                  <button
                    key={p.encoded}
                    onClick={() => { setSelectedPath(p.decoded); setCustomPath('') }}
                    className={`w-full text-left px-3 py-2.5 rounded-md text-xs font-mono transition-all ${
                      selectedPath === p.decoded && !customPath
                        ? 'bg-fuchsia-600/15 text-fuchsia-400 border border-fuchsia-500/30'
                        : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    <div className="truncate">{p.decoded}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">{t('wizard.manualInput')}</label>
            <input
              value={customPath}
              onChange={(e) => { setCustomPath(e.target.value); setSelectedPath('') }}
              placeholder="/path/to/project"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-fuchsia-500/50 transition-colors"
            />
          </div>

          {analyzeMutation.isError && (
            <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
              {(analyzeMutation.error as Error).message}
            </p>
          )}

          <button
            onClick={() => setStep('confirm')}
            disabled={!activePath}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('wizard.next')}
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Step 3: 참조 파일 확인 + 생성 확인 */}
      {step === 'confirm' && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setStep('select')} className="text-zinc-600 hover:text-zinc-300 transition-colors">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">{t('wizard.confirmTitle')}</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">{t('wizard.confirmDesc')}</p>
            </div>
          </div>

          {/* 선택된 프로젝트 */}
          <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg px-4 py-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{t('wizard.targetProject')}</p>
            <p className="text-xs font-mono text-fuchsia-400">{activePath}</p>
          </div>

          {/* 참조 파일 목록 */}
          <div className="space-y-3">
            {REFERENCE_FILES.map((group) => (
              <div key={group.category} className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-zinc-800/30">
                  <p className="text-[11px] text-zinc-400 font-medium">{group.category}</p>
                </div>
                <div className="divide-y divide-zinc-800/50">
                  {group.items.map((item) => (
                    <div key={item.name} className="flex items-start gap-3 px-4 py-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs font-mono text-zinc-300">{item.name}</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 저장 경로 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">{t('wizard.filesToGenerate')}</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-fuchsia-400">→</span>
                <span className="text-zinc-300">{activePath}/CLAUDE.md</span>
                <span className="text-zinc-600 text-[10px]">({t('wizard.projectClaudeMd')})</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-violet-400">→</span>
                <span className="text-zinc-300">~/.claude/settings.json</span>
                <span className="text-zinc-600 text-[10px]">({t('wizard.hooksOptional')})</span>
              </div>
            </div>
          </div>

          {/* 생성 버튼 */}
          <button
            onClick={handleStartAnalysis}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg transition-colors"
          >
            <Sparkles size={16} />
            {t('wizard.startAnalyze')}
          </button>
        </div>
      )}

      {/* Step 4: Analyze 진행 */}
      {step === 'analyzing' && (
        <div className="space-y-4">
          <div className="bg-zinc-800/30 rounded-lg px-4 py-2.5 mb-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{t('wizard.analyzing')}</p>
            <p className="text-xs text-zinc-300 font-mono truncate">{activePath}</p>
          </div>
          <AnalysisProgress currentStep={currentAnalysisStep} steps={ANALYSIS_STEPS} />
        </div>
      )}

      {/* Step 5: Result */}
      {step === 'result' && result && (
        <div>
          <div className="mb-5 p-4 rounded-lg bg-gradient-to-r from-fuchsia-500/5 to-violet-500/5 border border-fuchsia-500/15">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
                <Check size={16} className="text-fuchsia-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-100 font-medium">{t('wizard.analyzeComplete')}</p>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{result.project_path}</p>
              </div>
            </div>
          </div>

          <AnalysisResult
            result={result}
            onApply={(data) => applyMutation.mutate(data)}
            isApplying={applyMutation.isPending}
          />
          {applyMutation.isError && (
            <p className="text-xs text-red-400 mt-3">
              {(applyMutation.error as Error).message}
            </p>
          )}
        </div>
      )}

      {/* Step 6: 완료 */}
      {step === 'done' && (
        <div className="flex flex-col items-center justify-center py-16 gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center">
              <Check size={28} className="text-fuchsia-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-fuchsia-500 flex items-center justify-center">
              <Sparkles size={10} className="text-white" />
            </div>
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-sm text-zinc-100 font-semibold">설정이 적용되었습니다</p>
            <p className="text-xs text-zinc-500 font-mono">{result?.project_path}/CLAUDE.md</p>
          </div>

          {/* 생성된 내용 미리보기 */}
          {result && (
            <div className="w-full max-w-md mt-2">
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-zinc-800/30 flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500/60" />
                    <span className="w-2 h-2 rounded-full bg-amber-500/60" />
                    <span className="w-2 h-2 rounded-full bg-green-500/60" />
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">CLAUDE.md</span>
                </div>
                <div className="px-4 py-3 max-h-40 overflow-y-auto">
                  <pre className="text-[11px] text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">
                    {result.claude_md.slice(0, 500)}{result.claude_md.length > 500 ? '\n...' : ''}
                  </pre>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={resetWizard}
            className="mt-4 px-5 py-2.5 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-600 rounded-lg transition-colors"
          >
            다른 프로젝트 Analyze
          </button>
        </div>
      )}
    </div>
  )
}
