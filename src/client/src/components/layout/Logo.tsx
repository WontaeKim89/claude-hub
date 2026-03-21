/**
 * claude-hub 로고 컴포넌트
 * 헥사곤 아이콘 + 스타일리시한 타이포그래피 조합
 */
export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      {/* 헥사곤 아이콘 — emerald 글로우 */}
      <div className="relative">
        <svg
          width="28"
          height="28"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]"
        >
          {/* 헥사곤 외곽 */}
          <path
            d="M16 2L28.124 9V23L16 30L3.876 23V9L16 2Z"
            fill="#09090b"
            stroke="#34d399"
            strokeWidth="1.5"
          />
          {/* 내부 작은 헥사곤 */}
          <path
            d="M16 8L23.062 12V20L16 24L8.938 20V12L16 8Z"
            fill="#34d399"
            fillOpacity="0.12"
            stroke="#34d399"
            strokeWidth="0.75"
            strokeOpacity="0.5"
          />
          {/* 중앙 점 */}
          <circle cx="16" cy="16" r="2" fill="#34d399" />
        </svg>
      </div>

      {/* 타이포그래피 */}
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline gap-0">
          <span
            className="font-mono text-[13px] font-bold tracking-tight text-zinc-300"
            style={{ letterSpacing: '-0.02em' }}
          >
            claude
          </span>
          <span className="font-mono text-[13px] font-bold text-emerald-400">-hub</span>
        </div>
        <span className="font-mono text-[8px] text-zinc-600 tracking-[0.2em] uppercase mt-0.5">
          config dashboard
        </span>
      </div>
    </div>
  )
}
