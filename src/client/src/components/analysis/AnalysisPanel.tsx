import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, AlertTriangle, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { api } from '../../lib/api-client'
import { useLang } from '../../hooks/useLang'
import type { AnalysisResult } from '../../lib/types'

interface Props {
  type: 'skills' | 'plugins'
  onClose: () => void
}

function ScoreBadge({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? score / maxScore : 0
  const colorClass =
    pct >= 0.8 ? 'text-emerald-400' :
    pct >= 0.5 ? 'text-zinc-200' :
    pct >= 0.2 ? 'text-amber-400' :
    'text-red-400'

  return (
    <span className={`font-mono font-semibold text-sm ${colorClass}`}>
      {score.toFixed(1)}
      <span className="text-zinc-600 text-xs font-normal">/{maxScore}</span>
    </span>
  )
}

function UsageBar({ hits, maxHits }: { hits: number; maxHits: number }) {
  const width = maxHits > 0 ? Math.round((hits / maxHits) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500/60 rounded-full"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="font-mono text-xs text-zinc-500">{hits}</span>
    </div>
  )
}

export function AnalysisPanel({ type, onClose }: Props) {
  const { t } = useLang()
  const [result, setResult] = useState<AnalysisResult | null>(null)

  const mutation = useMutation({
    mutationFn: () => (type === 'skills' ? api.analysis.skills() : api.analysis.plugins()),
    onSuccess: (data) => setResult(data),
  })

  const maxScore = result?.claude_connected ? 100 : 60
  const maxHits = result ? Math.max(...result.items.map((i) => i.total_hits), 1) : 1

  const handleStart = () => {
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[860px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-100">{t('analysis.title')}</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 토큰 경고 배너 (분석 전) */}
          {!result && !mutation.isPending && (
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-md px-4 py-3">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-amber-300">{t('analysis.tokenWarning')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleStart}
                  className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
                >
                  {t('analysis.start')}
                </button>
              </div>
            </div>
          )}

          {/* 로딩 */}
          {mutation.isPending && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={24} className="text-purple-400 animate-spin" />
              <p className="text-sm text-zinc-400 font-mono">분석 중...</p>
            </div>
          )}

          {/* 에러 */}
          {mutation.isError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3">
              <p className="text-xs text-red-400">{(mutation.error as Error).message}</p>
            </div>
          )}

          {/* 결과 */}
          {result && (
            <>
              {/* Claude 미연결 알림 */}
              {!result.claude_connected && (
                <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded px-4 py-2.5">
                  <span className="text-zinc-500 text-xs font-mono">{t('analysis.disconnected')}</span>
                  <span className="text-zinc-600 text-xs ml-auto">정량 60점 기준</span>
                </div>
              )}

              {/* 랭킹 테이블 */}
              <div>
                <h3 className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  {t('analysis.ranking')}
                </h3>
                <div className="border border-zinc-800 rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/60">
                        <th className="text-left px-3 py-2.5 font-mono text-zinc-600 w-8">#</th>
                        <th className="text-left px-3 py-2.5 font-mono text-zinc-600">이름</th>
                        <th className="text-left px-3 py-2.5 font-mono text-zinc-600">점수</th>
                        <th className="text-left px-3 py-2.5 font-mono text-zinc-600">사용량</th>
                        {result.claude_connected && (
                          <th className="text-left px-3 py-2.5 font-mono text-zinc-600">AI 판정</th>
                        )}
                        <th className="px-3 py-2.5 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((item, idx) => (
                        <tr
                          key={item.name}
                          className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20 transition-colors"
                        >
                          <td className="px-3 py-3">
                            <span className="font-mono text-zinc-600">{idx + 1}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-mono text-zinc-200">{item.name}</span>
                            {item.source && (
                              <span className="ml-2 text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-mono">
                                {item.source}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <ScoreBadge score={item.total_score} maxScore={maxScore} />
                          </td>
                          <td className="px-3 py-3">
                            <UsageBar hits={item.total_hits} maxHits={maxHits} />
                          </td>
                          {result.claude_connected && (
                            <td className="px-3 py-3">
                              <p className="text-zinc-500 text-xs max-w-[220px] truncate" title={item.ai_comment}>
                                {item.ai_comment || '—'}
                              </p>
                            </td>
                          )}
                          <td className="px-3 py-3">
                            {item.total_score < 20 && (
                              <button
                                className="p-1 text-zinc-700 hover:text-red-400 transition-colors"
                                title="제거 고려"
                              >
                                <Trash2 size={13} strokeWidth={1.5} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI 종합 분석 패널 */}
              {result.claude_connected && (
                <div className="bg-purple-500/5 border border-purple-500/15 rounded-md px-4 py-3 space-y-1">
                  <p className="text-xs font-mono text-purple-400 font-medium">AI 종합 분석 완료</p>
                  <p className="text-xs text-zinc-500">
                    총 {result.total_analyzed}개 항목을 정량(60점) + 정성(40점) 기준으로 평가했습니다.
                  </p>
                  <a
                    href={result.reference_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-purple-400/70 hover:text-purple-400 transition-colors"
                  >
                    <ExternalLink size={11} />
                    {t('analysis.reference')}
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3.5 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
