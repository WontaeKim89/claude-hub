import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, Puzzle, Bot, Webhook, Server, FolderOpen, History } from 'lucide-react'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { BackupHistory } from '../components/shared/BackupHistory'
import { StatusDot } from '../components/shared/StatusDot'
import { useLang } from '../hooks/useLang'
import type { DashboardData, HealthResult } from '../lib/types'

interface StatCardProps {
  label: string
  value: number
  icon: React.ElementType
  dotVariant: 'emerald' | 'teal' | 'amber' | 'red' | 'zinc' | 'violet'
  sub?: string
}

function StatCard({ label, value, icon: Icon, dotVariant, sub }: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4">
      <div className="flex items-center gap-2 mb-3">
        <StatusDot variant={dotVariant === 'violet' ? 'zinc' : dotVariant} />
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="font-mono text-2xl font-semibold text-zinc-100">{value}</span>
        <Icon size={16} strokeWidth={1.5} className="text-zinc-700" />
      </div>
      {sub && <p className="mt-1 text-xs text-zinc-600 font-mono">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [showBackupHistory, setShowBackupHistory] = useState(false)
  const { t } = useLang()

  const { data: dashboard, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard.get(),
  })

  const { data: health, isLoading: healthLoading } = useQuery<HealthResult[]>({
    queryKey: ['health'],
    queryFn: () => api.health.get(),
  })

  if (dashLoading || healthLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="font-mono text-zinc-600 text-xs">{t('dashboard.loading')}</span>
      </div>
    )
  }

  const stats: StatCardProps[] = [
    { label: t('dashboard.skills'), value: dashboard?.skills?.total ?? 0, icon: Sparkles, dotVariant: 'emerald', sub: `${dashboard?.skills?.custom ?? 0} custom · ${dashboard?.skills?.installed ?? 0} installed` },
    { label: t('dashboard.plugins'), value: dashboard?.plugins?.total ?? 0, icon: Puzzle, dotVariant: 'teal', sub: `${dashboard?.plugins?.enabled ?? 0} enabled` },
    { label: t('dashboard.agents'), value: dashboard?.agents?.total ?? 0, icon: Bot, dotVariant: 'amber' },
    { label: t('dashboard.hooks'), value: dashboard?.hooks?.total ?? 0, icon: Webhook, dotVariant: 'red' },
    { label: t('dashboard.mcp'), value: dashboard?.mcp_servers?.total ?? 0, icon: Server, dotVariant: 'teal' },
    { label: t('dashboard.projects'), value: dashboard?.projects?.total ?? 0, icon: FolderOpen, dotVariant: 'zinc' },
  ]

  const errorCount = health?.filter((r) => !r.valid).length ?? 0

  return (
    <div>
      <div className="flex items-start justify-between mb-0">
        <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
        <button
          onClick={() => setShowBackupHistory(true)}
          className="flex items-center gap-1.5 mt-0.5 px-3 py-1.5 text-xs text-zinc-400 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200 rounded-md transition-colors"
        >
          <History size={13} strokeWidth={1.5} />
          {t('dashboard.backupHistory')}
        </button>
      </div>

      {/* Stat cards — 3x2 grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Health status — table style */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-xs font-medium text-zinc-400">{t('dashboard.validation')}</span>
          {errorCount > 0 ? (
            <span className="font-mono text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
              {errorCount} issue{errorCount > 1 ? 's' : ''}
            </span>
          ) : health && health.length > 0 ? (
            <span className="font-mono text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
              {t('dashboard.allValid')}
            </span>
          ) : null}
        </div>

        {health && health.length > 0 ? (
          <table className="w-full text-xs">
            <tbody>
              {health.map((result, i) => (
                <tr
                  key={i}
                  className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-4 py-2.5 w-6">
                    <StatusDot variant={result.valid ? 'emerald' : 'amber'} />
                  </td>
                  <td className="px-2 py-2.5 font-mono text-zinc-400 truncate max-w-xs">
                    {result.target}
                  </td>
                  <td className="px-2 py-2.5 text-zinc-500">{result.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-4 text-xs text-zinc-600">No validation results available.</p>
        )}
      </div>

      {showBackupHistory && (
        <BackupHistory onClose={() => setShowBackupHistory(false)} />
      )}
    </div>
  )
}
