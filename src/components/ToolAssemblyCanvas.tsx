import type { ToolComponent } from "../types";

interface ToolAssemblyCanvasProps {
  components: ToolComponent[];
  selectedComponentId?: string;
  highlightSlots?: boolean;
}

export function ToolAssemblyCanvas({
  components,
  selectedComponentId,
  highlightSlots = false,
}: ToolAssemblyCanvasProps) {
  const holder = components.find((c) => c.category === "tool-holder");
  const insert = components.find((c) => c.category === "insert");
  const clamp = components.find((c) => c.category === "clamp");
  const adapter = components.find((c) => c.category === "adapter");

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-weave-viewport">
      {/* Future: Fusion viewport / Neutron graphics integration */}
      <div
        className="relative min-h-0 flex-1"
        style={{
          backgroundImage: `
            linear-gradient(rgb(140 190 230 / 0.22) 1px, transparent 1px),
            linear-gradient(90deg, rgb(140 190 230 / 0.22) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      >
        <ViewCube />

        <svg
          viewBox="0 0 420 520"
          className="absolute inset-0 m-auto h-[88%] w-[88%] max-w-none"
          aria-label="Tool assembly preview"
        >
          <defs>
            <linearGradient id="holderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a8b4c4" />
              <stop offset="100%" stopColor="#8a96a8" />
            </linearGradient>
            <linearGradient id="insertGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f0c060" />
              <stop offset="100%" stopColor="#d4a030" />
            </linearGradient>
          </defs>

          {/* Axes — Fusion turning profile: +X vertical, +Z horizontal */}
          <g opacity="0.9">
            <line x1="200" y1="460" x2="200" y2="60" stroke="#1a1a1a" strokeWidth="1.5" />
            <text x="188" y="52" fill="#e85d5d" fontSize="11" fontWeight="600">
              +X
            </text>
            <line x1="60" y1="320" x2="360" y2="320" stroke="#1a1a1a" strokeWidth="1.5" />
            <text x="365" y="324" fill="#3a9ad9" fontSize="11" fontWeight="600">
              +Z
            </text>
            <circle cx="200" cy="320" r="3.5" fill="#1a1a1a" />
          </g>

          {/* Adapter */}
          {adapter !== undefined && (
            <g opacity={selectedComponentId === adapter.id ? 1 : 0.9}>
              <rect
                x="175"
                y="120"
                width="70"
                height="90"
                rx="3"
                fill="#c4b5fd"
                stroke={selectedComponentId === adapter.id ? "#3a9ad9" : "#8b7fd4"}
                strokeWidth={selectedComponentId === adapter.id ? 2 : 1}
              />
              <CoordinateTriad x={210} y={155} scale={0.7} />
            </g>
          )}

          {/* Tool holder body */}
          {holder !== undefined ? (
            <g opacity={selectedComponentId === holder.id ? 1 : 0.95}>
              <path
                d="M 140 210 L 280 210 L 300 250 L 300 420 L 120 420 L 120 250 Z"
                fill="url(#holderGrad)"
                stroke={selectedComponentId === holder.id ? "#3a9ad9" : "#6d7a8c"}
                strokeWidth={selectedComponentId === holder.id ? 2.5 : 1.5}
              />
              <rect x="155" y="230" width="110" height="24" rx="2" fill="#9ec5db" opacity="0.6" />
              <CoordinateTriad x={210} y={280} />
              {highlightSlots && (
                <>
                  <SlotMarker x={175} y={310} label="Slot 1" active={insert !== undefined} />
                  <SlotMarker x={175} y={350} label="Slot 2" active={clamp !== undefined} />
                  <SlotMarker x={175} y={390} label="Slot 3" active={false} />
                </>
              )}
            </g>
          ) : (
            <g opacity="0.35">
              <path
                d="M 140 210 L 280 210 L 300 250 L 300 420 L 120 420 L 120 250 Z"
                fill="none"
                stroke="#808080"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
              <text x="155" y="330" fill="rgb(200 210 220 / 0.62)" fontSize="12">
                Select a tool holder
              </text>
            </g>
          )}

          {/* Insert */}
          {insert !== undefined && (
            <g opacity={selectedComponentId === insert.id ? 1 : 0.92}>
              <polygon
                points="195,300 245,295 250,325 200,330"
                fill="url(#insertGrad)"
                stroke={selectedComponentId === insert.id ? "#3a9ad9" : "#b8860b"}
                strokeWidth={selectedComponentId === insert.id ? 2 : 1}
              />
              <CoordinateTriad x={222} y={312} scale={0.55} />
            </g>
          )}

          {/* Clamp */}
          {clamp !== undefined && (
            <g opacity={selectedComponentId === clamp.id ? 1 : 0.9}>
              <rect
                x="190"
                y="335"
                width="60"
                height="14"
                rx="1"
                fill="#94a3b8"
                stroke={selectedComponentId === clamp.id ? "#3a9ad9" : "#64748b"}
                strokeWidth={selectedComponentId === clamp.id ? 2 : 1}
              />
            </g>
          )}
        </svg>

        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-[10px] text-weave-text-active">
          <span className="inline-block h-px w-8 bg-weave-text-active" />
          5 mm
        </div>
      </div>
    </section>
  );
}

function ViewCube() {
  return (
    <div className="absolute right-4 top-4 select-none">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-sm border border-weave-divider bg-weave-dialog/70" />
        <span className="absolute left-1/2 top-1 -translate-x-1/2 text-[8px] font-bold text-weave-text-active">
          FRONT
        </span>
        <span className="absolute bottom-1 left-1 text-[7px] font-semibold text-[#e03030]">X</span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[7px] font-semibold text-[#30a030]">
          Y
        </span>
        <span className="absolute bottom-1 right-1 text-[7px] font-semibold text-[#3a9ad9]">Z</span>
      </div>
    </div>
  );
}

function CoordinateTriad({
  x,
  y,
  scale = 1,
}: {
  x: number;
  y: number;
  scale?: number;
}) {
  const s = 18 * scale;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <line x1="0" y1="0" x2="0" y2={-s} stroke="#3a9ad9" strokeWidth="1.2" />
      <line x1="0" y1="0" x2={s} y2="0" stroke="#e03030" strokeWidth="1.2" />
      <line x1="0" y1="0" x2={-s * 0.6} y2={s * 0.4} stroke="#30a030" strokeWidth="1.2" />
    </g>
  );
}

function SlotMarker({
  x,
  y,
  label,
  active,
}: {
  x: number;
  y: number;
  label: string;
  active: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="90"
        height="28"
        rx="2"
        fill={active ? "rgb(58 154 217 / 0.2)" : "none"}
        stroke={active ? "#3a9ad9" : "rgb(255 255 255 / 0.25)"}
        strokeWidth="1"
        strokeDasharray={active ? undefined : "4 3"}
      />
      <text x={x + 6} y={y + 17} fill="rgb(229 237 246 / 0.78)" fontSize="9">
        {label}
      </text>
    </g>
  );
}

