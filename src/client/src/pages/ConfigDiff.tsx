import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { GitCompare, ArrowRight } from 'lucide-react'
import { api } from '../lib/api-client'
import { useLang } from '../hooks/useLang'
import { DiffViewer } from '../components/shared/DiffViewer'
import type { ConfigDiffItem, MemoryProject } from '../lib/types'
import { useQuery } from '@tanstack/react-query'

type DiffStatus = ConfigDiffItem['status']

const STATUS_STYLES: Record<DiffStatus, string> = {
  identical: 'bg-fuchsia-500/15 text-fuchsia-400',
  different: 'bg-amber-500/15 text-amber-400',
  missing: 'bg-red-500/15 text-red-400',
  both_missing: 'bg-zinc-700/50 text-zinc-500',
}

export default function ConfigDiff({ embedded }: { embedded?: boolean }) {
  const { t } = useLang()
  const [projectA, setProjectA] = useState('')
  const [projectB, setProjectB] = useState('')
  const [diffModal, setDiffModal] = useState<ConfigDiffItem | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const { data: projects = [] } = useQuery<MemoryProject[]>({
    queryKey: ['memory-projects'],
    queryFn: () => api.memory.projects(),
  })

  const diffMutation = useMutation({
    mutationFn: () => api.configDiff.diff(projectA, projectB),
  })

  const syncMutation = useMutation({
    mutationFn: ({ source, target }: { source: string; target: string }) =>
      api.configDiff.sync(source, target),
    onSuccess: (data) => {
      setSyncMsg(`Copy complete: ${data.target}`)
      setTimeout(() => setSyncMsg(null), 4000)
    },
  })

  const handleCompare = () => {
    if (!projectA || !projectB) return
    diffMutation.mutate()
  }

  const statusLabel = (status: DiffStatus) => {
    const map: Record<DiffStatus, string> = {
      identical: t('configDiff.identical'),
      different: t('configDiff.different'),
      missing: t('configDiff.missing'),
      both_missing: t('configDiff.bothMissing'),
    }
    return map[status]
  }

  return (
    <div className="max-w-3xl">
      {/* 헤더 */}
      {!embedded && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <GitCompare size={16} className="text-fuchsia-400" strokeWidth={1.5} />
            <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('configDiff.title')}</h2>
          </div>
          <p className="text-xs text-zinc-500">{t('configDiff.subtitle')}</p>
        </div>
      )}

      {/* 프로젝트 선택 + 비교 버튼 */}
      <div className="flex items-end gap-3 mb-5">
        <div className="flex-1 space-y-1">
          <label className="text-[11px] text-zinc-500 font-mono">{t('configDiff.projectA')}</label>
          <select
            value={projectA}
            onChange={(e) => setProjectA(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
          >
            <option value="">— Select —</option>
            {projects.map((p) => (
              <option key={p.encoded} value={p.decoded}>{p.decoded}</option>
            ))}
          </select>
        </div>

        <div className="shrink-0 pb-1">
          <GitCompare size={14} className="text-zinc-600" />
        </div>

        <div className="flex-1 space-y-1">
          <label className="text-[11px] text-zinc-500 font-mono">{t('configDiff.projectB')}</label>
          <select
            value={projectB}
            onChange={(e) => setProjectB(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
          >
            <option value="">— Select —</option>
            {projects.map((p) => (
              <option key={p.encoded} value={p.decoded}>{p.decoded}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCompare}
          disabled={!projectA || !projectB || diffMutation.isPending}
          className="shrink-0 px-4 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-xs text-white rounded transition-colors"
        >
          {diffMutation.isPending ? 'Comparing...' : t('configDiff.compare')}
        </button>
      </div>

      {/* 동기화 완료 메시지 */}
      {syncMsg && (
        <div className="mb-3 px-3 py-2 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded text-xs text-fuchsia-400">
          {syncMsg}
        </div>
      )}

      {/* 비교 결과 테이블 */}
      {diffMutation.data && (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium">Component</th>
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium">Project A</th>
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium">Project B</th>
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 text-zinc-500 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {diffMutation.data.map((item) => (
                <tr key={item.component} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-zinc-300">{item.component}</td>
                  <td className="px-4 py-3 text-zinc-400">{item.a_value}</td>
                  <td className="px-4 py-3 text-zinc-400">{item.b_value}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLES[item.status]}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {item.diff && (
                        <button
                          onClick={() => setDiffModal(item)}
                          className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          {t('configDiff.viewDiff')}
                        </button>
                      )}
                      {item.status === 'missing' && item.component === 'CLAUDE.md' && (
                        <button
                          onClick={() => syncMutation.mutate({ source: projectA, target: projectB })}
                          disabled={syncMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors disabled:opacity-40"
                        >
                          <ArrowRight size={12} />
                          {t('configDiff.copyAtoB')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Diff 모달 */}
      {diffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-full max-w-3xl mx-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">{diffModal.component} diff</h3>
                <p className="text-xs text-zinc-500 mt-0.5 font-mono">
                  {projectA} → {projectB}
                </p>
              </div>
              <button
                onClick={() => setDiffModal(null)}
                className="text-zinc-500 hover:text-zinc-300 text-lg leading-none ml-4"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-zinc-950">
              <DiffViewer diff={diffModal.diff ?? ''} />
            </div>
            <div className="px-5 py-3 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setDiffModal(null)}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
