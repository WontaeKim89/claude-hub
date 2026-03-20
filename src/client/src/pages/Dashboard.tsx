import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Sparkles,
  Puzzle,
  Bot,
  Webhook,
  Server,
  FolderOpen,
  History,
  Plus,
  FileText,
  Store,
  ArrowRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { BackupHistory } from '../components/shared/BackupHistory'
import { StatusDot } from '../components/shared/StatusDot'
import { Skeleton } from '../components/shared/Skeleton'
import { useLang } from '../hooks/useLang'
import type { DashboardData, HealthResult } from '../lib/types'

// stat 카드 border 색상 매핑
const ACCENT_COLORS = {
  emerald: 'border-l-emerald-500/60',
  teal: 'border-l-teal-500/60',
  amber: 'border-l-amber-500/60',
  red: 'border-l-red-500/60',
  violet: 'border-l-violet-500/60',
  zinc: 'border-l-zinc-600',
} as const

type AccentKey = keyof typeof ACCENT_COLORS

interface StatCardProps {
  label: string
  value: number
  icon: React.ElementType
  accent: AccentKey
  sub?: string
}

function StatCard({ label, value, icon: Icon, accent, sub }: StatCardProps) {
  const borderColor = ACCENT_COLORS[accent]
  return (
    <div
      className={`bg-zinc-900 border border-zinc-800 border-l-2 ${borderColor} rounded-md p-4 glow-emerald hover:border-zinc-700 hover:scale-[1.01] transition-all duration-150 cursor-default`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{label}</span>
        <Icon size={14} strokeWidth={1.5} className="text-zinc-700 mt-0.5 shrink-0" />
      </div>
      <span className="font-mono text-2xl font-semibold text-zinc-100 leading-none">{value}</span>
      {sub && <p className="mt-1.5 text-[10px] text-zinc-600 font-mono">{sub}</p>}
    </div>
  )
}

// 로딩 중 stat card skeleton
function StatCardSkeleton() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 border-l-2 border-l-zinc-700 rounded-md p-4">
      <div className="flex items-start justify-between mb-2">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-3.5 w-3.5 rounded" />
      </div>
      <Skeleton className="h-7 w-10 mt-1" />
      <Skeleton className="h-2 w-24 mt-2" />
    </div>
  )
}

interface QuickActionProps {
  icon: React.ElementType
  label: string
  to: string
}

function QuickAction({ icon: Icon, label, to }: QuickActionProps) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className="group flex items-center gap-2.5 px-3 py-2 w-full text-left rounded text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-all duration-150"
    >
      <Icon size={13} strokeWidth={1.5} className="text-zinc-600 group-hover:text-emerald-400 transition-colors duration-150 shrink-0" />
      <span>{label}</span>
      <ArrowRight size={11} strokeWidth={1.5} className="ml-auto text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
    </button>
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

  const isLoading = dashLoading || healthLoading

  const stats: StatCardProps[] = [
    {
      label: t('dashboard.skills'),
      value: dashboard?.skills?.total ?? 0,
      icon: Sparkles,
      accent: 'emerald',
      sub: `${dashboard?.skills?.custom ?? 0} custom · ${dashboard?.skills?.installed ?? 0} installed`,
    },
    {
      label: t('dashboard.plugins'),
      value: dashboard?.plugins?.total ?? 0,
      icon: Puzzle,
      accent: 'teal',
      sub: `${dashboard?.plugins?.enabled ?? 0} enabled`,
    },
    {
      label: t('dashboard.agents'),
      value: dashboard?.agents?.total ?? 0,
      icon: Bot,
      accent: 'amber',
    },
    {
      label: t('dashboard.hooks'),
      value: dashboard?.hooks?.total ?? 0,
      icon: Webhook,
      accent: 'red',
    },
    {
      label: t('dashboard.mcp'),
      value: dashboard?.mcp_servers?.total ?? 0,
      icon: Server,
      accent: 'violet',
    },
    {
      label: t('dashboard.projects'),
      value: dashboard?.projects?.total ?? 0,
      icon: FolderOpen,
      accent: 'zinc',
    },
  ]

  const errorCount = health?.filter((r) => !r.valid).length ?? 0
  const totalCount = health?.length ?? 0

  return (
    <div>
      <div className="flex items-start justify-between mb-0">
        <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
        <button
          onClick={() => setShowBackupHistory(true)}
          className="flex items-center gap-1.5 mt-0.5 px-3 py-1.5 text-xs text-zinc-400 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200 rounded-md transition-colors duration-150"
        >
          <History size={13} strokeWidth={1.5} />
          {t('dashboard.backupHistory')}
        </button>
      </div>

      {/* Stat cards — 3x2 grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats.map((s) => <StatCard key={s.label} {...s} />)
        }
      </div>

      {/* Middle row: Quick Actions + Validation Status */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Quick Actions */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <span className="text-xs font-medium text-zinc-400">Quick Actions</span>
          </div>
          <div className="p-2">
            <QuickAction icon={Plus} label="New Skill" to="/skills" />
            <QuickAction icon={Bot} label="New Agent" to="/agents" />
            <QuickAction icon={FileText} label="Edit CLAUDE.md" to="/claude-md" />
            <QuickAction icon={Store} label="Browse Marketplace" to="/marketplace" />
          </div>
        </div>

        {/* Validation Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-400">{t('dashboard.validation')}</span>
              {!isLoading && totalCount > 0 && (
                <span className="font-mono text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                  {totalCount}
                </span>
              )}
            </div>
            {!isLoading && (
              errorCount > 0 ? (
                <span className="font-mono text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                  {errorCount} issue{errorCount > 1 ? 's' : ''}
                </span>
              ) : totalCount > 0 ? (
                <span className="font-mono text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                  {t('dashboard.allValid')}
                </span>
              ) : null
            )}
          </div>

          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
            </div>
          ) : health && health.length > 0 ? (
            <div className="overflow-y-auto max-h-44">
              <table className="w-full text-xs">
                <tbody>
                  {health.map((result, i) => (
                    <tr
                      key={i}
                      className={`border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/30 transition-colors duration-150 ${i % 2 === 0 ? '' : 'bg-zinc-900/50'}`}
                    >
                      <td className="px-3 py-2 w-6">
                        <StatusDot variant={result.valid ? 'emerald' : 'amber'} />
                      </td>
                      <td className="px-2 py-2 font-mono text-zinc-400 max-w-[120px]">
                        <span
                          className="block truncate"
                          title={result.target}
                        >
                          {result.target}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-zinc-500 text-[10px]">{result.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-4 text-xs text-zinc-600">No validation results available.</p>
          )}
        </div>
      </div>

      {/* Environment Summary */}
      {!isLoading && dashboard && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="text-xs font-medium text-zinc-400">Environment Summary</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-wide">Plugins</span>
              <span className="font-mono text-xs text-zinc-300">
                {dashboard.plugins.enabled}/{dashboard.plugins.total} enabled
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-wide">MCP</span>
              <span className="font-mono text-xs text-zinc-300">{dashboard.mcp_servers.total} servers</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-wide">Hooks</span>
              <span className="font-mono text-xs text-zinc-300">{dashboard.hooks.total} active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-wide">Projects</span>
              <span className="font-mono text-xs text-zinc-300">{dashboard.projects.total} tracked</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-wide">Skills</span>
              <span className="font-mono text-xs text-zinc-300">
                {dashboard.skills.custom} custom · {dashboard.skills.installed} installed
              </span>
            </div>
          </div>
        </div>
      )}

      {showBackupHistory && (
        <BackupHistory onClose={() => setShowBackupHistory(false)} />
      )}
    </div>
  )
}
