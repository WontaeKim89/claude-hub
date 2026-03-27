import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles,
  Puzzle,
  Bot,
  Webhook,
  Server,
  History,
  AlertTriangle,
  RefreshCw,
  Info,
  ArrowUpCircle,
  Loader2,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api-client'
import { BackupHistory } from '../components/shared/BackupHistory'
import { Skeleton } from '../components/shared/Skeleton'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
import { useLang } from '../hooks/useLang'
import type { DashboardData } from '../lib/types'

// stat 카드 border 색상 매핑
const ACCENT_COLORS = {
  emerald: 'border-l-fuchsia-500/60',
  teal: 'border-l-violet-500/60',
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
  link?: string
}

function StatCard({ label, value, icon: Icon, accent, sub, link }: StatCardProps) {
  const navigate = useNavigate()
  const borderColor = ACCENT_COLORS[accent]
  return (
    <div
      onClick={() => link && navigate(link)}
      className={`bg-zinc-900 border border-zinc-800 border-l-2 ${borderColor} rounded-md p-3 glow-emerald hover:border-zinc-700 transition-all duration-150 ${link ? 'cursor-pointer hover:border-fuchsia-500/30' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{label}</span>
        <Icon size={14} strokeWidth={1.5} className="text-zinc-700 mt-0.5 shrink-0" />
      </div>
      <span className="font-mono text-xl font-semibold text-zinc-100 leading-none">{value}</span>
      {sub && <p className="mt-1.5 text-[10px] text-zinc-600 font-mono">{sub}</p>}
    </div>
  )
}

// 버튼 옆 클릭 팝오버: Backup/Sync 설명
function HelpPopup({ content }: { content: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative flex items-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-zinc-600 hover:text-zinc-400 transition-colors"
        aria-label="help"
      >
        <Info size={13} strokeWidth={1.5} />
      </button>
      {open && (
        <>
          {/* 클릭 외부 닫기용 오버레이 */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-50 w-[280px] bg-zinc-900 border border-zinc-700 rounded-md shadow-xl p-3">
            {content.split('\n\n').map((block, i) => (
              <p key={i} className={`text-[0.7rem] leading-relaxed ${i === 0 ? 'text-zinc-300' : 'text-zinc-500 font-mono mt-2'}`}>
                {block}
              </p>
            ))}
          </div>
        </>
      )}
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

// 사용량 패널 스켈레톤
function UsagePanelSkeleton() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-800">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="px-4 py-3 space-y-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 py-2">
            <Skeleton className="w-1 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="h-2.5 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 스킬/플러그인 차트 스켈레톤
function ChartPanelSkeleton() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
      <div className="px-4 py-2 border-b border-zinc-800">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="px-4 py-3 space-y-3">
        {['w-full', 'w-5/6', 'w-4/6', 'w-3/6', 'w-2/6', 'w-1/6'].map((w, i) => (
          <div key={i} className="flex items-center gap-3 py-1">
            <Skeleton className="h-3 w-28" />
            <div className="flex-1">
              <Skeleton className={`h-1.5 rounded-full ${w}`} />
            </div>
            <Skeleton className="h-3 w-6" />
          </div>
        ))}
      </div>
    </div>
  )
}

// 리셋 시간까지 남은 시간 포맷
function formatResetTime(resetsAt: string | null): string {
  if (!resetsAt) return ''
  const diff = new Date(resetsAt).getTime() - Date.now()
  if (diff <= 0) return 'reset soon'
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return `${days}d ${remHours}h`
  }
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

// 레이트 리밋 미터 (CodexBar 스타일)
const RATE_COLOR_MAP: Record<string, { bar: string; text: string }> = {
  fuchsia: { bar: 'bg-fuchsia-500', text: 'text-fuchsia-400' },
  violet: { bar: 'bg-violet-500', text: 'text-violet-400' },
  amber: { bar: 'bg-amber-500', text: 'text-amber-400' },
  sky: { bar: 'bg-sky-500', text: 'text-sky-400' },
  indigo: { bar: 'bg-indigo-500', text: 'text-indigo-400' },
}

function RateLimitMeter({ label, utilization, resetsAt, color }: {
  label: string
  utilization: number
  resetsAt: string | null
  color: string
}) {
  const colors = RATE_COLOR_MAP[color] ?? RATE_COLOR_MAP.fuchsia
  const barColor = utilization > 80 ? 'bg-red-500' : utilization > 50 ? 'bg-amber-500' : colors.bar
  const textColor = utilization > 80 ? 'text-red-400' : utilization > 50 ? 'text-amber-400' : colors.text

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs font-medium text-zinc-200">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-xs font-semibold ${textColor}`}>
            {utilization}% used
          </span>
          {resetsAt && (
            <span className="font-mono text-[10px] text-zinc-600">
              resets in {formatResetTime(resetsAt)}
            </span>
          )}
        </div>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(utilization, 100)}%` }}
        />
      </div>
    </div>
  )
}

// 토큰 수 포맷
function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

// 사용량 수치 카드 (게이지 바 없이 수치 강조)
function UsageStat({
  label,
  sessions,
  cost,
  tokensIn,
  tokensOut,
  accentColor,
}: {
  label: string
  sessions: number
  cost: number
  tokensIn: number
  tokensOut: number
  accentColor: string
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className={`w-1 h-10 rounded-full ${accentColor} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1">
          <span className="font-mono text-[11px] text-zinc-400">{label}</span>
          <span className="font-mono text-base font-bold text-zinc-100">${cost.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span className="text-zinc-500">{sessions} sessions</span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-500">{formatTokens(tokensIn + tokensOut)} tokens</span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-600">in {formatTokens(tokensIn)} · out {formatTokens(tokensOut)}</span>
        </div>
      </div>
    </div>
  )
}

