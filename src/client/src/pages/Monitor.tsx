import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Radio,
  Trash2,
  Circle,
  Terminal,
  User,
  Bot,
  FileText,
  Pencil,
  Search,
  Folder,
  Wrench,
  ChevronDown,
  ChevronRight,
  Pause,
  Play,
  Bell,
  BellOff,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { useMonitorStream, type MonitorEvent, type ToolCall } from '../hooks/useMonitorStream'
import { useLang } from '../hooks/useLang'

const TOOL_ICONS: Record<string, React.ElementType> = {
  Read: FileText,
  Write: FileText,
  Edit: Pencil,
  Bash: Terminal,
  Grep: Search,
  Glob: Folder,
  Skill: Wrench,
  Agent: Bot,
}

const TOOL_COLORS: Record<string, string> = {
  Read: 'text-violet-400',
  Write: 'text-red-400',
  Edit: 'text-red-400',
  Bash: 'text-fuchsia-400',
  Grep: 'text-fuchsia-400',
  Glob: 'text-violet-400',
  Skill: 'text-purple-400',
  Agent: 'text-amber-400',
}

function ToolBadge({ tool }: { tool: ToolCall }) {
  const Icon = TOOL_ICONS[tool.name] || Wrench
  const color = TOOL_COLORS[tool.name] || 'text-zinc-400'
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-300">
      <Icon size={11} strokeWidth={1.5} />
      <span className={color}>{tool.name}</span>
      {tool.summary && (
        <span className="text-zinc-500 max-w-[200px] truncate">{tool.summary}</span>
      )}
    </span>
  )
}

function TimeStamp({ ts }: { ts: number }) {
  const d = new Date(ts)
  return (
    <span className="font-mono text-[10px] text-zinc-600 shrink-0 w-[52px]">
      {d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}

function EventRow({ event }: { event: MonitorEvent }) {
  const [expanded, setExpanded] = useState(false)

  if (event.type === 'session_active') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs border-l-2 border-emerald-500/50 bg-emerald-500/5">
        <TimeStamp ts={event.timestamp!} />
        <Circle size={8} className="text-emerald-400 fill-emerald-400" />
        <span className="text-emerald-400">Session started</span>
        <span className="text-zinc-500 font-mono truncate">{event.project_path || event.project}</span>
      </div>
    )
  }

  if (event.type === 'notification') {
    const isPermission = event.reason === 'needs_input'
    return (
      <div className={`flex items-center gap-2 px-3 py-2 text-xs border-l-2 ${
        isPermission ? 'border-amber-500 bg-amber-500/5' : 'border-sky-500 bg-sky-500/5'
      }`}>
        <TimeStamp ts={event.timestamp!} />
        {isPermission ? (
          <AlertTriangle size={12} className="text-amber-400 shrink-0" />
        ) : (
          <CheckCircle2 size={12} className="text-sky-400 shrink-0" />
        )}
        <span className={isPermission ? 'text-amber-400 font-medium' : 'text-sky-400 font-medium'}>
          {event.title}
        </span>
        <span className="text-zinc-500 truncate">{event.body}</span>
      </div>
    )
  }

  if (event.type === 'session_ended') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs border-l-2 border-zinc-700 bg-zinc-800/30">
        <TimeStamp ts={event.timestamp!} />
        <Circle size={8} className="text-zinc-600" />
        <span className="text-zinc-500">Session ended</span>
        <span className="text-zinc-600 font-mono truncate">{event.project_path || event.project}</span>
      </div>
    )
  }

  const isUser = event.role === 'user'
  const hasTools = event.tools && event.tools.length > 0
  const hasText = event.text_preview && event.text_preview.trim().length > 0
  const isExpandable = hasText && (event.text_preview!.length > 80 || event.text_preview!.includes('\n'))

  return (
    <div className={`px-3 py-1.5 text-xs border-l-2 ${isUser ? 'border-blue-500/30' : 'border-fuchsia-500/30'} hover:bg-zinc-800/30 transition-colors`}>
      <div className="flex items-start gap-2">
        <TimeStamp ts={event.timestamp!} />
        {isUser ? (
          <User size={12} className="text-blue-400 shrink-0 mt-0.5" />
        ) : (
          <Bot size={12} className="text-fuchsia-400 shrink-0 mt-0.5" />
        )}

        <div className="flex-1 min-w-0">
          {hasTools && (
            <div className="flex flex-wrap gap-1 mb-0.5">
              {event.tools!.map((tool, i) => (
                <ToolBadge key={i} tool={tool} />
              ))}
            </div>
          )}

          {hasText && (
            <div className="flex items-start gap-1">
              {isExpandable && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-zinc-600 hover:text-zinc-400 shrink-0 mt-0.5"
                >
                  {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </button>
              )}
              <p className={`text-zinc-400 ${expanded ? 'whitespace-pre-wrap' : 'truncate'}`}>
                {expanded ? event.text_preview : event.text_preview!.split('\n')[0].slice(0, 120)}
              </p>
            </div>
          )}

          {!hasTools && !hasText && (
            <span className="text-zinc-600 italic">(empty)</span>
          )}
        </div>

        {event.model && (
          <span className="font-mono text-[9px] text-zinc-700 shrink-0">
            {event.model.split('/').pop()?.replace('claude-', '')}
          </span>
        )}
      </div>
    </div>
  )
}

