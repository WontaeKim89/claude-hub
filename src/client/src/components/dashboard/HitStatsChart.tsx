import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api-client'

type Tab = 'skills' | 'plugins' | 'agents'

interface HitItem {
  name: string
  hit_count: number
  last_used: number
}

// 히트 수가 낮은 항목 기준 (전체 최대값의 10% 미만)
const LOW_USAGE_THRESHOLD = 0.1

function HitBar({ name, hitCount, maxCount }: { name: string; hitCount: number; maxCount: number }) {
  const pct = maxCount > 0 ? (hitCount / maxCount) * 100 : 0
  const isLowUsage = maxCount > 0 && hitCount / maxCount < LOW_USAGE_THRESHOLD

  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* 이름 열 — 고정 너비, 우측 정렬, 말줄임 */}
      <span
        className="font-mono text-xs text-zinc-400 shrink-0 truncate text-right"
        style={{ width: 140 }}
        title={name}
      >
        {name}
      </span>

      {/* 바 영역 */}
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isLowUsage
              ? 'bg-amber-500/60'
              : 'bg-gradient-to-r from-emerald-600/80 to-emerald-400/80'
          }`}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>

      {/* 히트 수 숫자 */}
      <div className="flex items-center gap-1 shrink-0 w-14 justify-end">
        {isLowUsage && (
          <AlertTriangle size={10} strokeWidth={1.5} className="text-amber-500 shrink-0" />
        )}
        <span className={`font-mono text-xs ${isLowUsage ? 'text-amber-400' : 'text-emerald-400'}`}>
          {hitCount}
        </span>
      </div>
    </div>
  )
}

export function HitStatsChart() {
  const [activeTab, setActiveTab] = useState<Tab>('skills')

  const { data: skillsData } = useQuery({
    queryKey: ['stats', 'topSkills', 15],
    queryFn: () => api.stats.topSkills(15),
    enabled: activeTab === 'skills',
  })

  const { data: pluginsData } = useQuery({
    queryKey: ['stats', 'topPlugins', 10],
    queryFn: () => api.stats.topPlugins(10),
    enabled: activeTab === 'plugins',
  })

  const syncMutation = useMutation({
    mutationFn: () => api.stats.sync(),
  })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'skills', label: 'Skills' },
    { key: 'plugins', label: 'Plugins' },
    { key: 'agents', label: 'Agents' },
  ]

  const activeData: HitItem[] | undefined =
    activeTab === 'skills' ? skillsData :
    activeTab === 'plugins' ? pluginsData :
    undefined

  const maxCount = activeData && activeData.length > 0 ? activeData[0].hit_count : 0
  const isEmpty = activeTab === 'agents' || !activeData || activeData.length === 0

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
      {/* 헤더: 탭 + 기간 표시 */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4">
        <div className="flex items-center gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`font-mono text-xs px-3 py-3 border-b-2 transition-colors duration-150 ${
                activeTab === tab.key
                  ? 'border-emerald-500 text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="font-mono text-[10px] text-zinc-600">최근 30일 기준</span>
      </div>

      {/* 바 차트 본문 */}
      <div className="px-4 py-3">
        {isEmpty ? (
          <div className="flex items-center justify-between py-2">
            <p className="text-xs text-zinc-600">
              {activeTab === 'agents'
                ? '준비 중입니다'
                : '사용 데이터 없음. Sync를 실행하여 과거 이력을 불러오세요'}
            </p>
            {activeTab !== 'agents' && (
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 border border-zinc-800 hover:border-zinc-600 px-2 py-1 rounded transition-colors disabled:opacity-50"
              >
                <RefreshCw size={11} strokeWidth={1.5} className={syncMutation.isPending ? 'animate-spin' : ''} />
                Sync 실행
              </button>
            )}
          </div>
        ) : (
          activeData!.map((item) => (
            <HitBar
              key={item.name}
              name={item.name}
              hitCount={item.hit_count}
              maxCount={maxCount}
            />
          ))
        )}
      </div>
    </div>
  )
}
