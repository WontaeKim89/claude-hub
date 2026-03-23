import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { FlaskConical, Wand2 } from 'lucide-react'
import { api } from '../lib/api-client'
import { useLang } from '../hooks/useLang'
import { AnalysisResult } from '../components/wizard/AnalysisResult'
import type { WizardResult, MemoryProject } from '../lib/types'

type Step = 'select' | 'analyzing' | 'result' | 'done'

const ANALYSIS_STEPS = [
  { icon: '📁', label: '프로젝트 구조 분석', detail: 'src/, tests/, docs/ 스캔' },
  { icon: '📖', label: 'README.md 분석', detail: '프로젝트 설명 및 목적 파악' },
  { icon: '🧠', label: '전역 CLAUDE.md 참조', detail: '기존 개발 패턴 및 지시문 확인' },
  { icon: '💾', label: 'MEMORY.md 패턴 분석', detail: '프로젝트 메모리 및 습관 파악' },
  { icon: '⚡', label: '기술 스택 감지', detail: 'package.json / pyproject.toml 분석' },
  { icon: '🤖', label: 'AI가 최적 설정 생성 중', detail: 'Claude가 맞춤 CLAUDE.md를 작성합니다' },
]

type StepStatus = 'waiting' | 'running' | 'done'

function AnalysisProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="space-y-3">
      {ANALYSIS_STEPS.map((step, i) => {
        const status: StepStatus =
          i < currentStep ? 'done' : i === currentStep ? 'running' : 'waiting'

        return (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
              status === 'running'
                ? 'bg-emerald-500/5 border border-emerald-500/20'
                : status === 'done'
                  ? 'bg-zinc-800/30'
                  : 'opacity-40'
            }`}
          >
            {/* 아이콘: 완료 시 체크 표시 */}
            <span className="text-base shrink-0">
              {status === 'done' ? '✓' : step.icon}
            </span>

            {/* 텍스트 + 진행 바 */}
            <div className="flex-1 min-w-0">
              <div
                className={`text-xs font-medium ${
                  status === 'done'
                    ? 'text-emerald-400'
                    : status === 'running'
                      ? 'text-zinc-100'
                      : 'text-zinc-500'
                }`}
              >
                {step.label}
              </div>
              <div className="text-[10px] text-zinc-600 mt-0.5">{step.detail}</div>

              {/* 현재 실행 중인 단계에만 진행 바 표시 */}
              {status === 'running' && (
                <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ animation: 'progress 2s ease-in-out infinite' }}
                  />
                </div>
              )}
            </div>

            {/* 상태 인디케이터 */}
            <div className="shrink-0">
              {status === 'done' && (
                <span className="text-emerald-400 text-xs">✓</span>
              )}
              {status === 'running' && (
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Wizard() {
  const { t } = useLang()
  const [step, setStep] = useState<Step>('select')
  const [selectedPath, setSelectedPath] = useState('')
  const [customPath, setCustomPath] = useState('')
  const [result, setResult] = useState<WizardResult | null>(null)
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState(0)

  // 타이머 ref: 클린업용
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // API 응답 완료 여부 ref: 타이머와 비동기로 동기화
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
      // API 응답 도착: 타이머가 마지막 단계까지 도달하면 결과를 보여줌
      apiDoneRef.current = true
      apiResultRef.current = data
    },
    onError: () => {
      if (timerRef.current) clearInterval(timerRef.current)
      setStep('select')
    },
  })

  // 분석 중 단계 타이머
  useEffect(() => {
    if (step !== 'analyzing') return

    timerRef.current = setInterval(() => {
      setCurrentAnalysisStep((prev) => {
        const next = prev + 1

        // 마지막 단계(5)에서 API 응답이 도착하면 결과 화면으로 전환
        if (next >= ANALYSIS_STEPS.length) {
          if (timerRef.current) clearInterval(timerRef.current)

          if (apiDoneRef.current && apiResultRef.current) {
            setResult(apiResultRef.current)
            setStep('result')
          } else {
            // API가 아직 안 왔으면 마지막 단계에서 대기 (인터벌 중단)
            // API onSuccess에서 직접 처리
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

  // 타이머가 마지막 단계에 멈춘 채 API 응답을 기다리는 경우 처리
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

  const handleAnalyze = () => {
    if (!activePath) return
    analyzeMutation.mutate(activePath)
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Wand2 size={20} className="text-emerald-400" />
        </div>
        <p className="text-sm text-zinc-200 font-medium">설정이 적용되었습니다.</p>
        <p className="text-xs text-zinc-500">{result?.project_path}</p>
        <button
          onClick={() => { setStep('select'); setResult(null) }}
          className="mt-2 px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 rounded transition-colors"
        >
          다른 프로젝트 분석
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical size={16} className="text-emerald-400" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('wizard.title')}</h2>
        </div>
        <p className="text-xs text-zinc-500">{t('wizard.subtitle')}</p>
      </div>

      {/* 단계 1: 프로젝트 선택 */}
      {step === 'select' && (
        <div className="space-y-4">
          {projects.length > 0 && (
            <div>
              <label className="block font-mono text-xs text-zinc-500 mb-1.5">
                {t('wizard.selectProject')}
              </label>
              <div className="space-y-1 max-h-48 overflow-y-auto border border-zinc-800 rounded-md p-1">
                {projects.map((p) => (
                  <button
                    key={p.encoded}
                    onClick={() => { setSelectedPath(p.decoded); setCustomPath('') }}
                    className={`w-full text-left px-3 py-2 rounded text-xs font-mono transition-colors ${
                      selectedPath === p.decoded && !customPath
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {p.decoded}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">
              {t('wizard.newPath')}
            </label>
            <input
              value={customPath}
              onChange={(e) => { setCustomPath(e.target.value); setSelectedPath('') }}
              placeholder="/path/to/project"
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {analyzeMutation.isError && (
            <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">
              {(analyzeMutation.error as Error).message}
            </p>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!activePath}
            className="flex items-center gap-2 px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50"
          >
            <FlaskConical size={13} />
            {t('wizard.analyze')}
          </button>
        </div>
      )}

      {/* 단계 2: 분석 진행 애니메이션 */}
      {step === 'analyzing' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-zinc-500 font-mono">{activePath}</p>
          </div>
          <AnalysisProgress currentStep={currentAnalysisStep} />
        </div>
      )}

      {/* 단계 3: 결과 */}
      {step === 'result' && result && (
        <div>
          {/* 분석 완료 요약 헤더 */}
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
            <p className="text-xs text-emerald-400 font-medium mb-1">
              분석 완료 — {ANALYSIS_STEPS.length}개 항목 참조
            </p>
            <p className="text-[10px] text-zinc-500">
              {ANALYSIS_STEPS.map((s) => s.icon).join(' · ')}
            </p>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <p className="text-xs text-zinc-500 font-mono">{result.project_path}</p>
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
    </div>
  )
}
