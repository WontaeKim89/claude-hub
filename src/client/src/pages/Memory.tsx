import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import { DangerDeleteDialog } from '../components/shared/DangerDeleteDialog'
import type { MemoryProject, MemoryFileSummary } from '../lib/types'

function NewFileModal({
  project,
  onClose,
}: {
  project: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [content, setContent] = useState('# ')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.memory.create(project, name.endsWith('.md') ? name : `${name}.md`, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memory-files', project] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[680px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-100">New Memory File</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">filename</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="notes.md"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">content</label>
            <MonacoWrapper value={content} onChange={setContent} height="280px" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim()}
            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Memory() {
  const qc = useQueryClient()
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: projects = [], isLoading: projectsLoading } = useQuery<MemoryProject[]>({
    queryKey: ['memory-projects'],
    queryFn: () => api.memory.projects(),
  })

  useEffect(() => {
    if (projects.length > 0 && selectedProject === null) {
      setSelectedProject(projects[0].encoded)
    }
  }, [projects, selectedProject])

  const { data: fileList, isLoading: filesLoading } = useQuery({
    queryKey: ['memory-files', selectedProject],
    queryFn: () => api.memory.list(selectedProject!),
    enabled: selectedProject !== null,
  })

  useEffect(() => {
    if (fileList && fileList.files.length > 0 && selectedFile === null) {
      setSelectedFile(fileList.files[0].name)
    }
  }, [fileList, selectedFile])

  const handleProjectChange = (encoded: string) => {
    setSelectedProject(encoded)
    setSelectedFile(null)
    setContent('')
    setError('')
  }

  const { data: fileData, isLoading: contentLoading } = useQuery({
    queryKey: ['memory-file', selectedProject, selectedFile],
    queryFn: () => api.memory.get(selectedProject!, selectedFile!),
    enabled: selectedProject !== null && selectedFile !== null,
  })

  useEffect(() => {
    if (fileData) {
      setContent(fileData.content)
    }
  }, [fileData])

  const handleFileChange = (name: string) => {
    setSelectedFile(name)
    setContent('')
    setError('')
  }

  const saveMutation = useMutation({
    mutationFn: () => api.memory.update(selectedProject!, selectedFile!, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memory-file', selectedProject, selectedFile] })
      setError('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (file: string) => api.memory.delete(selectedProject!, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memory-files', selectedProject] })
      setDeleteTarget(null)
      setSelectedFile(null)
      setContent('')
    },
    onError: (e: Error) => setError(e.message),
  })

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="font-mono text-zinc-600 text-xs">loading...</span>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Memory" subtitle="Project memory files managed by Claude">
        {selectedProject && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
          >
            <Plus size={13} strokeWidth={2} />
            New
          </button>
        )}
      </PageHeader>

      {projects.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-md p-8 text-center">
          <p className="text-xs text-zinc-600">No projects with memory files found.</p>
        </div>
      ) : (
        <>
          {/* Project selector */}
          <div className="mb-4">
            <label className="block font-mono text-xs text-zinc-500 mb-1.5">project</label>
            <select
              value={selectedProject ?? ''}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-emerald-500/50 w-full max-w-lg"
            >
              {projects.map((p) => (
                <option key={p.encoded} value={p.encoded}>
                  {p.decoded}
                </option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div className="flex gap-3 h-[540px]">
              {/* File list — compact left panel */}
              <div className="w-44 shrink-0 bg-zinc-900 border border-zinc-800 rounded-md overflow-y-auto">
                {filesLoading ? (
                  <div className="flex items-center justify-center h-16 text-zinc-600 text-xs font-mono">loading...</div>
                ) : (
                  <ul>
                    {(fileList?.files ?? []).map((f: MemoryFileSummary) => (
                      <li key={f.name}>
                        <button
                          onClick={() => handleFileChange(f.name)}
                          className={`w-full text-left px-3 py-2 text-xs font-mono border-b border-zinc-800 last:border-0 truncate transition-colors ${
                            selectedFile === f.name
                              ? 'text-emerald-400 bg-emerald-400/8'
                              : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                          }`}
                        >
                          {f.name}
                        </button>
                      </li>
                    ))}
                    {fileList?.files.length === 0 && (
                      <li className="px-3 py-3 text-xs text-zinc-700 font-mono">empty</li>
                    )}
                  </ul>
                )}
              </div>

              {/* Editor area */}
              <div className="flex-1 flex flex-col bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
                {selectedFile ? (
                  <>
                    <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0">
                      <span className="font-mono text-xs text-zinc-600">{selectedFile}</span>
                      <button
                        onClick={() => setDeleteTarget(selectedFile)}
                        className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                        title="Delete file"
                      >
                        <Trash2 size={13} strokeWidth={1.5} />
                      </button>
                    </div>

                    {error && <p className="text-xs text-red-400 bg-red-400/10 px-4 py-2">{error}</p>}
                    {success && <p className="text-xs text-emerald-400 bg-emerald-400/10 px-4 py-2">Saved.</p>}

                    <div className="flex-1 overflow-hidden">
                      {contentLoading ? (
                        <div className="flex items-center justify-center h-full text-zinc-600 text-xs font-mono">loading...</div>
                      ) : (
                        <MonacoWrapper value={content} onChange={setContent} height="100%" />
                      )}
                    </div>

                    <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800 shrink-0">
                      <button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending || contentLoading}
                        className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
                      >
                        {saveMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-xs font-mono">
                    select a file
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {showNew && selectedProject && (
        <NewFileModal project={selectedProject} onClose={() => setShowNew(false)} />
      )}

      {deleteTarget && (
        <DangerDeleteDialog
          title={`'${deleteTarget}' 파일을 삭제하시겠습니까?`}
          confirmText={deleteTarget}
          onConfirm={() => deleteMutation.mutate(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