// Usage bar: 상대 너비로 히트 수를 시각화하는 단일 행
function UsageBar({ name, hitCount, maxCount, accent, indent, rank }: { name: string; hitCount: number; maxCount: number; accent: 'emerald' | 'teal'; indent?: boolean; rank?: number }) {
  const pct = maxCount > 0 ? (hitCount / maxCount) * 100 : 0
  const barColor = indent
    ? (accent === 'emerald' ? 'bg-fuchsia-500/30' : 'bg-violet-500/30')
    : (accent === 'emerald' ? 'bg-fuchsia-500/60' : 'bg-violet-500/60')
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
  return (
    <div className={`flex items-center gap-2 py-1 ${indent ? 'ml-5' : ''}`}>
      {!indent && medal ? (
        <span className="text-sm w-5 shrink-0 text-center">{medal}</span>
      ) : !indent && rank ? (
        <span className="font-mono text-[10px] text-zinc-600 w-5 shrink-0 text-center">{rank}</span>
      ) : null}
      <span className={`font-mono w-32 shrink-0 truncate ${indent ? 'text-zinc-500 text-[10px]' : 'text-xs text-zinc-300'}`} title={name}>
        {indent && <span className="text-zinc-700 mr-1">└</span>}
        {name}
      </span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[10px] text-zinc-500 w-8 text-right shrink-0">{hitCount}</span>
    </div>
  )
}

// 스킬 데이터를 prefix 기반으로 그루핑
type SkillGroup = { prefix: string; total: number; children: Array<{ name: string; hit_count: number }> }

function groupSkillsByPrefix(skills: Array<{ name: string; hit_count: number }>): Array<SkillGroup | { name: string; hit_count: number }> {
  const groups: Record<string, { total: number; children: Array<{ name: string; hit_count: number }> }> = {}
  const standalone: Array<{ name: string; hit_count: number }> = []

  for (const s of skills) {
    if (s.name.includes(':')) {
      const [prefix, sub] = [s.name.split(':')[0], s.name.split(':').slice(1).join(':')]
      if (!groups[prefix]) groups[prefix] = { total: 0, children: [] }
      groups[prefix].total += s.hit_count
      groups[prefix].children.push({ name: sub, hit_count: s.hit_count })
    } else {
      standalone.push(s)
    }
  }

  // 그룹과 standalone을 합쳐서 total 기준 정렬
  const groupEntries = Object.entries(groups).map(([prefix, g]) => ({
    prefix, total: g.total, children: g.children.sort((a, b) => b.hit_count - a.hit_count),
  }))

  const all = [
    ...groupEntries.map((g) => ({ sortKey: g.total, item: g as SkillGroup })),
    ...standalone.map((s) => ({ sortKey: s.hit_count, item: s })),
  ].sort((a, b) => b.sortKey - a.sortKey)

  return all.map((a) => a.item)
}

