/**
 * claude-hub 로고 — R8 Triple Dot (Rose → Violet)
 */
export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#09090b" stroke="#27272a" strokeWidth="1" />
        <circle cx="10" cy="16" r="3" fill="#fb7185" fillOpacity="0.85" />
        <circle cx="16" cy="16" r="3" fill="#e879f9" fillOpacity="0.5" />
        <circle cx="22" cy="16" r="3" fill="#a78bfa" fillOpacity="0.3" />
      </svg>

      <div className="flex flex-col leading-none">
        <div className="flex items-baseline gap-0">
          <span
            className="font-mono text-[13px] font-bold tracking-tight text-zinc-300"
            style={{ letterSpacing: '-0.02em' }}
          >
            Claude
          </span>
          <span className="font-mono text-[13px] font-bold text-fuchsia-400">Hub</span>
        </div>
        <span className="font-mono text-[8px] text-zinc-600 tracking-[0.2em] uppercase mt-0.5">
          config dashboard
        </span>
      </div>
    </div>
  )
}
