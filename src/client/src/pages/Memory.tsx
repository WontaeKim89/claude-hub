import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { PageHeader } from '../components/layout/PageHeader'
import { MonacoWrapper } from '../components/editors/MonacoWrapper'
import type { MemoryProject, MemoryFileSummary } from '../lib/types'

// 새 파일 생성 패널
function NewFilePanel({
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
    mutationFn: () => api.memory.create(project, name.endsWith('.md') ? name : `${name}.md`, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memory-files', project] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[700px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-100">New Memory File</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-sm text-red-400 bg-red-400/10 rounded p-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">File name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              placeholder="notes.md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Content</label>
            <MonacoWrapper value={content} onChange={setContent} height="300px" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim()}
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md disabled:opacity-50"
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

  // 프로젝트 목록 로드 후 첫 번째 선택
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

  // 파일 목록 로드 후 첫 번째 파일 선택
  useEffect(() => {
    if (fileList && fileList.files.length > 0 && selectedFile === null) {
      setSelectedFile(fileList.files[0].name)
    }
  }, [fileList, selectedFile])

  // 프로젝트 전환 시 파일 선택 초기화
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

  // 파일 전환 시 콘텐츠 동기화
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
        <span className="text-zinc-500 text-sm">Loading...</span>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Memory" subtitle="Project memory files managed by Claude">
        {selectedProject && (
          <button
            onClick={() => setShowNew(true)}
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md"
          >
            + New
          </button>
        )}
      </PageHeader>

      {projects.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-sm text-zinc-500">No projects with memory files found.</p>
        </div>
      ) : (
        <>
          {/* 프로젝트 선택 드롭다운 */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-zinc-400 mb-1">Project</label>
            <select
              value={selectedProject ?? ''}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 w-full max-w-md"
            >
              {projects.map((p) => (
                <option key={p.encoded} value={p.encoded}>
                  {p.decoded}
                </option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div className="flex gap-4 h-[520px]">
              {/* 좌측 파일 목록 */}
              <div className="w-48 shrink-0 bg-zinc-900 border border-zinc-800 rounded-lg overflow-y-auto">
                {filesLoading ? (
                  <div className="flex items-center justify-center h-20 text-zinc-500 text-sm">Loading...</div>
                ) : (
                  <ul>
                    {(fileList?.files ?? []).map((f: MemoryFileSummary) => (
                      <li key={f.name}>
                        <button
                          onClick={() => handleFileChange(f.name)}
                          className={`w-full text-left px-3 py-2.5 text-sm border-b border-zinc-800 last:border-0 truncate ${
                            selectedFile === f.name
                              ? 'text-indigo-400 bg-indigo-500/10'
                              : 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800'
                          }`}
                        >
                          {f.name}
                        </button>
                      </li>
                    ))}
                    {fileList?.files.length === 0 && (
                      <li className="px-3 py-3 text-xs text-zinc-500">No files.</li>
                    )}
                  </ul>
                )}
              </div>

              {/* 우측 에디터 영역 */}
              <div className="flex-1 flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                {selectedFile ? (
                  <>
                    <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0">
                      <span className="text-xs text-zinc-500 font-mono">{selectedFile}</span>
                      <button
                        onClick={() => setDeleteTarget(selectedFile)}
                        className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md"
                      >
                        Delete
                      </button>
                    </div>

                    {error && <p className="text-sm text-red-400 bg-red-400/10 px-4 py-2">{error}</p>}
                    {success && <p className="text-sm text-emerald-400 bg-emerald-400/10 px-4 py-2">Saved.</p>}

                    <div className="flex-1 overflow-hidden">
                      {contentLoading ? (
                        <div className="flex items-center justify-center h-full text-zinc-500 text-sm">Loading...</div>
                      ) : (
                        <MonacoWrapper value={content} onChange={setContent} height="100%" />
                      )}
                    </div>

                    <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800 shrink-0">
                      <button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending || contentLoading}
                        className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md disabled:opacity-50"
                      >
                        {saveMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                    Select a file to edit.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {showNew && selectedProject && (
        <NewFilePanel
          project={selectedProject}
          onClose={() => setShowNew(false)}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-80">
            <h3 className="text-sm font-medium text-zinc-100 mb-2">Delete file</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Delete <span className="text-zinc-100">"{deleteTarget}"</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget)}
                disabled={deleteMutation.isPending}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-md disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
