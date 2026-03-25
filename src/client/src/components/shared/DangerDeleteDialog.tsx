import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useEscClose } from '../../hooks/useEscClose'

interface DangerDeleteDialogProps {
  title: string
  confirmText: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
}

export function DangerDeleteDialog({
  title,
  confirmText,
  description,
  onConfirm,
  onCancel,
}: DangerDeleteDialogProps) {
  useEscClose(onCancel)
  const [input, setInput] = useState('')
  const isMatch = input === confirmText

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-400" />
            <span className="text-sm font-medium text-zinc-100">{title}</span>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div className="text-xs text-zinc-400 space-y-2">
            <p>이 작업은 되돌릴 수 없습니다.</p>
            <p>삭제 전 자동 백업이 생성됩니다.</p>
            {description && <p className="text-amber-400/80">{description}</p>}
          </div>

          <div>
            <p className="text-xs text-zinc-400 mb-2">
              확인을 위해{' '}
              <span className="font-mono text-red-400 font-semibold">{confirmText}</span>
              을(를) 정확히 입력하세요:
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={confirmText}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20"
              autoFocus
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-zinc-800">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 rounded-md transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={!isMatch}
            className={`px-3 py-1.5 text-xs rounded-md transition-all ${
              isMatch
                ? 'bg-red-500 text-white hover:bg-red-600 cursor-pointer'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
