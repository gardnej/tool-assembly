interface HeaderProps {
  assemblyName?: string;
}

export function Header({
  assemblyName = "12 - EWS_222115_DIN4003 (Turning general)",
}: HeaderProps) {
  return (
    <header className="flex h-7 shrink-0 items-center border-b border-weave-divider bg-weave-header px-3">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-weave-text-placeholder">Untitled</span>
        <span className="text-weave-text-placeholder">/</span>
        <ToolAssemblyIcon />
        <span className="font-normal text-weave-text">{assemblyName}</span>
      </div>
    </header>
  );
}

function ToolAssemblyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="text-weave-text-placeholder">
      <rect x="1" y="4" width="10" height="4" rx="0.5" fill="currentColor" opacity="0.35" />
      <rect x="3" y="2" width="6" height="8" rx="0.5" fill="currentColor" />
    </svg>
  );
}
