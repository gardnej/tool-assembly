import { getComponentById } from "../data/toolComponents";
import type { AssemblyConfig, AssemblyRow, AssemblySlot, ToolComponent } from "../types";

interface ReviewPanelProps {
  holderRow: AssemblyRow | undefined;
  slots: AssemblySlot[];
  config: AssemblyConfig;
  components: ToolComponent[];
}

export function ReviewPanel({
  holderRow,
  slots,
  config,
  components,
}: ReviewPanelProps) {
  const holder =
    holderRow !== undefined ? getComponentById(holderRow.componentId) : undefined;
  const slotComponents = slots
    .filter((s) => s.componentId !== null)
    .map((s) => ({
      slot: s,
      component: getComponentById(s.componentId as string),
    }));

  const insert = components.find((c) => c.category === "insert");

  return (
    <section className="rounded-[2px] border border-weave-success/30 bg-weave-success-bg p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-weave-success text-xs font-bold text-white">
          ✓
        </span>
        <div>
          <h3 className="text-sm font-bold text-weave-text">Final assembly review</h3>
          <p className="text-[11px] text-weave-text-placeholder">
            Turning tool holder assembly is ready to save to the tool library.
          </p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
        <ReviewField label="Tool holder" value={holder?.name ?? "—"} />
        <ReviewField label="Connection" value={config.toolConnectionType} />
        <ReviewField label="Orientation" value={config.orientation} />
        <ReviewField label="Stick out" value={`${config.stickOut} mm`} />
        <ReviewField label="Total length" value={`${config.totalLength} mm`} />
        <ReviewField label="Components" value={`${slotComponents.length + (holder ? 1 : 0)}`} />
      </div>

      <table className="mb-3 w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-weave-surface-300/60 text-left">
            <th className="border border-weave-divider px-2 py-1 font-semibold">Item</th>
            <th className="border border-weave-divider px-2 py-1 font-semibold">Type</th>
            <th className="border border-weave-divider px-2 py-1 font-semibold">Vendor</th>
          </tr>
        </thead>
        <tbody>
          {holder !== undefined && (
            <tr>
              <td className="border border-weave-divider px-2 py-1">{holder.name}</td>
              <td className="border border-weave-divider px-2 py-1">{holder.type}</td>
              <td className="border border-weave-divider px-2 py-1">{holder.vendor}</td>
            </tr>
          )}
          {slotComponents.map(({ slot, component }) => (
            <tr key={slot.id}>
              <td className="border border-weave-divider px-2 py-1">
                {component?.name ?? slot.label}
              </td>
              <td className="border border-weave-divider px-2 py-1">
                {component?.type ?? "—"}
              </td>
              <td className="border border-weave-divider px-2 py-1">
                {component?.vendor ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {insert?.cuttingParameters !== undefined && (
        <div className="rounded border border-weave-divider bg-weave-surface-250/80 p-2">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-weave-text-placeholder">
            Recommended cutting parameters
          </p>
          <p className="text-[11px] text-weave-text">
            {insert.cuttingParameters.surfaceSpeed} m/min · feed{" "}
            {insert.cuttingParameters.feedPerRev} mm/rev · DOC{" "}
            {insert.cuttingParameters.depthOfCut} mm · {insert.cuttingParameters.material}
          </p>
        </div>
      )}

      {/* Future: persist via Fusion Tool Library API / Neutron document write */}
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
