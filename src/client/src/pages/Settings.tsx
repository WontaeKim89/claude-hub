import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import type { SettingsData } from '../lib/types'

type Tab = 'global' | 'local' | 'raw'

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

export default function Settings() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('global')
  const [rawJson, setRawJson] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const { data, isLoading } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: () => api.settings.get(),
  })

  // raw JSON 탭용 상태 초기화
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
    onError: (e: Error) => {
      setError(e.message)
    },
  })

  const handleModelChange = (model: string) => {
    if (!data) return
    const updated = { ...data.global_settings, model }
    mutation.mutate({ global_settings: updated, last_mtime: data.last_mtime })
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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'global', label: 'Global' },
    { key: 'local', label: 'Local' },
    { key: 'raw', label: 'Raw JSON' },
  ]

  if (isLoading) {
    return <div className="flex items-center justify-center h-40"><span className="text-zinc-500 text-sm">Loading...</span></div>
  }

  const currentModel = (data?.global_settings?.model as string) ?? ''

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your claude configuration" />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-zinc-900 border border-zinc-800 rounded-md p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setError('') }}
            className={`px-3 py-1 text-sm rounded ${
              tab === t.key ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400 bg-red-400/10 rounded p-2 mb-4">{error}</p>}
      {success && <p className="text-sm text-emerald-400 bg-emerald-400/10 rounded p-2 mb-4">Saved successfully.</p>}

      {tab === 'global' && data && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Model</label>
            <select
              value={currentModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Other Settings (read-only)</label>
            <pre className="bg-zinc-800 rounded-md p-3 text-xs text-zinc-400 overflow-auto max-h-60">
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <p className="text-xs font-medium text-zinc-400 mb-2">Local Settings (read-only)</p>
          <pre className="bg-zinc-800 rounded-md p-3 text-xs text-zinc-400 overflow-auto max-h-96">
            {JSON.stringify(data.local_settings, null, 2)}
          </pre>
        </div>
      )}

      {tab === 'raw' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <MonacoWrapper value={rawJson} onChange={setRawJson} language="json" height="500px" />
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800">
            <button
              onClick={handleRawSave}
              disabled={mutation.isPending}
              className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
