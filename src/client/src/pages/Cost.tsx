import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, Cpu, FolderOpen, Wrench } from 'lucide-react'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import { useLang } from '../hooks/useLang'
import type { CostSummary, ProjectCost } from '../lib/types'

// 토큰 수를 읽기 쉽게 포맷 (e.g. 2300000 → "2.3M")
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

type Period = 7 | 30 | 365

const PERIODS: { label: string; value: Period }[] = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: 'All', value: 365 },
]

interface SummaryCardProps {
  label: string
  value: string
  icon: React.ElementType
  accent: string
}

function SummaryCard({ label, value, icon: Icon, accent }: SummaryCardProps) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 border-l-2 ${accent} rounded-md p-4`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{label}</span>
        <Icon size={14} strokeWidth={1.5} className="text-zinc-700 mt-0.5 shrink-0" />
      </div>
      <span className="font-mono text-2xl font-semibold text-zinc-100 leading-none">{value}</span>
    </div>
  )
}

export default function Cost() {
  const { t } = useLang()
  const [period, setPeriod] = useState<Period>(7)

  const { data: summary, isLoading: summaryLoading } = useQuery<CostSummary>({
    queryKey: ['cost-summary', period],
    queryFn: () => api.cost.summary(period),
    staleTime: 30_000,
  })

  const { data: byProject = [], isLoading: projectLoading } = useQuery<ProjectCost[]>({
    queryKey: ['cost-by-project', period],
    queryFn: () => api.cost.byProject(period),
    staleTime: 30_000,
  })

  const maxCost = byProject.length > 0 ? Math.max(...byProject.map(p => p.cost), 0.001) : 0.001

  return (
    <div>
      <PageHeader title={t('cost.title')} subtitle={t('cost.subtitle')}>
        <InfoTooltip
          title={CATEGORY_INFO.cost.title}
          description={CATEGORY_INFO.cost.description}
          detail={CATEGORY_INFO.cost.detail}
        />
        {/* 기간 선택 버튼 */}
        <div className="flex items-center gap-1 bg-zinc-800 rounded-md p-0.5">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                period === p.value
                  ? 'bg-fuchsia-500/20 text-fuchsia-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          label={t('cost.totalTokens')}
          value={summaryLoading ? '—' : formatTokens((summary?.total_tokens_in ?? 0) + (summary?.total_tokens_out ?? 0))}
          icon={Cpu}
          accent="border-l-violet-500/60"
        />
        <SummaryCard
          label={t('cost.estCost')}
          value={summaryLoading ? '—' : `$${summary?.total_cost_usd.toFixed(2) ?? '0.00'}`}
          icon={DollarSign}
          accent="border-l-fuchsia-500/60"
        />
        <SummaryCard
          label={t('cost.sessions')}
          value={summaryLoading ? '—' : String(summary?.session_count ?? 0)}
          icon={FolderOpen}
          accent="border-l-amber-500/60"
        />
        <SummaryCard
          label={t('cost.toolCalls')}
          value={summaryLoading ? '—' : String(summary?.tool_calls ?? 0)}
          icon={Wrench}
          accent="border-l-violet-500/60"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 프로젝트별 비용 바 차트 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4">
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4">
            {t('cost.byProject')}
          </h3>
          {projectLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-6 bg-zinc-800 rounded animate-pulse" />
              ))}
            </div>
          ) : byProject.length === 0 ? (
            <p className="text-xs text-zinc-600 font-mono">No data</p>
          ) : (
            <div className="space-y-2">
              {byProject.slice(0, 10).map((p) => (
                <div key={p.project}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono text-[10px] text-zinc-500 truncate max-w-[160px]" title={p.project}>
                      {p.project}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">${p.cost.toFixed(3)}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-fuchsia-500/60 rounded-full transition-all duration-300"
                      style={{ width: `${(p.cost / maxCost) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 모델별 사용량 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4">
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4">
            Model Breakdown
          </h3>
          {summaryLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-zinc-800 rounded animate-pulse" />
              ))}
            </div>
          ) : !summary || Object.keys(summary.model_usage).length === 0 ? (
            <p className="text-xs text-zinc-600 font-mono">No model data</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(summary.model_usage).map(([model, usage]) => (
                <div key={model} className="bg-zinc-800/50 rounded-md px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-zinc-300 capitalize">{model}</span>
                    <span className="font-mono text-xs text-fuchsia-400">${usage.cost.toFixed(3)}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] font-mono text-zinc-500">
                    <span>in: {formatTokens(usage.input)}</span>
                    <span>out: {formatTokens(usage.output)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 일평균 비용 */}
          {summary && (
            <div className="mt-4 pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-zinc-600 uppercase">Daily avg</span>
                <span className="font-mono text-xs text-zinc-300">${summary.daily_avg_cost.toFixed(2)}/day</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 면책 문구 */}
      <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-md px-4 py-3">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          * {t('cost.disclaimer')}
        </p>
        <p className="text-[10px] text-zinc-600 mt-1.5 leading-relaxed">
          Calculated from session JSONL input/output tokens × model pricing.
          (Opus: $5/$25, Sonnet: $3/$15, Haiku: $1/$5 per 1M tokens).
          Cache/batch discounts not included. Separate from Max/Pro subscription.
        </p>
      </div>
    </div>
  )
}
