import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Loader2, Wand2 } from 'lucide-react'
import { api } from '../lib/api-client'
import { useLang } from '../hooks/useLang'
import { AnalysisResult } from '../components/wizard/AnalysisResult'
import type { WizardResult, MemoryProject } from '../lib/types'

type Step = 'select' | 'analyzing' | 'result' | 'done'

export default function Wizard() {
  const { t } = useLang()
  const [step, setStep] = useState<Step>('select')
  const [selectedPath, setSelectedPath] = useState('')
  const [customPath, setCustomPath] = useState('')
  const [result, setResult] = useState<WizardResult | null>(null)

  const { data: projects = [] } = useQuery<MemoryProject[]>({
    queryKey: ['memory-projects'],
    queryFn: () => api.memory.projects(),
  })

  const analyzeMutation = useMutation({
    mutationFn: (path: string) => api.wizard.analyze(path),
    onMutate: () => setStep('analyzing'),
    onSuccess: (data) => {
      setResult(data)
      setStep('result')
    },
    onError: () => setStep('select'),
  })

  const applyMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.wizard.apply>[0]) => api.wizard.apply(data),
    onSuccess: () => {
      setStep('done')
    },
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
          <Wand2 size={16} className="text-emerald-400" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('wizard.title')}</h2>
        </div>
        <p className="text-xs text-zinc-500">{t('wizard.subtitle')}</p>
      </div>

      {/* 단계 1: 프로젝트 선택 */}
      {(step === 'select' || step === 'analyzing') && (
        <div className="space-y-4">
          {/* 기존 프로젝트 목록 */}
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

          {/* 직접 경로 입력 */}
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
            disabled={!activePath || step === 'analyzing'}
            className="flex items-center gap-2 px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50"
          >
            {step === 'analyzing' ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                {t('wizard.analyzing')}
              </>
            ) : (
              <>
                <Wand2 size={13} />
                {t('wizard.analyze')}
              </>
            )}
          </button>
        </div>
      )}

      {/* 단계 2: 분석 중 (analyzing 상태는 버튼에 로딩으로 표시됨, 별도 스피너 불필요) */}

      {/* 단계 3: 결과 */}
      {step === 'result' && result && (
        <div>
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