function isSkillGroup(item: SkillGroup | { name: string; hit_count: number }): item is SkillGroup {
  return 'prefix' in item
}

const REFRESH_OPTIONS = [
  { label: '1m', ms: 60_000 },
  { label: '3m', ms: 180_000 },
  { label: '5m', ms: 300_000 },
  { label: '10m', ms: 600_000 },
] as const

export default function Dashboard() {
  const navigate = useNavigate()
  const [showBackupHistory, setShowBackupHistory] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; name: string } | null>(null)
  const [usageTab, setUsageTab] = useState<'skills' | 'plugins'>('skills')
  const [refreshInterval, setRefreshInterval] = useState(180_000) // 기본 3분
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const queryClient = useQueryClient()
  const { t } = useLang()

  // 업데이트 체크 (서버 시작 시 1회, 이후 10분마다)
  const { data: updateInfo } = useQuery({
    queryKey: ['update-check'],
    queryFn: () => api.update.check(),
    staleTime: 600_000,
    refetchInterval: 600_000,
    retry: false,
  })

  const updateMutation = useMutation({
    mutationFn: () => api.update.apply(),
  })

  const { data: dashboard, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard.get(),
    refetchInterval: refreshInterval,
  })

  const { data: topSkills } = useQuery({
    queryKey: ['stats', 'skills'],
    queryFn: () => api.stats.topSkills(10),
    refetchInterval: refreshInterval,
  })

  const { data: topPlugins } = useQuery({
    queryKey: ['stats', 'plugins'],
    queryFn: () => api.stats.topPlugins(5),
    refetchInterval: refreshInterval,
  })

  const { data: claudeUsage } = useQuery({
    queryKey: ['claude-usage'],
    queryFn: () => api.claudeSettings.usage(),
    staleTime: 60_000,
    refetchInterval: refreshInterval,
  })

  const { data: rateLimits } = useQuery({
    queryKey: ['rate-limits'],
    queryFn: () => api.claudeSettings.rateLimits(),
    staleTime: 30_000,
    refetchInterval: refreshInterval,
    retry: false,
  })

  const { data: projectConfigs } = useQuery({
    queryKey: ['project-configs'],
    queryFn: () => api.dashboard.projectConfigs(),
    staleTime: 60_000,
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

  const isLoading = dashLoading

  const stats: StatCardProps[] = [
    {
      label: t('dashboard.skills'),
      value: dashboard?.skills?.total ?? 0,
      icon: Sparkles,
      accent: 'emerald',
      sub: `${dashboard?.skills?.custom ?? 0} custom · ${dashboard?.skills?.installed ?? 0} installed`,
      link: '/extensions?tab=skills&filter=installed',
    },
    {
      label: t('dashboard.plugins'),
      value: dashboard?.plugins?.total ?? 0,
      icon: Puzzle,
      accent: 'teal',
      sub: `${dashboard?.plugins?.enabled ?? 0} enabled`,
      link: '/extensions?tab=plugins&filter=installed',
    },
    {
      label: t('dashboard.agents'),
      value: dashboard?.agents?.total ?? 0,
      icon: Bot,
      accent: 'amber',
      link: '/extensions?tab=agents',
    },
    {
      label: t('dashboard.hooks'),
      value: dashboard?.hooks?.total ?? 0,
      icon: Webhook,
      accent: 'red',
      link: '/extensions?tab=hooks',
    },
    {
      label: t('dashboard.mcp'),
      value: dashboard?.mcp_servers?.total ?? 0,
      icon: Server,
      accent: 'violet',
      link: '/extensions?tab=mcp',
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('dashboard.title')}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {/* 자동 갱신 주기 선택 */}
          <div className="flex items-center bg-zinc-800/60 rounded-md overflow-hidden border border-zinc-800">
            {REFRESH_OPTIONS.map((opt) => (
              <button
                key={opt.ms}
                onClick={() => setRefreshInterval(opt.ms)}
                className={`px-2 py-1 text-[10px] font-mono transition-colors ${
                  refreshInterval === opt.ms
                    ? 'bg-fuchsia-500/20 text-fuchsia-400'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200 rounded-md transition-colors duration-150 disabled:opacity-50"
          >
            <RefreshCw size={13} strokeWidth={1.5} className={syncMutation.isPending ? 'animate-spin' : ''} />
            {t('stats.syncHistory')}
          </button>
          <HelpPopup content={"Extract skill/plugin usage from Claude Code session logs into statistics DB. First run imports historical data.\n\nData: ~/.claude-hub/usage.db"} />
          <button
            onClick={() => setShowBackupHistory(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200 rounded-md transition-colors duration-150"
          >
            <History size={13} strokeWidth={1.5} />
            {t('dashboard.backupHistory')}
          </button>
          <HelpPopup content={"Automatically backs up previous state whenever settings are modified. Restore accidentally changed settings.\n\nLocation: ~/.claude-hub/backups/\nMax: 50 backups (FIFO)"} />
        </div>
      </div>

      {/* Update banner */}
      {updateInfo?.update_available && !updateDismissed && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-fuchsia-500/8 border border-fuchsia-500/25 rounded-lg">
          <ArrowUpCircle size={16} className="text-fuchsia-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-zinc-200">
              {t('update.available')}
            </span>
            <span className="font-mono text-xs text-fuchsia-400 ml-1.5">
              v{updateInfo.current} → v{updateInfo.latest}
            </span>
          </div>
          {updateMutation.isPending ? (
            <div className="flex items-center gap-1.5 text-xs text-fuchsia-400">
              <Loader2 size={13} className="animate-spin" />
              {t('update.updating')}
            </div>
          ) : updateMutation.isSuccess && updateMutation.data?.ok ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-fuchsia-400">{t('update.done')}</span>
              <button
                onClick={() => window.location.reload()}
                className="px-2.5 py-1 text-[10px] font-mono bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors"
              >
                {t('update.restart')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => updateMutation.mutate()}
              className="px-3 py-1 text-xs font-mono bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors"
            >
              {t('update.install')}
            </button>
          )}
          <button onClick={() => setUpdateDismissed(true)} className="text-zinc-600 hover:text-zinc-400 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Project Harness Status — 로딩 시에도 스켈레톤 표시 */}
      {!projectConfigs ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden mb-4">
          <div className="px-3 py-2 border-b border-zinc-800">
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="p-3 space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        </div>
      ) : projectConfigs.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden mb-4">
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-300">{t('dashboard.harnessStatus')}</span>
            <button onClick={() => navigate('/projects')} className="text-[10px] text-fuchsia-400 hover:text-fuchsia-300 transition-colors">View All →</button>
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-zinc-800/50 text-zinc-500">
                <th className="text-left px-3 py-1.5 font-mono font-medium">Project</th>
                <th className="px-2 py-1.5 text-center font-mono font-medium">CLAUDE.md</th>
                <th className="px-2 py-1.5 text-center font-mono font-medium">memory/</th>
                <th className="px-2 py-1.5 text-center font-mono font-medium">settings.json</th>
                <th className="px-2 py-1.5 text-center font-mono font-medium">agents/</th>
                <th className="px-2 py-1.5 text-center font-mono font-medium">commands/</th>
                <th className="px-2 py-1.5 w-20 text-right font-mono font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {projectConfigs.slice(0, 5).map((p) => (
                <tr
                  key={p.encoded}
                  className="border-b border-zinc-800/20 hover:bg-zinc-800/20 transition-colors cursor-pointer"
                  onClick={() => navigate(`/projects?select=${encodeURIComponent(p.path)}`)}
                >
                  <td className="px-3 py-1.5 font-mono text-zinc-300 truncate max-w-[180px]" title={p.path}>{p.name}</td>
                  <td className="px-2 py-1.5 text-center"><span className={p.claude_md ? 'text-fuchsia-400' : 'text-zinc-800'}>●</span></td>
                  <td className="px-2 py-1.5 text-center"><span className={p.memory ? 'text-violet-400' : 'text-zinc-800'}>●</span></td>
                  <td className="px-2 py-1.5 text-center"><span className={p.settings ? 'text-amber-400' : 'text-zinc-800'}>●</span></td>
                  <td className="px-2 py-1.5 text-center"><span className={p.agents ? 'text-sky-400' : 'text-zinc-800'}>●</span></td>
                  <td className="px-2 py-1.5 text-center"><span className={p.commands ? 'text-green-400' : 'text-zinc-800'}>●</span></td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    {p.count < 3 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/projects?select=${encodeURIComponent(p.path)}&wizard=1`) }}
                        className="inline-flex items-center gap-1 text-[9px] font-mono text-fuchsia-400 hover:text-fuchsia-300 bg-fuchsia-500/10 border border-fuchsia-500/30 px-1.5 py-0.5 rounded transition-colors leading-none"
                      >
                        <Sparkles size={9} />AI Setup
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stat cards — 5 in a row */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats.map((s) => <StatCard key={s.label} {...s} />)
        }
      </div>

      {/* Usage Stats + Claude 사용량 — 2-column layout */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        {/* Left: Top Used (tabbed skills/plugins) */}
        {!topSkills && !topPlugins ? <ChartPanelSkeleton /> : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-0">
            <button
              onClick={() => setUsageTab('skills')}
              className={`text-xs font-mono px-3 py-1 border-b-2 transition-colors ${
                usageTab === 'skills' ? 'border-fuchsia-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t('stats.topSkills')}
            </button>
            <button
              onClick={() => setUsageTab('plugins')}
              className={`text-xs font-mono px-3 py-1 border-b-2 transition-colors ${
                usageTab === 'plugins' ? 'border-fuchsia-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t('stats.topPlugins')}
            </button>
          </div>
          <div className="px-4 py-3">
            {usageTab === 'skills' ? (
              topSkills && topSkills.length > 0 ? (() => {
                const grouped = groupSkillsByPrefix(topSkills)
                const maxHit = grouped.length > 0 ? (isSkillGroup(grouped[0]) ? grouped[0].total : (grouped[0] as {hit_count:number}).hit_count) : 1
                let rankCounter = 0
                return grouped.map((item) => {
                  rankCounter++
                  const rank = rankCounter
                  return isSkillGroup(item) ? (
                    <div key={item.prefix}>
                      <UsageBar name={item.prefix} hitCount={item.total} maxCount={maxHit} accent="emerald" rank={rank} />
                      {item.children.map((child) => (
                        <UsageBar key={child.name} name={child.name} hitCount={child.hit_count} maxCount={maxHit} accent="emerald" indent />
                      ))}
                    </div>
                  ) : (
                    <UsageBar key={item.name} name={item.name} hitCount={item.hit_count} maxCount={maxHit} accent="emerald" rank={rank} />
                  )
                })
              })() : (
                <div className="flex items-center justify-between py-2">
                  <p className="text-xs text-zinc-600">{t('stats.noData')}</p>
                  <button
                    onClick={() => syncMutation.mutate()}
                    className="text-xs text-fuchsia-500 hover:text-fuchsia-400 px-2 py-1 border border-zinc-800 rounded transition-colors"
                  >
                    {t('stats.sync')}
                  </button>
                </div>
              )
            ) : (
              topPlugins && topPlugins.length > 0 ? (
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
              )
            )}
          </div>
        </div>
        )}

        {/* Right: Claude 사용량 — 구독자(Max/Pro)와 API 사용자 자동 분기 */}
        {!claudeUsage ? <UsagePanelSkeleton /> : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-800">
            <span className="text-xs font-medium text-zinc-400">{t('dashboard.usage')}</span>
          </div>
          <div className="px-4 py-3 space-y-3">
            {/* 구독형 (Max/Pro): Rate Limits가 있으면 구독자 */}
            {rateLimits?.five_hour ? (
              <>
                <RateLimitMeter
                  label="Session"
                  utilization={rateLimits.five_hour.utilization}
                  resetsAt={rateLimits.five_hour.resets_at}
                  color="fuchsia"
                />
                {rateLimits.seven_day && (
                  <RateLimitMeter
                    label="Weekly"
                    utilization={rateLimits.seven_day.utilization}
                    resetsAt={rateLimits.seven_day.resets_at}
                    color="violet"
                  />
                )}
                {/* Sonnet 모델 리밋 — 0%여도 표시 */}
                {rateLimits.seven_day_sonnet && (
                  <RateLimitMeter
                    label="Sonnet"
                    utilization={rateLimits.seven_day_sonnet.utilization}
                    resetsAt={rateLimits.seven_day_sonnet.resets_at}
                    color="violet"
                  />
                )}

                {/* 토큰 사용량 상세 */}
                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-zinc-400">{t('dashboard.today')}</span>
                    <span className="font-mono text-xs text-zinc-200">
                      {formatTokens((claudeUsage.today?.tokens_in ?? 0) + (claudeUsage.today?.tokens_out ?? 0))} tokens
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-zinc-400">{t('dashboard.weekly')}</span>
                    <span className="font-mono text-xs text-zinc-200">
                      {formatTokens((claudeUsage.weekly?.tokens_in ?? 0) + (claudeUsage.weekly?.tokens_out ?? 0))} tokens
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-zinc-400">{t('dashboard.monthly')}</span>
                    <span className="font-mono text-xs text-zinc-200">
                      {formatTokens((claudeUsage.monthly?.tokens_in ?? 0) + (claudeUsage.monthly?.tokens_out ?? 0))} tokens
                    </span>
                  </div>
                </div>

                {/* 세션 수 */}
                <div className="pt-2 border-t border-zinc-800/50">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600">
                    <span>{t('dashboard.today')}: {claudeUsage.today?.sessions ?? 0} sessions</span>
                    <span>{t('dashboard.monthly')}: {claudeUsage.monthly?.sessions ?? 0} sessions</span>
                  </div>
                </div>
              </>
            ) : (
              /* API 사용자: Rate Limit 없음 — 토큰/비용 중심 표시 */
              <>
                <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-wider">API Usage</p>
                <div className="divide-y divide-zinc-800/60">
                  <UsageStat
                    label={t('dashboard.today')}
                    sessions={claudeUsage.today?.sessions ?? 0}
                    cost={claudeUsage.today?.cost ?? 0}
                    tokensIn={claudeUsage.today?.tokens_in ?? 0}
                    tokensOut={claudeUsage.today?.tokens_out ?? 0}
                    accentColor="bg-amber-500"
                  />
                  <UsageStat
                    label={t('dashboard.weekly')}
                    sessions={claudeUsage.weekly?.sessions ?? 0}
                    cost={claudeUsage.weekly?.cost ?? 0}
                    tokensIn={claudeUsage.weekly?.tokens_in ?? 0}
                    tokensOut={claudeUsage.weekly?.tokens_out ?? 0}
                    accentColor="bg-fuchsia-500"
                  />
                  <UsageStat
                    label={t('dashboard.monthly')}
                    sessions={claudeUsage.monthly?.sessions ?? 0}
                    cost={claudeUsage.monthly?.cost ?? 0}
                    tokensIn={claudeUsage.monthly?.tokens_in ?? 0}
                    tokensOut={claudeUsage.monthly?.tokens_out ?? 0}
                    accentColor="bg-violet-500"
                  />
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </div>

      {/* (Project Harness Status moved above stat cards) */}

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
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${item.type === 'skill' ? 'text-fuchsia-400 bg-fuchsia-400/10' : 'text-violet-400 bg-violet-400/10'}`}>
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
          title={`${deleteTarget.type} Remove: ${deleteTarget.name}`}
          confirmText={deleteTarget.name}
          onConfirm={() => handleDeleteUnused(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
