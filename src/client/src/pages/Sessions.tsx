import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { InfoTooltip } from '../components/shared/InfoTooltip'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
import { CATEGORY_INFO } from '../lib/category-info'
import { useLang } from '../hooks/useLang'

// 상대 시간 표시 헬퍼
function relativeTime(timestamp: number): string {
  const diff = Date.now() / 1000 - timestamp
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`
  return new Date(timestamp * 1000).toLocaleDateString('ko-KR')
}

// 파일 크기 포맷
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1048576).toFixed(1)}MB`
}

type Session = {
  id: string
  project: string
  file: string
  size: number
  modified: number
  message_count: number
  title: string
}

type ContentBlock = {
  type: string
  text?: string
  name?: string
  input_preview?: string
  content_preview?: string
}

type Message = {
  role: string
  content: ContentBlock[]
  model: string
}

// 도구 호출 뱃지 — 인라인으로 표시
function ToolBadge({ block }: { block: ContentBlock }) {
  const [expanded, setExpanded] = useState(false)

  if (block.type === 'tool_use') {
    return (
      <div className="my-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 px-2 py-1 bg-zinc-700 border border-zinc-600 rounded text-[10px] font-mono text-zinc-200 hover:text-zinc-100 hover:border-zinc-500 transition-colors"
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <span className="text-teal-300">[{block.name}]</span>
          <span className="truncate max-w-[300px] text-zinc-400">{block.input_preview}</span>
        </button>
        {expanded && block.input_preview && (
          <pre className="mt-1 ml-4 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-zinc-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
            {block.input_preview}
          </pre>
        )}
      </div>
    )
  }

  if (block.type === 'tool_result') {
    return (
      <div className="my-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <span className="text-zinc-400">[result]</span>
          <span className="truncate max-w-[300px] text-zinc-300">{block.content_preview}</span>
        </button>
        {expanded && block.content_preview && (
          <pre className="mt-1 ml-4 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-zinc-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
            {block.content_preview}
          </pre>
        )}
      </div>
    )
  }

  return null
}

// 개별 메시지 버블
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* 역할 레이블 */}
        <span className={`font-mono text-[11px] mb-1 ${isUser ? 'text-zinc-400 text-right' : 'text-zinc-400'}`}>
          {isUser ? 'User' : `Assistant${message.model ? ` · ${message.model.split('-').slice(0, 2).join('-')}` : ''}`}
        </span>

        {/* 메시지 내용 버블 */}
        <div className={`rounded-lg px-3 py-2 text-xs ${isUser ? 'bg-emerald-500/10 border border-emerald-500/20 text-zinc-100' : 'bg-zinc-800 border border-zinc-700 text-zinc-200'}`}>
          {message.content.map((block, idx) => {
            if (block.type === 'text') {
              return (
                <p key={idx} className="whitespace-pre-wrap leading-relaxed">
                  {block.text}
                </p>
              )
            }
            return <ToolBadge key={idx} block={block} />
          })}
        </div>
      </div>
    </div>
  )
}

