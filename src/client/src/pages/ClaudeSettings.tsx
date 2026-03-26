import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LogIn, LogOut, Radio, Download } from 'lucide-react'
import { api } from '../lib/api-client'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import { useLang } from '../hooks/useLang'

// Claude Code /model 명령어에서 제공하는 모델 목록
const MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'claude-opus-4-6-20250319', label: 'Claude Opus 4.6' },
  { value: 'claude-sonnet-4-6-20250318', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-5-20250414', label: 'Claude Opus 4.5' },
  { value: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
]

// Claude Code 내부 단축 표기 → 사람이 읽기 쉬운 레이블 매핑
const MODEL_ALIAS_MAP: Record<string, string> = {
  'opus[1m]': 'Claude Opus 4.6 (1M context)',
  'opus': 'Claude Opus 4.6',
  'sonnet': 'Claude Sonnet 4.6',
  'haiku': 'Claude Haiku 4.5',
  'sonnet[1m]': 'Claude Sonnet 4.6 (1M context)',
}

function resolveModelLabel(value: string): string {
  if (MODEL_ALIAS_MAP[value]) return MODEL_ALIAS_MAP[value]
  const found = MODEL_OPTIONS.find((m) => m.value === value)
  if (found) return found.label
  return value
}

// claude auth status --text 출력에서 이메일과 플랜 정보 추출
function parseAuthDetails(details: string): { email: string | null; plan: string | null } {
  const emailMatch = details.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)
  const planMatch = details.match(/\b(Max|Pro|Team|Free|max|pro|team|free)\b/)
  return {
    email: emailMatch ? emailMatch[0] : null,
    plan: planMatch ? planMatch[1] : null,
  }
}