interface ActiveSession {
  session_id: string
  project: string
  project_path: string
  modified: number
  size: number
}

export default function Monitor() {
  const { t } = useLang()
  const { events, connected, clear, notificationsEnabled, toggleNotifications } = useMonitorStream()
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const wasAtBottomRef = useRef(true)

  const { data: activeSessions = [] } = useQuery<ActiveSession[]>({
    queryKey: ['monitor-active'],
    queryFn: () => fetch('/api/monitor/active').then(r => r.json()),
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (paused) return
    const el = feedRef.current
    if (el && wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [events, paused])

  const handleScroll = () => {
    const el = feedRef.current
    if (el) {
      wasAtBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 40
    }
  }

  const filteredEvents = events.filter(e => {
    // user 메시지와 notification은 피드에서 제외
    if (e.type === 'message' && e.role === 'user') return false
    if (e.type === 'notification') return false
    // 프로젝트 필터
    if (filter && e.project !== filter && e.session_id !== filter) return false
    return true
  })

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Radio size={18} className={connected ? 'text-emerald-400' : 'text-zinc-600'} />
            Live Monitor
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {connected ? (
              <span className="text-emerald-400">{t('monitor.connected')}</span>
            ) : (
              <span className="text-amber-400">{t('monitor.reconnecting')}</span>
            )}
            {' '}&middot; {activeSessions.length} {t('monitor.activeSessions')}
            {' '}&middot; {events.length} {t('monitor.events')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleNotifications}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors ${
              notificationsEnabled
                ? 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20'
                : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
            }`}
            title={notificationsEnabled ? t('monitor.notifyOn') : t('monitor.notifyOff')}
          >
            {notificationsEnabled ? <Bell size={12} /> : <BellOff size={12} />}
            {notificationsEnabled ? t('monitor.notifyOn') : t('monitor.notifyOff')}
          </button>
          <button
            onClick={() => setPaused(!paused)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors ${
              paused
                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused ? t('monitor.resume') : t('monitor.pause')}
          </button>
          <button
            onClick={clear}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
          >
            <Trash2 size={12} />
            {t('monitor.clear')}
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
        <ul className="space-y-1 text-[11px] leading-relaxed text-zinc-400">
          <li className="flex items-start gap-1.5">
            <span className="text-zinc-600 mt-px shrink-0">&bull;</span>
            {t('monitor.desc.1')}
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-zinc-600 mt-px shrink-0">&bull;</span>
            {t('monitor.desc.2')}
          </li>
        </ul>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left: Active sessions */}
        <div className="w-56 shrink-0 bg-zinc-900 rounded-lg border border-zinc-800 flex flex-col">
          <div className="px-3 py-2 border-b border-zinc-800">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">{t('monitor.activeSessions.title')}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeSessions.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <Circle size={20} className="text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-600">{t('monitor.activeSessions.empty')}</p>
                <p className="text-[10px] text-zinc-700 mt-1">{t('monitor.activeSessions.emptyDesc')}</p>
              </div>
            ) : (
              <div className="py-1">
                <button
                  onClick={() => setFilter(null)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    filter === null
                      ? 'text-fuchsia-400 bg-fuchsia-400/5'
                      : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  All Sessions
                </button>
                {activeSessions.map(session => {
                  const projectName = session.project_path.split('/').pop() || session.project
                  const ago = Math.round((Date.now() / 1000 - session.modified))
                  const agoText = ago < 60 ? `${ago}s ago` : `${Math.round(ago / 60)}m ago`

                  return (
                    <button
                      key={session.session_id}
                      onClick={() => setFilter(session.project === filter ? null : session.project)}
                      className={`w-full text-left px-3 py-2 transition-colors ${
                        filter === session.project
                          ? 'text-fuchsia-400 bg-fuchsia-400/5'
                          : 'text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Circle size={6} className="text-emerald-400 fill-emerald-400 shrink-0" />
                        <span className="text-xs truncate">{projectName}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 ml-[14px]">
                        <span className="font-mono text-[10px] text-zinc-600">{session.session_id.slice(0, 8)}...</span>
                        <span className="text-[10px] text-zinc-700">{agoText}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Event feed */}
        <div className="flex-1 bg-zinc-900 rounded-lg border border-zinc-800 flex flex-col min-w-0">
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
              {t('monitor.eventFeed')}
              {filter && (
                <span className="ml-2 text-fuchsia-400 normal-case tracking-normal">
                  filtered: {filter.split('-').pop()}
                </span>
              )}
            </p>
            {paused && (
              <span className="text-[10px] text-amber-400 font-mono">PAUSED</span>
            )}
          </div>
          <div
            ref={feedRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto"
          >
            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Radio size={28} className="text-zinc-800 mb-3" />
                <p className="text-sm text-zinc-600">Waiting for events...</p>
                <p className="text-xs text-zinc-700 mt-1">
                  Start a Claude Code session to see real-time activity here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {filteredEvents.map((event, i) => (
                  <EventRow key={i} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tool legend */}
      <div className="mt-3 flex flex-wrap gap-3">
        {Object.entries(TOOL_COLORS).map(([tool, color]) => {
          const Icon = TOOL_ICONS[tool] || Wrench
          return (
            <div key={tool} className="flex items-center gap-1.5">
              <Icon size={10} className={color} />
              <span className="font-mono text-[10px] text-zinc-600">{tool}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