// 세션 카드 (목록 패널)
function SessionCard({
  session,
  isActive,
  onClick,
  onDelete,
}: {
  session: Session
  isActive: boolean
  onClick: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`px-3 py-2.5 cursor-pointer border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors group ${
        isActive ? 'bg-zinc-800/60 border-l-2 border-l-emerald-500' : 'border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] text-zinc-300 truncate leading-snug" title={session.title}>
            {session.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[10px] text-zinc-600">{relativeTime(session.modified)}</span>
            <span className="font-mono text-[10px] text-zinc-700">·</span>
            <span className="font-mono text-[10px] text-zinc-600">{session.message_count} lines</span>
            <span className="font-mono text-[10px] text-zinc-700">·</span>
            <span className="font-mono text-[10px] text-zinc-600">{formatSize(session.size)}</span>
          </div>
        </div>
        {/* 삭제 버튼 — hover 시 표시 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400 transition-all shrink-0"
          title="세션 삭제"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

export default function Sessions() {
  const { t } = useLang()
  const queryClient = useQueryClient()

  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null)

  // 세션 목록 조회
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', selectedProject],
    queryFn: () => api.sessions.list(selectedProject),
    staleTime: 10_000,
  })

  // 선택된 세션의 메시지 조회
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['session-messages', selectedSession?.id, selectedSession?.project],
    queryFn: () => api.sessions.messages(selectedSession!.id, selectedSession!.project),
    enabled: !!selectedSession,
    staleTime: 30_000,
  })

  // 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: (session: Session) => api.sessions.delete(session.id),
    onSuccess: (_, deleted) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      if (selectedSession?.id === deleted.id) {
        setSelectedSession(null)
      }
      setDeleteTarget(null)
    },
  })

  // 프로젝트 목록 추출 (현재 전체 세션 기준)
  const { data: allSessions = [] } = useQuery({
    queryKey: ['sessions', undefined],
    queryFn: () => api.sessions.list(undefined),
    staleTime: 10_000,
  })

  const projects = Array.from(new Set(allSessions.map((s) => s.project))).sort()
  const messages = messagesData?.messages ?? []

  return (
    <div>
      <PageHeader title={t('sessions.title')} subtitle={t('sessions.subtitle')}>
        <InfoTooltip
          title={CATEGORY_INFO.sessions.title}
          description={CATEGORY_INFO.sessions.description}
          detail={CATEGORY_INFO.sessions.detail}
        />
      </PageHeader>

      {/* 프로젝트 필터 — combobox */}
      <div className="mb-4">
        <select
          value={selectedProject ?? 'all'}
          onChange={(e) => setSelectedProject(e.target.value === 'all' ? undefined : e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm font-mono text-zinc-100"
        >
          <option value="all">{t('sessions.allProjects')}</option>
          {projects.map((proj) => (
            <option key={proj} value={proj}>
              {proj.replace(/^-/, '').replace(/-/g, '/').split('/').pop() ?? proj}
            </option>
          ))}
        </select>
      </div>

      {/* 스플릿 패널 */}
      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* 왼쪽: 세션 목록 */}
        <div className="w-80 shrink-0 bg-zinc-900 border border-zinc-800 rounded-md flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
            <MessageSquare size={12} strokeWidth={1.5} className="text-zinc-600" />
            <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-wider">
              Sessions ({sessions.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sessionsLoading ? (
              <div className="py-8 text-center font-mono text-[11px] text-zinc-600">Loading...</div>
            ) : sessions.length === 0 ? (
              <div className="py-8 text-center font-mono text-[11px] text-zinc-600">
                {t('sessions.noSessions')}
              </div>
            ) : (
              sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isActive={selectedSession?.id === session.id}
                  onClick={() => setSelectedSession(session)}
                  onDelete={() => setDeleteTarget(session)}
                />
              ))
            )}
          </div>
        </div>

        {/* 오른쪽: 채팅 뷰어 */}
        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md flex flex-col overflow-hidden">
          {selectedSession ? (
            <>
              {/* 채팅 헤더 */}
              <div className="px-4 py-2.5 border-b border-zinc-800 shrink-0">
                <p className="font-mono text-[11px] text-zinc-300 truncate" title={selectedSession.title}>
                  {selectedSession.title}
                </p>
                <p className="font-mono text-[10px] text-zinc-600 mt-0.5 truncate" title={selectedSession.project}>
                  {selectedSession.project} · {relativeTime(selectedSession.modified)}
                </p>
              </div>

              {/* 메시지 목록 */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {messagesLoading ? (
                  <div className="py-8 text-center font-mono text-[11px] text-zinc-600">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="py-8 text-center font-mono text-[11px] text-zinc-600">메시지 없음</div>
                ) : (
                  messages.map((msg, idx) => (
                    <MessageBubble key={idx} message={msg} />
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare size={32} strokeWidth={1} className="text-zinc-700 mx-auto mb-3" />
                <p className="font-mono text-xs text-zinc-600">{t('sessions.selectSession')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {deleteTarget && (
        <DangerDeleteDialog
          title={t('sessions.deleteConfirm')}
          confirmText={deleteTarget.id.slice(0, 8)}
          description={deleteTarget.title}
          onConfirm={() => deleteMutation.mutate(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
