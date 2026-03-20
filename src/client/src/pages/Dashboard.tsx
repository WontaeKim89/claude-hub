import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { BackupHistory } from '../components/shared/BackupHistory'
import { StatusDot } from '../components/shared/StatusDot'
import { Skeleton } from '../components/shared/Skeleton'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
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

// Usage bar: 상대 너비로 히트 수를 시각화하는 단일 행
function UsageBar({ name, hitCount, maxCount, accent }: { name: string; hitCount: number; maxCount: number; accent: 'emerald' | 'teal' }) {
  const pct = maxCount > 0 ? (hitCount / maxCount) * 100 : 0
  const barColor = accent === 'emerald' ? 'bg-emerald-500/60' : 'bg-teal-500/60'
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="font-mono text-xs text-zinc-300 w-32 shrink-0 truncate" title={name}>{name}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[10px] text-zinc-500 w-8 text-right shrink-0">{hitCount}</span>
    </div>
  )
}

// Timeline mini bar chart: 날짜별 사용량
function TimelineChart({ data }: { data: Array<{ date: string; total: number }> }) {
  const max = Math.max(...data.map((d) => d.total), 1)
  return (
    <div className="flex items-end gap-0.5 h-12">
      {data.map((d) => {
        const pct = (d.total / max) * 100
        return (
          <div
            key={d.date}
            className="flex-1 bg-emerald-500/50 rounded-sm hover:bg-emerald-400/70 transition-colors duration-100 cursor-default"
            style={{ height: `${Math.max(pct, 4)}%` }}
            title={`${d.date}: ${d.total}`}
          />
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const [showBackupHistory, setShowBackupHistory] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; name: string } | null>(null)
  const queryClient = useQueryClient()
  const { t } = useLang()

  const { data: dashboard, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard.get(),
  })

  const { data: health, isLoading: healthLoading } = useQuery<HealthResult[]>({
    queryKey: ['health'],
    queryFn: () => api.health.get(),
  })

  const { data: topSkills } = useQuery({
    queryKey: ['stats', 'skills'],
    queryFn: () => api.stats.topSkills(10),
  })

  const { data: topPlugins } = useQuery({
    queryKey: ['stats', 'plugins'],
    queryFn: () => api.stats.topPlugins(5),
  })

  const { data: timeline } = useQuery({
    queryKey: ['stats', 'timeline'],
    queryFn: () => api.stats.timeline(30),
  })

  const { data: unusedItems } = useQuery({
    queryKey: ['stats', 'unused'],
    queryFn: () => api.stats.unused(30),
  })

  const syncMutation = useMutation({
    mutationFn: () => api.stats.sync(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      alert(`${result.files_parsed} ${t('stats.syncResult')}, ${result.events_found} events found`)
    },
  })

  const handleDeleteUnused = async (item: { type: string; name: string }) => {
    try {
      if (item.type === 'skill') {
        await api.skills.delete(item.name)
      } else if (item.type === 'plugin') {
        await api.plugins.remove(item.name)
      }
      queryClient.invalidateQueries({ queryKey: ['stats', 'unused'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch {
      // 삭제 실패 시 조용히 무시
    }
    setDeleteTarget(null)
  }

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
        <div className="flex items-center gap-2 mt-0.5">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200 rounded-md transition-colors duration-150 disabled:opacity-50"
          >
            <RefreshCw size={13} strokeWidth={1.5} className={syncMutation.isPending ? 'animate-spin' : ''} />
            {t('stats.syncHistory')}
          </button>
          <button
            onClick={() => setShowBackupHistory(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200 rounded-md transition-colors duration-150"
          >
            <History size={13} strokeWidth={1.5} />
            {t('dashboard.backupHistory')}
          </button>
        </div>
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

      {/* Usage Stats 섹션 */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        {/* Top Used Skills */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">{t('stats.topSkills')}</span>
            <Sparkles size={13} strokeWidth={1.5} className="text-emerald-600" />
          </div>
          <div className="px-4 py-3">
            {topSkills && topSkills.length > 0 ? (
              topSkills.map((s) => (
                <UsageBar
                  key={s.name}
                  name={s.name}
                  hitCount={s.hit_count}
                  maxCount={topSkills[0].hit_count}
                  accent="emerald"
                />
              ))
            ) : (
              <div className="flex items-center justify-between py-2">
                <p className="text-xs text-zinc-600">{t('stats.noData')}</p>
                <button
                  onClick={() => syncMutation.mutate()}
                  className="text-xs text-emerald-500 hover:text-emerald-400 px-2 py-1 border border-zinc-800 rounded transition-colors"
                >
                  {t('stats.sync')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Top Used Plugins */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">{t('stats.topPlugins')}</span>
            <Puzzle size={13} strokeWidth={1.5} className="text-teal-600" />
          </div>
          <div className="px-4 py-3">
            {topPlugins && topPlugins.length > 0 ? (
              topPlugins.map((p) => (
                <UsageBar
                  key={p.name}
                  name={p.name}
                  hitCount={p.hit_count}
                  maxCount={topPlugins[0].hit_count}
                  accent="teal"
                />
              ))
            ) : (
              <p className="text-xs text-zinc-600 py-2">{t('stats.noData')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Usage Timeline */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden mt-4">
        <div className="px-4 py-3 border-b border-zinc-800">
          <span className="text-xs font-medium text-zinc-400">{t('stats.timeline')}</span>
          <span className="font-mono text-[10px] text-zinc-600 ml-2">30d</span>
        </div>
        <div className="px-4 py-4">
          {timeline && timeline.length > 0 ? (
            <TimelineChart data={timeline} />
          ) : (
            <p className="text-xs text-zinc-600">{t('stats.noData')}</p>
          )}
        </div>
      </div>

      {/* Unused Items Warning */}
      {unusedItems && unusedItems.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden mt-4">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
            <AlertTriangle size={13} strokeWidth={1.5} className="text-amber-500" />
            <span className="text-xs font-medium text-zinc-400">{t('stats.unused')}</span>
          </div>
          <div className="px-4 py-2">
            {unusedItems.map((item) => (
              <div key={`${item.type}-${item.name}`} className="flex items-center justify-between py-1.5 border-b border-zinc-800/50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${item.type === 'skill' ? 'text-emerald-400 bg-emerald-400/10' : 'text-teal-400 bg-teal-400/10'}`}>
                    {item.type}
                  </span>
                  <span className="font-mono text-xs text-zinc-300">{item.name}</span>
                  <span className="text-[10px] text-zinc-600">30 {t('stats.unusedDays')}</span>
                </div>
                <button
                  onClick={() => setDeleteTarget({ type: item.type, name: item.name })}
                  className="text-[10px] text-red-500 hover:text-red-400 border border-red-900/40 hover:border-red-700/60 px-2 py-0.5 rounded transition-colors"
                >
                  {t('stats.remove')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showBackupHistory && (
        <BackupHistory onClose={() => setShowBackupHistory(false)} />
      )}

      {deleteTarget && (
        <DangerDeleteDialog
          title={`${deleteTarget.type} 제거: ${deleteTarget.name}`}
          confirmText={deleteTarget.name}
          onConfirm={() => handleDeleteUnused(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
