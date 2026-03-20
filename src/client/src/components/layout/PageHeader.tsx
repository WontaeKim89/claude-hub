import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  children?: ReactNode
}

export function PageHeader({ title, subtitle, children }: Props) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
