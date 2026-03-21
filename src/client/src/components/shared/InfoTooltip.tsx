import { useState } from 'react'
import { Info } from 'lucide-react'

interface InfoTooltipProps {
  title: string
  description: string
  detail?: string
}

export function InfoTooltip({ title, description, detail }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <Info size={14} strokeWidth={1.5} className="text-zinc-500 cursor-default" />

      {visible && (
        <div
          className="absolute left-5 top-0 z-50 w-[280px] bg-zinc-900 border border-emerald-500/30 rounded-md shadow-lg p-3"
          style={{ minWidth: 280 }}
        >
          <p className="text-emerald-400 text-[0.75rem] font-bold mb-1">{title}</p>
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
