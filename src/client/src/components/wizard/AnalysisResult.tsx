import { useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { MonacoWrapper } from '../editors/MonacoWrapper'
import { useLang } from '../../hooks/useLang'
import type { WizardResult } from '../../lib/types'

interface Props {
  result: WizardResult
  onApply: (data: { project_path: string; claude_md?: string; hooks?: Array<Record<string, unknown>> }) => void
  isApplying: boolean
}

export function AnalysisResult({ result, onApply, isApplying }: Props) {
  const { t } = useLang()
  const [claudeMdEnabled, setClaudeMdEnabled] = useState(true)
  const [claudeMdContent, setClaudeMdContent] = useState(result.claude_md)
  const [selectedHooks, setSelectedHooks] = useState<Set<number>>(
    new Set(result.hooks.map((_, i) => i))
  )
  const [showClaudeMd, setShowClaudeMd] = useState(true)

  const toggleHook = (idx: number) => {
    setSelectedHooks((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }

  const handleApply = () => {
    const payload: { project_path: string; claude_md?: string; hooks?: Array<Record<string, unknown>> } = {
      project_path: result.project_path,
    }
    if (claudeMdEnabled) {
      payload.claude_md = claudeMdContent
    }
    if (selectedHooks.size > 0) {
      payload.hooks = result.hooks
        .filter((_, i) => selectedHooks.has(i))
        .map((h) => ({ event: h.event, command: h.command, reason: h.reason }))
    }
    onApply(payload)
  }

  return (
    <div className="space-y-5">
      {/* 감지된 기술 스택 */}
      {result.tech_stack.length > 0 && (
        <div>
          <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-2">
            {t('wizard.techStack')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.tech_stack.map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 text-xs font-mono bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 rounded"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CLAUDE.md 섹션 */}
      <div className="border border-zinc-800 rounded-md overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/60 cursor-pointer"
          onClick={() => setShowClaudeMd((v) => !v)}
        >
          <div className="flex items-center gap-2.5">
            <button
              onClick={(e) => { e.stopPropagation(); setClaudeMdEnabled((v) => !v) }}
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                claudeMdEnabled
                  ? 'bg-fuchsia-600 border-fuchsia-600'
                  : 'border-zinc-600 bg-transparent'
              }`}
            >
              {claudeMdEnabled && <Check size={10} strokeWidth={3} className="text-white" />}
            </button>
            <span className="font-mono text-xs text-zinc-200">CLAUDE.md</span>
          </div>
          {showClaudeMd ? (
            <ChevronUp size={14} className="text-zinc-600" />
          ) : (
            <ChevronDown size={14} className="text-zinc-600" />
          )}
        </div>
        {showClaudeMd && (
          <div className="border-t border-zinc-800">
            <MonacoWrapper value={claudeMdContent} onChange={setClaudeMdContent} height="280px" />
          </div>
        )}
      </div>

      {/* Hooks 섹션 */}
      {result.hooks.length > 0 && (
        <div>
          <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-2">Hooks</p>
          <div className="space-y-1.5">
            {result.hooks.map((hook, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 px-3 py-2.5 border border-zinc-800 rounded-md"
              >
                <button
                  onClick={() => toggleHook(idx)}
                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    selectedHooks.has(idx)
                      ? 'bg-fuchsia-600 border-fuchsia-600'
                      : 'border-zinc-600 bg-transparent'
                  }`}
                >
                  {selectedHooks.has(idx) && <Check size={10} strokeWidth={3} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                      {hook.event}
                    </span>
                    <code className="text-xs font-mono text-zinc-300 truncate">{hook.command}</code>
                  </div>
                  {hook.reason && (
                    <p className="text-xs text-zinc-600 mt-1">{hook.reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MCP 제안 (정보 표시용, 체크박스 없음) */}
      {result.mcp_suggestions.length > 0 && (
        <div>
          <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-2">MCP Suggestions</p>
          <div className="space-y-1.5">
            {result.mcp_suggestions.map((mcp, idx) => (
              <div key={idx} className="px-3 py-2.5 border border-zinc-800 rounded-md">
                <span className="text-xs font-mono text-zinc-300">{mcp.name}</span>
                {mcp.reason && (
                  <p className="text-xs text-zinc-600 mt-0.5">{mcp.reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 적용 버튼 */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleApply}
          disabled={isApplying || (!claudeMdEnabled && selectedHooks.size === 0)}
          className="px-4 py-2 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors disabled:opacity-50"
        >
          {isApplying ? '적용 중...' : t('wizard.apply')}
        </button>
      </div>
    </div>
  )
}
