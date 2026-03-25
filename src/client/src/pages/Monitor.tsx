import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { CATEGORY_INFO } from '../lib/category-info'
import { useLang } from '../hooks/useLang'
import type { MonitorEvent } from '../lib/types'

// 도구별 컬러 매핑
const TOOL_COLORS: Record<string, string> = {
  Skill: 'bg-purple-500',
  Read: 'bg-violet-500',
  Write: 'bg-red-500',
  Edit: 'bg-red-500',
  Bash: 'bg-fuchsia-500',
  Grep: 'bg-fuchsia-500',
  Glob: 'bg-violet-500',
  Agent: 'bg-amber-500',
}

function toolColor(tool: string): string {
  return TOOL_COLORS[tool] ?? 'bg-zinc-500'
}

function toolTextColor(tool: string): string {
  const map: Record<string, string> = {
    Skill: 'text-purple-400',
    Read: 'text-violet-400',
    Write: 'text-red-400',
    Edit: 'text-red-400',
    Bash: 'text-fuchsia-400',
    Grep: 'text-fuchsia-400',
    Glob: 'text-violet-400',
    Agent: 'text-amber-400',
  }
  return map[tool] ?? 'text-zinc-400'
}

function EventRow({ event }: { event: MonitorEvent }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-zinc-800/50 last:border-0">
      {/* 도구 타입 컬러 점 */}
      <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${toolColor(event.tool)}`} />
      {/* 도구명 */}
      <span className={`font-mono text-xs w-16 shrink-0 ${toolTextColor(event.tool)}`}>
        {event.tool}
      </span>
      {/* 요약 */}
      <span className="font-mono text-xs text-zinc-400 truncate flex-1">
        {event.summary || '—'}
      </span>
      {/* 프로젝트명 */}
      <span className="font-mono text-[10px] text-zinc-600 shrink-0 max-w-[120px] truncate" title={event.project}>
        {event.project}
      </span>
    </div>
  )
}

export default function Monitor() {
  const { t } = useLang()
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['monitor-events'],
    queryFn: () => api.monitor.recentEvents(50),
    refetchInterval: 10_000,
    staleTime: 5_000,
  })

  const { data: sessionData } = useQuery({
    queryKey: ['monitor-session'],
    queryFn: () => api.monitor.session(),
    refetchInterval: 10_000,
    staleTime: 5_000,
  })

  const events = eventsData?.events ?? []
  const activeSessions = sessionData?.active_sessions ?? []

  // 이벤트가 갱신될 때마다 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length])

  return (
    <div>
      <PageHeader title={t('monitor.title')} subtitle={t('monitor.subtitle')}>
        <InfoTooltip
          title={CATEGORY_INFO.monitor.title}
          description={CATEGORY_INFO.monitor.description}
          detail={CATEGORY_INFO.monitor.detail}
        />
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
          <span className="font-mono text-[10px] text-zinc-500">10s interval</span>
        </div>
      </PageHeader>

      {/* 세션 요약 */}
      <div className="mb-4 flex items-center gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 flex items-center gap-2">
          <Activity size={13} strokeWidth={1.5} className="text-zinc-500" />
          <span className="font-mono text-xs text-zinc-400">
            Active sessions: <span className="text-zinc-200">{activeSessions.length}</span>
          </span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2">
          <span className="font-mono text-xs text-zinc-400">
            Events: <span className="text-zinc-200">{events.length}</span>
          </span>
        </div>
      </div>

      {/* 이벤트 타임라인 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-md">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-900/80">
          <span className="font-mono text-[10px] text-zinc-600 w-2 shrink-0" />
          <span className="font-mono text-[10px] text-zinc-600 uppercase w-16 shrink-0">Tool</span>
          <span className="font-mono text-[10px] text-zinc-600 uppercase flex-1">Summary</span>
          <span className="font-mono text-[10px] text-zinc-600 uppercase w-[120px]">Project</span>
        </div>

        {/* 이벤트 목록 (스크롤) */}
        <div ref={scrollRef} className="overflow-y-auto max-h-[540px] px-4">
          {eventsLoading ? (
            <div className="py-8 text-center font-mono text-xs text-zinc-600">Loading...</div>
          ) : events.length === 0 ? (
            <div className="py-8 text-center font-mono text-xs text-zinc-600">
              {t('monitor.noEvents')}
            </div>
          ) : (
            events.map((event, idx) => (
              <EventRow key={idx} event={event} />
            ))
          )}
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-3 flex flex-wrap gap-3">
        {Object.entries(TOOL_COLORS).map(([tool, color]) => (
          <div key={tool} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className="font-mono text-[10px] text-zinc-600">{tool}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
