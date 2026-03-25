import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Power, Activity, Check, AlertTriangle } from 'lucide-react'
import { api } from '../lib/api-client'

export default function HubSettings() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['hub-settings'],
    queryFn: () => api.hub.settings(),
  })

  const autostartMutation = useMutation({
    mutationFn: (enabled: boolean) => api.hub.setAutostart(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hub-settings'] }),
  })

  const trackerMutation = useMutation({
    mutationFn: () => api.hub.installTracker(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hub-settings'] }),
  })

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Settings size={16} className="text-fuchsia-400" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Hub 설정</h2>
        </div>
        <p className="text-xs text-zinc-500">ClaudeHub 앱 자체의 설정을 관리합니다.</p>
      </div>

      <div className="space-y-4">
        {/* 자동 실행 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-semibold text-zinc-200">시작 프로그램</span>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Power size={16} className="text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-200 font-medium">로그인 시 자동 실행</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    macOS 시작 시 ClaudeHub를 자동으로 실행합니다.
                  </p>
                </div>
              </div>

              {isLoading ? (
                <div className="w-10 h-5 bg-zinc-800 rounded-full animate-pulse" />
              ) : (
                <button
                  onClick={() => autostartMutation.mutate(!data?.autostart)}
                  disabled={autostartMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    data?.autostart ? 'bg-fuchsia-500' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      data?.autostart ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              )}
            </div>

            {data?.autostart && (
              <p className="mt-3 text-[10px] text-zinc-600 font-mono bg-zinc-800/50 rounded px-3 py-1.5">
                ~/Library/LaunchAgents/com.claude-hub.autostart.plist
              </p>
            )}
          </div>
        </div>

        {/* 사용량 추적 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-semibold text-zinc-200">사용량 추적</span>
          </div>
          <div className="px-4 py-4 space-y-3">
            {/* Hook 상태 표시 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity size={16} className="text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-200 font-medium">Tracker Hook</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    PostToolUse → claude-hub-tracker record
                  </p>
                </div>
              </div>

              {isLoading ? (
                <div className="w-16 h-5 bg-zinc-800 rounded animate-pulse" />
              ) : data?.tracker_installed ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-md">
                  <Check size={12} className="text-green-400" />
                  <span className="text-[10px] font-mono text-green-400">등록됨</span>
                </div>
              ) : (
                <button
                  onClick={() => trackerMutation.mutate()}
                  disabled={trackerMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  <AlertTriangle size={11} />
                  {trackerMutation.isPending ? '설치 중...' : 'Hook 등록'}
                </button>
              )}
            </div>

            {data?.tracker_installed && data.tracker_command && (
              <p className="text-[10px] text-zinc-600 font-mono bg-zinc-800/50 rounded px-3 py-1.5 truncate" title={data.tracker_command}>
                {data.tracker_command}
              </p>
            )}

            {!data?.tracker_installed && !isLoading && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-md px-3 py-2">
                <p className="text-[10px] text-amber-400">
                  Tracker Hook이 등록되지 않았습니다. 등록하면 Claude Code에서 스킬/플러그인 사용 시 자동으로 통계가 기록됩니다.
                </p>
              </div>
            )}

            <div className="bg-zinc-800/50 rounded-md px-3 py-2.5 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-fuchsia-400 text-xs mt-0.5">•</span>
                <p className="text-[11px] text-zinc-300">
                  <strong>ClaudeHub 서버가 꺼져 있어도</strong> Hook이 등록되어 있으면 자동 기록됩니다.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-fuchsia-400 text-xs mt-0.5">•</span>
                <p className="text-[11px] text-zinc-300">
                  서버는 <strong>대시보드에서 통계를 조회</strong>할 때만 필요합니다.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-fuchsia-400 text-xs mt-0.5">•</span>
                <p className="text-[11px] text-zinc-300">
                  과거 데이터는 대시보드의 <strong>"Sync 이력"</strong> 버튼으로 소급 적재합니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 앱 정보 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-semibold text-zinc-200">앱 정보</span>
          </div>
          <div className="px-4 py-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">버전</span>
              <span className="font-mono text-zinc-300">v0.1</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">데이터 경로</span>
              <span className="font-mono text-zinc-400 text-[10px]">~/.claude-hub/</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">설정 경로</span>
              <span className="font-mono text-zinc-400 text-[10px]">~/.claude/</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
