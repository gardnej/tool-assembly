import type { AssemblyConfig, AssemblyRow, ValidationStatus } from "../types";

interface ReviewPanelProps {
  rows: AssemblyRow[];
  config: AssemblyConfig;
  /** Measured through the joint frames; null when the chain has a gap. */
  measuredStackUpMm: number | null;
  /**
   * Result of the last validation pass.
   *
   * When it is ``pass`` the joint-frame warning is suppressed and the panel
   * appears in its "measurable" style — the assembly is accepted (for example
   * the 3X Axial libraries that ship without MCS/CSW frames but carry
   * Fusion's own gauge length), so a warning about missing frames is noise.
   */
  validationStatus: ValidationStatus;
}

export function ReviewPanel({
  rows,
  config,
  measuredStackUpMm,
  validationStatus,
}: ReviewPanelProps) {
  const chosen = rows.filter((row) => row.toolId !== null);
  const measurable = measuredStackUpMm !== null;
  // Treat a passing validation as "measurable enough" for the panel's tone,
  // so a 3X Axial assembly does not sit under an amber warning after Save.
  const accepted = measurable || validationStatus === "pass";

  return (
    <section
      className={[
        "rounded-[2px] border p-3",
        accepted
          ? "border-weave-success/30 bg-weave-success-bg"
          : "border-weave-warning/30 bg-weave-warning-bg",
      ].join(" ")}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={[
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
            accepted ? "bg-weave-success" : "bg-weave-warning",
          ].join(" ")}
        >
          {accepted ? "✓" : "!"}
        </span>
        <div>
          <h3 className="text-sm font-bold text-weave-text">Final assembly review</h3>
          <p className="text-[11px] text-weave-text-placeholder">
            {measurable
              ? "Joint chain is complete and the stack-up is measurable."
              : accepted
                ? "Assembly is validated and ready to save."
                : "Stack-up cannot be measured until every component has MCS and CSW frames."}
          </p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
        <ReviewField
          label="Measured stack-up"
          value={measurable ? `${measuredStackUpMm.toFixed(2)} mm` : "Not measurable"}
        />
        <ReviewField label="Machine side connection" value={config.machineSideConnectionType} />
        <ReviewField label="Orientation" value={config.orientation} />
        <ReviewField
          label="Turret station"
          value={
            config.stationNumber !== null
              ? `${config.stationNumber}${config.halfIndex ? " (half index)" : ""}`
              : "—"
          }
        />
      </div>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-weave-surface-300/60 text-left">
            <th className="border border-weave-divider px-2 py-1 font-semibold">Component</th>
            <th className="border border-weave-divider px-2 py-1 font-semibold">Type</th>
            <th className="border border-weave-divider px-2 py-1 font-semibold">Joints</th>
            <th className="border border-weave-divider px-2 py-1 font-semibold">Span</th>
          </tr>
        </thead>
        <tbody>
          {chosen.map((row) => (
            <tr key={row.id}>
              <td className="border border-weave-divider px-2 py-1">{row.name}</td>
              <td className="border border-weave-divider px-2 py-1">{row.type}</td>
              <td className="border border-weave-divider px-2 py-1">
                {row.missingFrame === null
                  ? "MCS + CSW"
                  : row.missingFrame === "geometry"
                    ? "No solid"
                    : `No ${row.missingFrame}`}
              </td>
              <td className="border border-weave-divider px-2 py-1">
                {row.spanMm != null ? `${row.spanMm.toFixed(2)} mm` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {chosen.some((row) => row.hasTransformOverride) && (
        <p className="mt-2 text-[11px] leading-relaxed text-weave-text-placeholder">
          This assembly positions its block manually through transformOverride, which
          overrides the joint chain. Fusion's UI writes that value; it is not exposed
          through the API.
        </p>
      )}
    </section>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-weave-divider bg-weave-surface-250/70 px-2 py-1">
      <span className="block text-[10px] text-weave-text-placeholder">{label}</span>
      <span className="font-semibold capitalize text-weave-text">{value}</span>
    </div>
  );
}
