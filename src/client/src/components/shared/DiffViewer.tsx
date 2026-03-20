/**
 * unified diff 텍스트를 줄 단위로 색상 구분해서 렌더링하는 컴포넌트.
 * + 줄: 초록, - 줄: 빨강, @@ 헤더: 파랑
 */
interface DiffViewerProps {
  diff: string
}

export function DiffViewer({ diff }: DiffViewerProps) {
  if (!diff) {
    return (
      <div className="px-4 py-8 text-center text-sm text-zinc-500">
        변경 사항 없음
      </div>
    )
  }

  const lines = diff.split('\n')

  return (
    <div className="overflow-auto max-h-[60vh] font-mono text-xs">
      {lines.map((line, i) => {
        let className = 'px-4 py-0.5 whitespace-pre text-zinc-300'

        if (line.startsWith('+++') || line.startsWith('---')) {
          className = 'px-4 py-0.5 whitespace-pre text-zinc-400'
        } else if (line.startsWith('+')) {
          className = 'px-4 py-0.5 whitespace-pre bg-green-900/30 text-green-300'
        } else if (line.startsWith('-')) {
          className = 'px-4 py-0.5 whitespace-pre bg-red-900/30 text-red-300'
        } else if (line.startsWith('@@')) {
          className = 'px-4 py-0.5 whitespace-pre text-blue-400'
        }

        return (
          <div key={i} className={className}>
            {line || ' '}
          </div>
        )
      })}
    </div>
  )
}
