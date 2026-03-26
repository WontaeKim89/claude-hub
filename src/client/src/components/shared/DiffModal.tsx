/**
 * Preview Diff 결과를 모달로 표시하는 컴포넌트.
 * DiffViewer를 래핑해 파일 경로와 함께 보여준다.
 */
import { DiffViewer } from './DiffViewer'
import { useEscClose } from '../../hooks/useEscClose'

interface DiffModalProps {
  diff: string
  targetPath: string
  onClose: () => void
}

export function DiffModal({ diff, targetPath, onClose }: DiffModalProps) {
  useEscClose(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-full max-w-3xl mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-200">Preview Diff</h2>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate">{targetPath}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-lg leading-none ml-4"
          >
            ×
          </button>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-hidden bg-zinc-950">
          <DiffViewer diff={diff} />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
