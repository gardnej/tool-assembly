export function ToolLibraryInsertPreview() {
  return (
    <svg
      viewBox="0 0 200 160"
      className="h-full w-full"
      aria-label="Tool insert preview"
    >
      <defs>
        <linearGradient id="tlbInsertGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f0c060" />
          <stop offset="100%" stopColor="#d4a030" />
        </linearGradient>
      </defs>
      <g
        style={{
          backgroundImage: `
            linear-gradient(rgb(140 190 230 / 0.22) 1px, transparent 1px),
            linear-gradient(90deg, rgb(140 190 230 / 0.22) 1px, transparent 1px)
          `,
        }}
      >
        <line x1="100" y1="20" x2="100" y2="140" stroke="#1a1a1a" strokeWidth="1" />
        <text x="92" y="16" fill="#e85d5d" fontSize="8" fontWeight="600">
          +X
        </text>
        <line x1="30" y1="90" x2="170" y2="90" stroke="#1a1a1a" strokeWidth="1" />
        <text x="172" y="93" fill="#3a9ad9" fontSize="8" fontWeight="600">
          +Z
        </text>
        <circle cx="100" cy="90" r="2" fill="#1a1a1a" />
        <polygon
          points="88,55 112,55 118,125 82,125"
          fill="url(#tlbInsertGrad)"
          stroke="#8a7020"
          strokeWidth="1"
        />
        <rect x="78" y="118" width="44" height="18" rx="2" fill="#9aa5b5" stroke="#6a7585" />
      </g>
      <g transform="translate(158, 8)">
        <rect width="32" height="32" fill="#4a5363" stroke="#6a7585" strokeWidth="0.5" />
        <text x="16" y="20" fill="#d1d5db" fontSize="7" textAnchor="middle" fontWeight="600">
          FRONT
        </text>
      </g>
    </svg>
  );
}
