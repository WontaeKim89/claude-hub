import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Cpu } from 'lucide-react'
import { api } from '../lib/api-client'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import { useLang } from '../hooks/useLang'

// Settings.tsx와 동일한 모델 목록
const MODEL_OPTIONS = [
  'claude-opus-4-5',
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
  'claude-opus-4',
  'claude-sonnet-4',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
]

export default function ClaudeSettings() {
  const { t } = useLang()
  const qc = useQueryClient()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['claude-settings'],
    queryFn: () => api.claudeSettings.get(),
  })

  const mutation = useMutation({
    mutationFn: (model: string) => api.claudeSettings.updateModel(model),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['claude-settings'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
      setError('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    },
    onError: (e: Error) => setError(e.message),
  })

  const currentModel = data?.model ?? ''

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('claudeSettings.title')}</h2>
            <InfoTooltip {...CATEGORY_INFO.claudeSettings} />
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">{t('claudeSettings.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-lg space-y-4">
        {/* 모델 선택 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4">
          <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
            {t('claudeSettings.model')}
          </label>
          {isLoading ? (
            <div className="h-9 bg-zinc-800 rounded-md animate-pulse" />
          ) : (
            <select
              value={currentModel}
              onChange={(e) => mutation.mutate(e.target.value)}
              disabled={mutation.isPending}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-50 transition-colors"
            >
              {/* 현재 모델이 목록에 없을 경우를 위한 fallback 옵션 */}
              {currentModel && !MODEL_OPTIONS.includes(currentModel) && (
                <option value={currentModel}>{currentModel}</option>
              )}
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          <p className="mt-2 text-[11px] text-zinc-600">{t('claudeSettings.modelHint')}</p>

          {success && (
            <p className="mt-2 text-xs text-emerald-400 font-mono">저장됨</p>
          )}
          {error && (
            <p className="mt-2 text-xs text-red-400 font-mono">{error}</p>
          )}
        </div>

        {/* Claude CLI 연결 상태 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4">
          <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">
            {t('claudeSettings.cliVersion')}
          </label>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu size={14} strokeWidth={1.5} className="text-zinc-500" />
              {isLoading ? (
                <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse" />
              ) : (
                <span className="font-mono text-sm text-zinc-300">
                  {data?.cli_version ?? '—'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs leading-none ${data?.cli_version ? 'text-emerald-400' : 'text-zinc-600'}`}>●</span>
              <span className="font-mono text-xs text-zinc-500">
                {data?.cli_version ? '연결됨' : '미연결'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
