import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import { DiffModal } from '../components/shared/DiffModal'
import { Skeleton } from '../components/shared/Skeleton'
import type { SettingsData, DiffResult } from '../lib/types'

type Tab = 'global' | 'local' | 'raw'

const MODEL_OPTIONS = [
  'claude-opus-4-6-20250319',
  'claude-sonnet-4-6-20250318',
  'claude-opus-4-5-20250414',
  'claude-sonnet-4-5-20250514',
  'claude-haiku-4-5-20251001',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
]

export default function Settings() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('global')
  const [rawJson, setRawJson] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)

  const { data, isLoading } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: () => api.settings.get(),
  })

  useEffect(() => {
    if (data) {
      setRawJson(JSON.stringify(data.global_settings, null, 2))
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: (payload: { global_settings?: Record<string, unknown>; last_mtime: number }) =>
      api.settings.update(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setError('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleModelChange = (model: string) => {
    if (!data) return
    mutation.mutate({ global_settings: { ...data.global_settings, model }, last_mtime: data.last_mtime })
  }

  const handleRawSave = () => {
    if (!data) return
    try {
      const parsed = JSON.parse(rawJson) as Record<string, unknown>
      mutation.mutate({ global_settings: parsed, last_mtime: data.last_mtime })
    } catch {
      setError('Invalid JSON')
    }
  }

  const handlePreviewDiff = async () => {
    if (!data) return
    try {
      const parsed = JSON.parse(rawJson) as Record<string, unknown>
      const result = await api.previewDiff({ target: 'settings', scope: 'global', content: parsed })
      setDiffResult(result)
    } catch {
      setError('Invalid JSON — cannot preview diff')
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'global', label: 'Global' },
    { key: 'local', label: 'Local' },
    { key: 'raw', label: 'Raw JSON' },
  ]

  const currentModel = (data?.global_settings?.model as string) ?? ''

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Settings</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Manage your claude configuration</p>
        </div>
        <InfoTooltip {...CATEGORY_INFO.settings} />
      </div>

      {/* Tabs — underline style */}
      <div className="flex gap-0 mb-5 border-b border-zinc-800 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setError('') }}
            className={`px-4 py-2 text-xs font-mono transition-colors duration-150 border-b-2 -mb-px ${
              tab === t.key
                ? 'border-fuchsia-500 text-fuchsia-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2 mb-4">{error}</p>}
      {success && <p className="text-xs text-fuchsia-400 bg-fuchsia-400/10 rounded px-3 py-2 mb-4">Saved successfully.</p>}

      {isLoading && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-5 max-w-xl space-y-4">
          <div>
            <Skeleton className="h-3 w-10 mb-2" />
            <Skeleton className="h-9 w-64" />
          </div>
          <div>
            <Skeleton className="h-3 w-28 mb-2" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      )}

      {tab === 'global' && data && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-5 space-y-5 max-w-xl">
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">model</label>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-fuchsia-400 shrink-0" />
              <select
                value={currentModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-fuchsia-500/50 transition-colors duration-150"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">other settings (read-only)</label>
            <pre className="bg-zinc-800 border border-zinc-800 rounded px-3 py-2.5 text-xs font-mono text-zinc-500 overflow-auto max-h-60">
              {JSON.stringify(
                Object.fromEntries(Object.entries(data.global_settings).filter(([k]) => k !== 'model')),
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}

      {tab === 'local' && data && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-5 max-w-xl">
          <label className="block font-mono text-xs text-zinc-500 mb-1.5">local settings (read-only)</label>
          <pre className="bg-zinc-800 border border-zinc-800 rounded px-3 py-2.5 text-xs font-mono text-zinc-500 overflow-auto max-h-96">
            {JSON.stringify(data.local_settings, null, 2)}
          </pre>
        </div>
      )}

      {tab === 'raw' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-4 py-2 border-b border-zinc-800">
            <span className="font-mono text-xs text-zinc-600">~/.claude/settings.json</span>
          </div>
          <MonacoWrapper value={rawJson} onChange={setRawJson} language="json" height="500px" />
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800">
            <button
              onClick={handlePreviewDiff}
              disabled={mutation.isPending}
              className="px-3 py-1.5 text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 rounded transition-colors disabled:opacity-50"
            >
              Preview Diff
            </button>
            <button
              onClick={handleRawSave}
              disabled={mutation.isPending}
              className="px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {diffResult && (
        <DiffModal
          diff={diffResult.diff}
          targetPath={diffResult.target_path}
          onClose={() => setDiffResult(null)}
        />
      )}
    </div>
  )
}
