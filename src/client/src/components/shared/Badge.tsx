import type { ReactNode } from 'react'

type BadgeVariant = 'emerald' | 'teal' | 'amber' | 'red' | 'zinc' | 'violet'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  emerald: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/20',
  teal: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  red: 'bg-red-500/15 text-red-400 border-red-500/20',
  zinc: 'bg-zinc-700/50 text-zinc-400 border-zinc-700',
  violet: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
}

export function Badge({ variant = 'zinc', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium font-mono border ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
