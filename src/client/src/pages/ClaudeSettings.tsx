import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Cpu, LogIn, LogOut, Radio, Download } from 'lucide-react'
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

        {/* 인증 관리 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4">
          <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">
            {t('claudeSettings.auth')}
          </label>

          {/* 인증 상태 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {authLoading ? (
                <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
              ) : (
                <>
                  <span className={`text-xs leading-none ${authStatus?.authenticated ? 'text-emerald-400' : 'text-zinc-600'}`}>●</span>
                  <span className="font-mono text-xs text-zinc-300">
                    {authStatus?.authenticated ? t('claudeSettings.authenticated') : t('claudeSettings.notAuthenticated')}
                  </span>
                  {authStatus?.details && (
                    <span className="font-mono text-[10px] text-zinc-600 truncate max-w-[180px]" title={authStatus.details}>
                      {authStatus.details}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* 로그인/로그아웃 버튼 */}
            <div className="flex items-center gap-2">
              {authStatus?.authenticated ? (
                <button
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono border border-zinc-700 text-zinc-400 hover:border-red-500/50 hover:text-red-400 rounded transition-colors disabled:opacity-50"
                >
                  <LogOut size={11} />
                  {t('claudeSettings.logout')}
                </button>
              ) : (
                <button
                  onClick={() => loginMutation.mutate()}
                  disabled={loginMutation.isPending}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono border border-emerald-600 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded transition-colors disabled:opacity-50"
                >
                  <LogIn size={11} />
                  {t('claudeSettings.login')}
                </button>
              )}
            </div>
          </div>

          {authMsg && (
            <p className="text-[11px] text-emerald-400 font-mono">{authMsg}</p>
          )}
        </div>

        {/* 원격 제어 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4">
          <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">
            {t('claudeSettings.remote')}
          </label>

          {/* 원격 작업 실행 */}
          <div className="mb-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t('claudeSettings.taskPlaceholder')}
                value={remoteTask}
                onChange={(e) => setRemoteTask(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                onClick={() => remoteStartMutation.mutate()}
                disabled={remoteStartMutation.isPending || !remoteTask.trim()}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-mono border border-emerald-600 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded transition-colors disabled:opacity-50 shrink-0"
              >
                <Radio size={11} />
                {t('claudeSettings.remoteStart')}
              </button>
            </div>
          </div>

          {/* Teleport */}
          <button
            onClick={() => teleportMutation.mutate()}
            disabled={teleportMutation.isPending}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-mono border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 rounded transition-colors disabled:opacity-50"
          >
            <Download size={11} />
            {t('claudeSettings.teleport')}
          </button>

          {remoteMsg && (
            <p className="mt-2 text-[11px] text-emerald-400 font-mono">{remoteMsg}</p>
          )}
        </div>
      </div>
    </div>
  )
}
