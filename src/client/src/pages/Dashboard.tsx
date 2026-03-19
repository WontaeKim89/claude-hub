import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import type { DashboardData, HealthResult } from '../lib/types'

interface StatCardProps {
  label: string
  value: number
  color: string
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className={`bg-zinc-900 rounded-lg border border-zinc-800 p-5 border-t-2 ${color}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-zinc-100">{value}</p>
    </div>
  )
}

export default function Dashboard() {
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
        <span className="text-zinc-500 text-sm">Loading...</span>
      </div>
    )
  }

  const stats = [
    { label: 'Skills', value: dashboard?.skills ?? 0, color: 'border-t-indigo-500' },
    { label: 'Plugins', value: dashboard?.plugins ?? 0, color: 'border-t-emerald-500' },
    { label: 'MCP Servers', value: dashboard?.mcp_servers ?? 0, color: 'border-t-amber-500' },
    { label: 'Hooks', value: dashboard?.hooks ?? 0, color: 'border-t-red-500' },
  ]

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your claude-hub configuration" />

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} color={s.color} />
        ))}
      </div>

      {/* Health status */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Validation Status</h3>
        {health && health.length > 0 ? (
          <ul className="space-y-2">
            {health.map((result, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={`mt-0.5 text-sm ${result.valid ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {result.valid ? '✓' : '⚠'}
                </span>
                <div>
                  <span className="text-sm text-zinc-300">{result.target}</span>
                  <p className="text-xs text-zinc-500">{result.message}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No validation results available.</p>
        )}
      </div>
    </div>
  )
}
