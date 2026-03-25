import { X } from 'lucide-react'
import { useEscClose } from '../../hooks/useEscClose'

interface SaveConfirmDialogProps {
  oldContent: string
  newContent: string
  fileName: string
  onConfirm: () => void
  onCancel: () => void
  saving?: boolean
}

type DiffLine = { type: 'add' | 'remove' | 'same'; text: string }

function buildDiffLines(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const diffLines: DiffLine[] = []

  let i = 0
  let j = 0
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      diffLines.push({ type: 'same', text: oldLines[i] })
      i++
      j++
    } else {
      // lookahead 10줄 내에서 다음 일치 줄 탐색
      let matchI = -1
      let matchJ = -1
      for (let k = i; k < Math.min(i + 10, oldLines.length); k++) {
        for (let l = j; l < Math.min(j + 10, newLines.length); l++) {
          if (oldLines[k] === newLines[l]) {
            matchI = k
            matchJ = l
            break
          }
        }
        if (matchI >= 0) break
      }

      if (matchI >= 0) {
        for (let k = i; k < matchI; k++) diffLines.push({ type: 'remove', text: oldLines[k] })
        for (let l = j; l < matchJ; l++) diffLines.push({ type: 'add', text: newLines[l] })
        i = matchI
        j = matchJ
      } else {
        while (i < oldLines.length) { diffLines.push({ type: 'remove', text: oldLines[i] }); i++ }
        while (j < newLines.length) { diffLines.push({ type: 'add', text: newLines[j] }); j++ }
      }
    }
  }

  return diffLines
}

export function SaveConfirmDialog({
  oldContent,
  newContent,
  fileName,
  onConfirm,
  onCancel,
  saving,
}: SaveConfirmDialogProps) {
  useEscClose(onCancel)
  const diffLines = buildDiffLines(oldContent, newContent)
  const hasChanges = diffLines.some((d) => d.type !== 'same')
  const addCount = diffLines.filter((d) => d.type === 'add').length
  const removeCount = diffLines.filter((d) => d.type === 'remove').length

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md w-[700px] max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-100">변경 내용 확인</span>
            <span className="font-mono text-[10px] text-zinc-500">{fileName}</span>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        {/* 변경 통계 */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800/50">
          {addCount > 0 && <span className="font-mono text-xs text-fuchsia-400">+{addCount} 추가</span>}
          {removeCount > 0 && <span className="font-mono text-xs text-red-400">-{removeCount} 삭제</span>}
          {!hasChanges && <span className="font-mono text-xs text-zinc-500">변경 사항 없음</span>}
        </div>

        {/* Diff 뷰 */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="bg-zinc-950 border border-zinc-800 rounded font-mono text-[11px] leading-5 overflow-x-auto">
            {diffLines.map((line, idx) => {
              if (line.type === 'same') {
                // 변경 줄 근처 3줄만 context로 표시, 전체가 짧으면 모두 표시
                const nearChange = diffLines
                  .slice(Math.max(0, idx - 3), Math.min(diffLines.length, idx + 4))
                  .some((d) => d.type !== 'same')
                if (!nearChange && diffLines.length > 30) return null
                return (
                  <div key={idx} className="px-3 py-0.5 text-zinc-500 border-l-2 border-transparent">
                    {line.text || '\u00A0'}
                  </div>
                )
              }
              return (
                <div
                  key={idx}
                  className={`px-3 py-0.5 border-l-2 ${
                    line.type === 'add'
                      ? 'bg-fuchsia-500/8 text-fuchsia-300 border-fuchsia-500'
                      : 'bg-red-500/8 text-red-300 border-red-500'
                  }`}
                >
                  <span className="select-none mr-2 text-zinc-600">{line.type === 'add' ? '+' : '-'}</span>
                  {line.text || '\u00A0'}
                </div>
              )
            })}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
          <span className="text-xs text-zinc-400">변경된 내용으로 저장하시겠습니까?</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 rounded transition-colors"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={saving || !hasChanges}
              className="px-3 py-1.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
