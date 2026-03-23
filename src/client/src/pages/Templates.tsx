import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileStack, Tag, Trash2, Download, Check, X } from 'lucide-react'
import { api } from '../lib/api-client'
import { useLang } from '../hooks/useLang'
import type { HarnessTemplate, MemoryProject } from '../lib/types'

type Tab = 'community' | 'my' | 'export'

function TemplateDetailModal({ template, onClose, onApply }: { template: HarnessTemplate; onClose: () => void; onApply: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[700px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div>
            <span className="text-sm font-medium text-zinc-100">{template.display_name || template.name}</span>
            {template.builtin && <span className="ml-2 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">built-in</span>}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-xs text-zinc-400">{template.description}</p>

          {/* CLAUDE.md 내용 */}
          <div>
            <h3 className="text-xs font-mono text-zinc-500 mb-2">CLAUDE.md</h3>
            <pre className="bg-zinc-950 border border-zinc-800 rounded p-3 text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">{template.claude_md || '(없음)'}</pre>
          </div>

          {/* Hooks */}
          {template.hooks?.length > 0 && (
            <div>
              <h3 className="text-xs font-mono text-zinc-500 mb-2">Hooks ({template.hooks.length})</h3>
              {template.hooks.map((h, i) => (
                <div key={i} className="text-xs font-mono text-zinc-400 bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 mb-1">
                  <span className="text-emerald-400">{h.event}</span> → <span className="text-zinc-300">{h.command}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tags */}
          {(template.tags ?? []).length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {(template.tags ?? []).map(tag => (
                <span key={tag} className="px-2 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-400 rounded">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-400 border border-zinc-700 rounded">닫기</button>
          <button onClick={onApply} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded">적용</button>
        </div>
      </div>
    </div>
  )
}

export default function Templates() {
  const { t } = useLang()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('community')
  const [detailTemplate, setDetailTemplate] = useState<HarnessTemplate | null>(null)
  const [applyTarget, setApplyTarget] = useState<string>('')
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null)
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null)
  const [exportProject, setExportProject] = useState('')
  const [exportPreview, setExportPreview] = useState<HarnessTemplate | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [savedMsg, setSavedMsg] = useState(false)

  const { data: templates = [], isLoading } = useQuery<HarnessTemplate[]>({
    queryKey: ['templates'],
    queryFn: () => api.templates.list(),
  })

  const { data: projects = [] } = useQuery<MemoryProject[]>({
    queryKey: ['memory-projects'],
    queryFn: () => api.memory.projects(),
  })

  const applyMutation = useMutation({
    mutationFn: ({ name, path }: { name: string; path: string }) =>
      api.templates.apply(name, path),
    onSuccess: (_, vars) => {
      setAppliedTemplate(vars.name)
      setApplyingTemplate(null)
      setTimeout(() => setAppliedTemplate(null), 3000)
    },
    onError: () => setApplyingTemplate(null),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.templates.delete(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  })

  const exportMutation = useMutation({
    mutationFn: (path: string) => api.templates.export(path),
    onSuccess: (data) => {
      setExportPreview(data)
      setTemplateName(data.display_name?.toLowerCase().replace(/\s+/g, '-') || '')
    },
  })

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.templates.save(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setExportPreview(null)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 3000)
    },
  })

  const communityTemplates = templates.filter((t) => t.builtin)
  const myTemplates = templates.filter((t) => !t.builtin)

  const handleApply = (tmpl: HarnessTemplate) => {
    if (!applyTarget) return
    setApplyingTemplate(tmpl.name)
    applyMutation.mutate({ name: tmpl.name, path: applyTarget })
  }

  const handleSaveExport = () => {
    if (!exportPreview || !templateName.trim()) return
    saveMutation.mutate({ ...exportPreview, name: templateName.trim() })
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'community', label: t('templates.community') },
    { key: 'my', label: t('templates.my') },
    { key: 'export', label: t('templates.export') },
  ]

  return (
    <div className="max-w-3xl">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FileStack size={16} className="text-emerald-400" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('templates.title')}</h2>
        </div>
        <p className="text-xs text-zinc-500">{t('templates.subtitle')}</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-5 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-emerald-400 border-b-2 border-emerald-400 -mb-px'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 적용 대상 프로젝트 선택 (커뮤니티/내 템플릿 탭) */}
      {(activeTab === 'community' || activeTab === 'my') && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-zinc-500 shrink-0">{t('templates.selectProject')}</span>
          <select
            value={applyTarget}
            onChange={(e) => setApplyTarget(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
          >
            <option value="">— 선택 —</option>
            {projects.map((p) => (
              <option key={p.encoded} value={p.decoded}>{p.decoded}</option>
            ))}
          </select>
        </div>
      )}

      {/* 커뮤니티 템플릿 탭 */}
      {activeTab === 'community' && (
        <div>
          {isLoading ? (
            <div className="text-xs text-zinc-500">로딩 중...</div>
          ) : (
            <div className="grid gap-3">
              {communityTemplates.map((tmpl) => (
                <TemplateCard
                  key={tmpl.name}
                  tmpl={tmpl}
                  applyTarget={applyTarget}
                  applying={applyingTemplate === tmpl.name}
                  applied={appliedTemplate === tmpl.name}
                  onApply={handleApply}
                  onDetail={setDetailTemplate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 내 템플릿 탭 */}
      {activeTab === 'my' && (
        <div>
          {myTemplates.length === 0 ? (
            <p className="text-xs text-zinc-500 py-8 text-center">{t('templates.noCustom')}</p>
          ) : (
            <div className="grid gap-3">
              {myTemplates.map((tmpl) => (
                <TemplateCard
                  key={tmpl.name}
                  tmpl={tmpl}
                  applyTarget={applyTarget}
                  applying={applyingTemplate === tmpl.name}
                  applied={appliedTemplate === tmpl.name}
                  onApply={handleApply}
                  onDelete={() => deleteMutation.mutate(tmpl.name)}
                  onDetail={setDetailTemplate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 템플릿 상세 모달 */}
      {detailTemplate && (
        <TemplateDetailModal
          template={detailTemplate}
          onClose={() => setDetailTemplate(null)}
          onApply={() => {
            handleApply(detailTemplate)
            setDetailTemplate(null)
          }}
        />
      )}

      {/* 내보내기 탭 */}
      {activeTab === 'export' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <select
              value={exportProject}
              onChange={(e) => setExportProject(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
            >
              <option value="">— 프로젝트 선택 —</option>
              {projects.map((p) => (
                <option key={p.encoded} value={p.decoded}>{p.decoded}</option>
              ))}
            </select>
            <button
              onClick={() => exportProject && exportMutation.mutate(exportProject)}
              disabled={!exportProject || exportMutation.isPending}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-xs text-zinc-200 rounded transition-colors"
            >
              {exportMutation.isPending ? '분석 중...' : '미리보기'}
            </button>
          </div>

          {exportPreview && (
            <div className="border border-zinc-800 rounded-lg p-4 space-y-3">
              <p className="text-xs font-medium text-zinc-300">{t('templates.exportPreview')}</p>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-500">템플릿 이름</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
                  placeholder="my-template"
                />
              </div>

              <div className="bg-zinc-950 rounded p-3 text-[11px] font-mono text-zinc-400 max-h-32 overflow-y-auto">
                <div>hooks: {exportPreview.hooks.length}개</div>
                <div>mcp_servers: {Object.keys(exportPreview.mcp_servers).length}개</div>
                <div>claude_md: {exportPreview.claude_md ? `${exportPreview.claude_md.split('\n').length}줄` : '없음'}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveExport}
                  disabled={!templateName.trim() || saveMutation.isPending}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs text-white rounded transition-colors flex items-center gap-1.5"
                >
                  <Download size={12} />
                  {t('templates.save')}
                </button>
                {savedMsg && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <Check size={12} /> 저장됨
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface TemplateCardProps {
  tmpl: HarnessTemplate
  applyTarget: string
  applying: boolean
  applied: boolean
  onApply: (tmpl: HarnessTemplate) => void
  onDelete?: () => void
  onDetail: (tmpl: HarnessTemplate) => void
}

function TemplateCard({ tmpl, applyTarget, applying, applied, onApply, onDelete, onDetail }: TemplateCardProps) {
  return (
    <div
      className="border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors cursor-pointer"
      onClick={() => onDetail(tmpl)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-zinc-200">{tmpl.display_name}</span>
            {tmpl.builtin && (
              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded font-mono">built-in</span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mb-2">{tmpl.description}</p>
          {tmpl.tags && tmpl.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tmpl.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                  <Tag size={9} />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
              title="삭제"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onApply(tmpl) }}
            disabled={!applyTarget || applying}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              applied
                ? 'bg-emerald-600/20 text-emerald-400'
                : 'bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-200'
            }`}
          >
            {applied ? <><Check size={12} className="inline mr-1" />완료</> : applying ? '적용 중...' : '적용'}
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-3 text-[11px] text-zinc-600 font-mono">
        <span>hooks: {tmpl.hooks.length}</span>
        <span>mcp: {Object.keys(tmpl.mcp_servers).length}</span>
        <span>claude_md: {tmpl.claude_md ? `${tmpl.claude_md.split('\n').length}줄` : '없음'}</span>
      </div>
    </div>
  )
}