export default function ClaudeSettings() {
  const { t } = useLang()
  const qc = useQueryClient()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [authMsg, setAuthMsg] = useState('')
  const [remoteTask, setRemoteTask] = useState('')
  const [remoteMsg, setRemoteMsg] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['claude-settings'],
    queryFn: () => api.claudeSettings.get(),
  })

  const { data: authStatus, isLoading: authLoading } = useQuery({
    queryKey: ['claude-auth-status'],
    queryFn: () => api.claudeSettings.authStatus(),
    refetchInterval: 10_000,
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

  const loginMutation = useMutation({
    mutationFn: () => api.claudeSettings.authLogin(),
    onSuccess: (res) => {
      setAuthMsg(res.message)
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['claude-auth-status'] })
        setAuthMsg('')
      }, 4000)
    },
  })

  const logoutMutation = useMutation({
    mutationFn: () => api.claudeSettings.authLogout(),
    onSuccess: (res) => {
      setAuthMsg(res.message)
      qc.invalidateQueries({ queryKey: ['claude-auth-status'] })
      setTimeout(() => setAuthMsg(''), 3000)
    },
  })

  const remoteStartMutation = useMutation({
    mutationFn: () => api.claudeSettings.remoteStart(remoteTask),
    onSuccess: (res) => {
      setRemoteMsg(res.message)
      setTimeout(() => setRemoteMsg(''), 4000)
    },
  })

  const teleportMutation = useMutation({
    mutationFn: () => api.claudeSettings.teleport(),
    onSuccess: (res) => {
      setRemoteMsg(res.message)
      setTimeout(() => setRemoteMsg(''), 4000)
    },
  })

  const currentModel = data?.model ?? ''
  const parsedAuth = authStatus?.details ? parseAuthDetails(authStatus.details) : { email: null, plan: null }

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
        {/* 인증 정보 섹션 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-semibold text-zinc-200">{t('claudeSettings.auth')}</span>
          </div>
          <div className="px-4 py-4">
            {authLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-40 bg-zinc-800 rounded animate-pulse" />
                <div className="h-3 w-56 bg-zinc-800 rounded animate-pulse" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* 인증 상태 표시 */}
                <div className="flex items-center gap-2">
                  <span className={`text-sm leading-none ${authStatus?.authenticated ? 'text-fuchsia-400' : 'text-red-400'}`}>●</span>
                  <span className="font-mono text-sm text-zinc-100">
                    {authStatus?.authenticated ? t('claudeSettings.authenticated') : t('claudeSettings.notAuthenticated')}
                  </span>
                  {parsedAuth.plan && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/20">
                      {parsedAuth.plan}
                    </span>
                  )}
                </div>

                {/* 이메일 및 CLI 버전 */}
                <div className="space-y-1">
                  {parsedAuth.email && (
                    <p className="font-mono text-xs text-zinc-400">{parsedAuth.email}</p>
                  )}
                  {data?.cli_version && (
                    <p className="font-mono text-[11px] text-zinc-600">
                      CLI {data.cli_version}
                    </p>
                  )}
                </div>

                {/* 로그인/로그아웃 버튼 */}
                <div className="pt-1">
                  {authStatus?.authenticated ? (
                    <button
                      onClick={() => logoutMutation.mutate()}
                      disabled={logoutMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-zinc-700 text-zinc-400 hover:border-red-500/50 hover:text-red-400 rounded transition-colors disabled:opacity-50"
                    >
                      <LogOut size={12} />
                      {t('claudeSettings.logout')}
                    </button>
                  ) : (
                    <button
                      onClick={() => loginMutation.mutate()}
                      disabled={loginMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-fuchsia-600 text-fuchsia-400 hover:bg-fuchsia-600 hover:text-white rounded transition-colors disabled:opacity-50"
                    >
                      <LogIn size={12} />
                      {t('claudeSettings.login')}
                    </button>
                  )}
                </div>

                {authMsg && (
                  <p className="text-[11px] text-fuchsia-400 font-mono">{authMsg}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 모델 설정 섹션 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-semibold text-zinc-200">{t('claudeSettings.model')}</span>
          </div>
          <div className="px-4 py-4">
            {isLoading ? (
              <div className="h-9 bg-zinc-800 rounded-md animate-pulse" />
            ) : (
              <select
                value={currentModel}
                onChange={(e) => mutation.mutate(e.target.value)}
                disabled={mutation.isPending}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-fuchsia-500 disabled:opacity-50 transition-colors"
              >
                {/* 현재 모델이 목록에 없을 경우를 위한 fallback 옵션 */}
                {currentModel && !MODEL_OPTIONS.some((m) => m.value === currentModel) && (
                  <option value={currentModel}>{resolveModelLabel(currentModel)}</option>
                )}
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            )}
            <p className="mt-2 text-[11px] text-zinc-600">{t('claudeSettings.modelHint')}</p>

            {success && (
              <p className="mt-2 text-xs text-fuchsia-400 font-mono">{t('common.saved')}</p>
            )}
            {error && (
              <p className="mt-2 text-xs text-red-400 font-mono">{error}</p>
            )}
          </div>
        </div>

        {/* 원격 제어 섹션 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-semibold text-zinc-200">{t('claudeSettings.remote')}</span>
          </div>
          <div className="px-4 py-4 space-y-3">
            {/* 원격 작업 실행 */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t('claudeSettings.taskPlaceholder')}
                value={remoteTask}
                onChange={(e) => setRemoteTask(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-fuchsia-500/50"
              />
              <button
                onClick={() => remoteStartMutation.mutate()}
                disabled={remoteStartMutation.isPending || !remoteTask.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-fuchsia-600 text-fuchsia-400 hover:bg-fuchsia-600 hover:text-white rounded transition-colors disabled:opacity-50 shrink-0"
              >
                <Radio size={12} />
                {t('claudeSettings.remoteStart')}
              </button>
            </div>

            {/* Teleport */}
            <button
              onClick={() => teleportMutation.mutate()}
              disabled={teleportMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 rounded transition-colors disabled:opacity-50"
            >
              <Download size={12} />
              {t('claudeSettings.teleport')}
            </button>

            {remoteMsg && (
              <p className="text-[11px] text-fuchsia-400 font-mono">{remoteMsg}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
