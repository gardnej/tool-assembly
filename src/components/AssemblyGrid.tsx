import type { ReactNode } from "react";
import { getComponentById } from "../data/toolComponents";
import type { AssemblyRow, AssemblySlot } from "../types";

interface AssemblyGridProps {
  holderRow: AssemblyRow | undefined;
  slots: AssemblySlot[];
  selectedId: string | null;
  onSelectRow: (id: string) => void;
  onSelectSlot: (slotId: string) => void;
}

export function AssemblyGrid({
  holderRow,
  slots,
  selectedId,
  onSelectRow,
  onSelectSlot,
}: AssemblyGridProps) {
  const holderComponent =
    holderRow !== undefined ? getComponentById(holderRow.componentId) : undefined;

  return (
    <section className="overflow-hidden rounded-[2px] border border-weave-divider bg-weave-input/40">
      <div className="grid grid-cols-[minmax(180px,1.4fr)_1fr_1fr_1fr]">
        <GridHeader>Name</GridHeader>
        <GridHeader>Type</GridHeader>
        <GridHeader>Stick out</GridHeader>
        <GridHeader>Total length</GridHeader>

        {holderRow !== undefined && holderComponent !== undefined && (
          <button
            type="button"
            onClick={() => onSelectRow(holderRow.id)}
            className="contents"
          >
            <GridCell
              selected={selectedId === holderRow.id}
              className="flex items-center gap-1 pl-6"
            >
              <TagIcon />
              <span className="truncate font-normal">{holderComponent.name}</span>
            </GridCell>
            <GridCell selected={selectedId === holderRow.id}>
              {holderRow.type}
            </GridCell>
            <GridCell selected={selectedId === holderRow.id}>
              {holderRow.stickOut} mm
            </GridCell>
            <GridCell selected={selectedId === holderRow.id}>
              {holderRow.totalLength} mm
            </GridCell>
          </button>
        )}

        {holderRow === undefined && (
          <div className="col-span-4 border-b border-weave-divider px-3 py-4 text-center text-xs text-weave-text-placeholder">
            No tool holder in assembly — select one from the component library.
          </div>
        )}

        {slots.map((slot) => {
          const component =
            slot.componentId !== null ? getComponentById(slot.componentId) : undefined;
          const isSelected = selectedId === slot.id;

          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onSelectSlot(slot.id)}
              className="contents"
            >
              <GridCell selected={isSelected} className="flex items-center gap-1 pl-8">
                <TreeGuide />
                <span className="w-10 shrink-0 text-left">{slot.label}</span>
                <span
                  className={[
                    "min-w-0 flex-1 truncate rounded border px-2 py-0.5 text-left",
                    component !== undefined
                      ? "border-0 bg-weave-input font-normal text-weave-text"
                      : "border-0 bg-weave-input text-weave-text-placeholder",
                  ].join(" ")}
                >
                  {component?.name ?? "Select component"}
                </span>
                <AddSlotButton />
              </GridCell>
              <GridCell selected={isSelected}>{component?.type ?? "—"}</GridCell>
              <GridCell selected={isSelected}>
                {component !== undefined ? `${component.stickOut} mm` : "—"}
              </GridCell>
              <GridCell selected={isSelected}>
                {component !== undefined ? `${component.totalLength} mm` : "—"}
              </GridCell>
            </button>
          );
        })}
      </div>

      <div className="flex h-6 items-center gap-1 bg-weave-surface-250 px-2">
        <ToolbarButton label="Remove" />
        <ToolbarButton label="Delete" />
      </div>
    </section>
  );
}

function GridHeader({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-r border-weave-divider bg-weave-surface-300 px-2 py-1.5 text-xs font-semibold">
      {children}
    </div>
  );
}

function GridCell({
  children,
  selected,
  className = "",
}: {
  children: ReactNode;
  selected?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        "border-b border-r border-weave-divider px-2 py-1.5 text-xs",
        selected ? "bg-weave-selected" : "bg-weave-dialog/60",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function TreeGuide() {
  return (
    <span className="flex h-8 w-5 shrink-0 items-center justify-center">
      <span className="h-full w-px border-r border-dashed border-weave-divider-heavy" />
    </span>
  );
}

function TagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0 text-weave-focus">
      <path d="M2 2h5l5 5-5 5H2V2z" fill="currentColor" opacity="0.2" />
      <path d="M2 2h5l5 5-5 5H2V2z" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function AddSlotButton() {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-weave-input-border text-weave-text-placeholder hover:bg-weave-surface-250">
      +
    </span>
  );
}

function ToolbarButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="flex h-5 w-5 items-center justify-center rounded text-weave-text-placeholder hover:bg-weave-surface-300"
    >
      {label === "Remove" ? "×" : "🗑"}
    </button>
  );
}
