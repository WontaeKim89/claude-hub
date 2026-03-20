type DotVariant = 'emerald' | 'amber' | 'red' | 'zinc' | 'teal'

interface StatusDotProps {
  variant?: DotVariant
  className?: string
}

const variantClasses: Record<DotVariant, string> = {
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
  zinc: 'bg-zinc-500',
  teal: 'bg-teal-400',
}

export function StatusDot({ variant = 'zinc', className = '' }: StatusDotProps) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${variantClasses[variant]} ${className}`}
    />
  )
}
