import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'

interface InfoTooltipProps {
  title: string
  description: string
  detail?: string
}

export function InfoTooltip({ title, description, detail }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<'right' | 'left'>('right')

  useEffect(() => {
    if (visible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      // 오른쪽 공간이 300px 미만이면 왼쪽으로 표시
      setPosition(window.innerWidth - rect.right < 300 ? 'left' : 'right')
    }
  }, [visible])

  return (
    <div
      ref={triggerRef}
      className="relative flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <Info size={14} strokeWidth={1.5} className="text-zinc-500 cursor-default" />

      {visible && (
        <div
          className={`absolute top-0 z-50 w-[280px] bg-zinc-900 border border-fuchsia-500/30 rounded-md shadow-lg p-3 ${
            position === 'left' ? 'right-6' : 'left-6'
          }`}
        >
          <p className="text-fuchsia-400 text-[0.75rem] font-bold mb-1">{title}</p>
          <p className="text-zinc-400 text-[0.7rem] leading-relaxed">{description}</p>
          {detail && (
            <>
              <div className="border-t border-zinc-800 mt-2 mb-2" />
              <p className="text-zinc-600 text-[0.65rem] font-mono leading-relaxed">{detail}</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
