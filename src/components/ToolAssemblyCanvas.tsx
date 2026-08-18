import type { AssemblyRow, ComponentRole } from "../types";

interface ToolAssemblyCanvasProps {
  rows: AssemblyRow[];
  selectedRole?: ComponentRole | null;
  /** Measured through the joint frames; null when the chain has a gap. */
  measuredStackUpMm: number | null;
}

/**
 * Schematic of the joint chain, machine side at the left.
 *
 * This is a diagram of the frames rather than a render of the solids: the point
 * is which components carry MCS and CSW frames and where they meet, since that
 * is what determines whether the assembly comes together at all.
 */
export function ToolAssemblyCanvas({
  rows,
  selectedRole,
  measuredStackUpMm,
}: ToolAssemblyCanvasProps) {
  const block = rows.find((row) => row.role === "block");
  const holder = rows.find((row) => row.role === "holder");

  const hasBlock = block?.toolId != null;
  const hasHolder = holder?.toolId != null;

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-weave-viewport">
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
          viewBox="0 0 520 420"
          className="absolute inset-0 m-auto h-[92%] w-[92%] max-w-none"
          aria-label="Tool assembly joint chain"
        >
          <defs>
            <linearGradient id="blockGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a8b4c4" />
              <stop offset="100%" stopColor="#8a96a8" />
            </linearGradient>
            <linearGradient id="holderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#9aa8ba" />
              <stop offset="100%" stopColor="#f0c060" />
            </linearGradient>
          </defs>

          {/* Turret face: the assembly datum the first MCS frame sits on */}
          <g>
            <line x1="70" y1="70" x2="70" y2="350" stroke="#1a1a1a" strokeWidth="2" />
            <path
              d="M52 70 L70 70 L70 350 L52 350"
              fill="rgb(120 130 145 / 0.35)"
              stroke="none"
            />
            <text x="76" y="86" fill="rgb(229 237 246 / 0.85)" fontSize="10" fontWeight="600">
              Turret face (datum)
            </text>
          </g>

          {/* Axis along which the chain runs */}
          <line
            x1="70"
            y1="230"
            x2="470"
            y2="230"
            stroke="#1a1a1a"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text x="474" y="234" fill="#3a9ad9" fontSize="11" fontWeight="600">
            +Z
          </text>

          {/* Tool block, machine side */}
          {hasBlock ? (
            <g opacity={selectedRole === "block" ? 1 : 0.92}>
              <rect
                x="70"
                y="165"
                width="180"
                height="130"
                rx="2"
                fill="url(#blockGrad)"
                stroke={selectedRole === "block" ? "#3a9ad9" : "#6d7a8c"}
                strokeWidth={selectedRole === "block" ? 2.5 : 1.5}
              />
              <FrameMarker x={70} y={230} label="MCS" present={block?.missingFrame === null} />
              <FrameMarker x={250} y={230} label="CSW" present={block?.missingFrame === null} />
              <text x="80" y="185" fill="#22303f" fontSize="10" fontWeight="600">
                {truncate(block?.name ?? "", 24)}
              </text>
            </g>
          ) : (
            <PlaceholderBody
              x={70}
              y={165}
              width={180}
              height={130}
              label="Select tool block"
            />
          )}

          {/* Cutting tool, cutting side */}
          {hasHolder ? (
            <g opacity={selectedRole === "holder" ? 1 : 0.92}>
              <path
                d="M250 190 L400 190 L430 230 L400 270 L250 270 Z"
                fill="url(#holderGrad)"
                stroke={selectedRole === "holder" ? "#3a9ad9" : "#6d7a8c"}
                strokeWidth={selectedRole === "holder" ? 2.5 : 1.5}
              />
              <FrameMarker x={250} y={230} label="MCS" present={holder?.missingFrame === null} />
              <FrameMarker x={430} y={230} label="CSW" present={holder?.missingFrame === null} />
              <text x="262" y="210" fill="#22303f" fontSize="10" fontWeight="600">
                {truncate(holder?.name ?? "", 22)}
              </text>
            </g>
          ) : (
            <PlaceholderBody
              x={250}
              y={190}
              width={180}
              height={80}
              label="Select cutting tool"
            />
          )}

          {/* Measured stack-up, datum to final cutting-side frame */}
          <g>
            <line x1="70" y1="368" x2={hasHolder ? 430 : 250} y2="368" stroke="#3a9ad9" strokeWidth="1" />
            <line x1="70" y1="360" x2="70" y2="376" stroke="#3a9ad9" strokeWidth="1" />
            <line
              x1={hasHolder ? 430 : 250}
              y1="360"
              x2={hasHolder ? 430 : 250}
              y2="376"
              stroke="#3a9ad9"
              strokeWidth="1"
            />
            <text
              x={(70 + (hasHolder ? 430 : 250)) / 2}
              y="388"
              fill="#3a9ad9"
              fontSize="11"
              fontWeight="600"
              textAnchor="middle"
            >
              {measuredStackUpMm !== null
                ? `${measuredStackUpMm.toFixed(2)} mm measured`
                : "not measurable"}
            </text>
          </g>
        </svg>

        <p className="absolute bottom-3 left-3 max-w-[60%] text-[10px] leading-relaxed text-weave-text-active/80">
          Schematic of the joint chain, not a render. Frames are imported from each
          STEP file.
        </p>
      </div>
    </section>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** A joint origin, hollow when the frame is missing from the STEP file. */
function FrameMarker({
  x,
  y,
  label,
  present,
}: {
  x: number;
  y: number;
  label: string;
  present: boolean;
}) {
  const colour = present ? "#3a9ad9" : "#d98a2b";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <line x1="0" y1="0" x2="0" y2="-16" stroke={colour} strokeWidth="1.4" />
      <line x1="0" y1="0" x2="16" y2="0" stroke="#e03030" strokeWidth="1.4" />
      <circle
        cx="0"
        cy="0"
        r="3.5"
        fill={present ? colour : "none"}
        stroke={colour}
        strokeWidth="1.4"
      />
      <text x="4" y="-20" fill={colour} fontSize="9" fontWeight="700">
        {present ? label : `${label}?`}
      </text>
    </g>
  );
}

function PlaceholderBody({
  x,
  y,
  width,
  height,
  label,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}) {
  return (
    <g opacity="0.4">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke="#808080"
        strokeWidth="1.5"
        strokeDasharray="6 4"
      />
      <text
        x={x + width / 2}
        y={y + height / 2 + 4}
        fill="rgb(200 210 220 / 0.7)"
        fontSize="11"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
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
