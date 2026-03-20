export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-zinc-800/60 rounded ${className}`}
    >
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="border border-zinc-800 rounded-md overflow-hidden">
      <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5 flex gap-4">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-zinc-800/40">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className={`h-4 ${j === 0 ? 'flex-[2]' : 'flex-1'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
