import type { ReactNode } from "react";
import { geometryLabel, SUMMARY_GEOMETRY_KEYS } from "../data/geometryLabels";
import {
  displayName,
  isBlockType,
  libraryById,
  type LibraryToolRecord,
} from "../data/realLibrary";
import type {
  AssemblyConfig,
  AssemblyRow,
  SlotLevel,
} from "../types";

interface ConfigurationPanelProps {
  tool: LibraryToolRecord | undefined;
  /** The selected row, which carries what the assembly measured for it. */
  row: AssemblyRow | undefined;
  config: AssemblyConfig;
  onConfigChange: (patch: Partial<AssemblyConfig>) => void;
  /** Opens the tool library on the record this row holds. */
  onEditInLibrary?: (toolId: string) => void;
  /** Opens the library picker so this row can be filled or swapped. */
  onBrowse?: () => void;
  onClear?: () => void;
  readOnly?: boolean;
}

const LEVEL_NOUNS: Record<SlotLevel, string> = {
  extension: "extension",
  collet: "collet",
  tool: "cutting tool",
};

/** What an unfilled step is called, which depends on what it can take. */
function acceptsNoun(accepts: SlotLevel[]): string {
  return accepts.length === 0
    ? "component"
    : accepts.map((kind) => LEVEL_NOUNS[kind]).join(" or ");
}

/** Why a gauge length could not be measured, in the terms the row reports it. */
const MISSING_FRAME_REASONS = {
  MCS: "No machine-side frame stored with this solid",
  CSW: "No cutting-side frame stored with this solid",
  geometry: "No solid geometry stored for this record",
} as const;

export function ConfigurationPanel({
  tool,
  row,
  config,
  onConfigChange,
  onEditInLibrary,
  onBrowse,
  onClear,
  readOnly = false,
}: ConfigurationPanelProps) {
  // The block is the mount everything else hangs off, so it gets the settings
  // that belong to the assembly; every other row describes its own library item.
  const isBlockRow = row === undefined || row.role === "block";
  const level = row?.level ?? null;
  const noun = isBlockRow
    ? "tool block"
    : tool?.type ?? (level !== null ? LEVEL_NOUNS[level] : acceptsNoun(row.accepts));
  const library = tool === undefined ? undefined : libraryById(tool.libraryId);

  const geometryEntries = Object.entries(tool?.geometry ?? {})
    .filter(([key]) => SUMMARY_GEOMETRY_KEYS.includes(key))
    .slice(0, 6);

  return (
    <section className="py-2">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-base font-semibold capitalize leading-[22px] text-weave-text">
          {noun} properties
        </h3>
        <div className="flex-1" />
        <button
          type="button"
          disabled={tool === undefined}
          title={
            tool === undefined
              ? "Choose a library item for this row first"
              : `Open ${displayName(tool)} in the tool library`
          }
          onClick={() => {
            if (tool !== undefined) onEditInLibrary?.(tool.id);
          }}
          className={
            tool === undefined
              ? // No component yet: a quiet, disabled hint.
                "inline-flex h-7 items-center gap-1.5 rounded-[2px] border border-weave-divider-heavy px-3 text-xs font-semibold text-weave-text opacity-45 disabled:cursor-default"
              : // Assigned: a filled, primary-weight button so editing is an
                // obvious next action rather than a faint outline.
                "inline-flex h-7 items-center gap-1.5 rounded-[2px] border border-weave-primary bg-weave-primary px-3 text-xs font-semibold text-white shadow-sm hover:bg-weave-primary-hover"
          }
        >
          <PencilIcon />
          Edit {noun} in library
        </button>
      </div>

      {tool === undefined ? (
        <p className="mb-2 text-xs text-weave-text-placeholder">
          {isBlockRow
            ? "No tool block yet. Choose one to see its properties."
            : `This position takes ${noun} here. Choose one to see its properties.`}
        </p>
      ) : (
        <FormRow label="Model">
          <div className="flex items-center gap-1">
            <input
              readOnly
              value={modelName(tool, row, isBlockRow)}
              className="h-6 min-w-0 flex-1 border-0 bg-weave-input px-2 text-xs font-semibold"
            />
            <IconButton label="Browse" onClick={onBrowse} />
            <IconButton label="Clear" onClick={onClear} />
          </div>
        </FormRow>
      )}

      {isBlockRow ? (
        <>
          {tool !== undefined && !isBlockType(tool.type) && (
            <ReadOnlyRow label="Carried by" value={displayName(tool)} />
          )}
          <ReadOnlyRow label="Library" value={library?.breadcrumb ?? library?.name} />
          <BlockFields
            config={config}
            onConfigChange={onConfigChange}
            readOnly={readOnly}
          />
        </>
      ) : (
        <>
          <ReadOnlyRow label="Description" value={tool?.description} />
          <ReadOnlyRow label="Type" value={tool?.type} />
          <ReadOnlyRow label="Vendor" value={tool?.vendor} />
          <ReadOnlyRow label="Product ID" value={tool?.productId} />
          <ReadOnlyRow label="Library" value={library?.breadcrumb ?? library?.name} />
          <ReadOnlyRow label="Unit" value={tool?.unit} />
          <ReadOnlyRow label="Solid" value={tool?.stepFileName} />
          {tool !== undefined && (
            <>
              <ReadOnlyRow label="Gauge length" value={gaugeText(row)} />
              <ReadOnlyRow
                label="Solid span"
                value={row?.spanMm != null ? `${row.spanMm.toFixed(2)} mm` : null}
              />
            </>
          )}
          {/* The station belongs to the position, so it shows against whatever
              occupies it — a cutting tool as readily as an extension. */}
          {row?.depth === 0 && (
            <ReadOnlyRow label="Turret station" value={stationText(row)} />
          )}
        </>
      )}

      {geometryEntries.length > 0 && (
        <div className="mt-3 border-t border-weave-divider pt-3">
          <p className="mb-2 text-xs font-semibold text-weave-text">
            Library geometry
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {geometryEntries.map(([key, value]) => (
              <Metric
                key={key}
                label={geometryLabel(key)}
                value={typeof value === "number" ? `${value} mm` : String(value)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * What the Model field names. A block row names the block itself, which a tool
 * can carry inline, so it comes off the row rather than off the library record.
 */
function modelName(
  tool: LibraryToolRecord,
  row: AssemblyRow | undefined,
  isBlockRow: boolean,
): string {
  if (isBlockRow && row?.name !== undefined && row.name !== "") return row.name;
  return tool.productId !== "" ? tool.productId : displayName(tool);
}

/** Reach past the block face, or the reason the chain could not be measured. */
function gaugeText(row: AssemblyRow | undefined): string {
  if (row?.gaugeLengthMm != null) return `${row.gaugeLengthMm.toFixed(2)} mm`;
  if (row?.missingFrame != null) return MISSING_FRAME_REASONS[row.missingFrame];
  return "Not measured until the position is complete";
}

function stationText(row: AssemblyRow | undefined): string {
  if (row?.stationNumber == null) return "—";
  const source = row.stationFollowsOrder ? " (from row order)" : "";
  const half = row.halfIndex ? ", half index" : "";
  return `${row.stationNumber}${half}${source}`;
}

function BlockFields({
  config,
  onConfigChange,
  readOnly,
}: {
  config: AssemblyConfig;
  onConfigChange: (patch: Partial<AssemblyConfig>) => void;
  readOnly: boolean;
}) {
  return (
    <>
      <FormRow label="">
        <button
          type="button"
          className="h-6 rounded-[2px] border border-weave-divider-heavy px-3 text-xs font-semibold hover:bg-weave-surface-250"
        >
          Edit Connection Points
        </button>
      </FormRow>

      <FormRow label="Machine side connection">
        <SelectField
          value={config.machineSideConnectionType}
          options={["Unspecified", "VDI 16", "VDI 25", "VDI 30", "VDI 40", "HSK-A63"]}
          onChange={(v) => onConfigChange({ machineSideConnectionType: v })}
          disabled={readOnly}
        />
      </FormRow>

      {/* Number of tools and Attachment points are not editable block
          settings: the number of mounting positions is read straight off the
          block and shown by the assembly table above. Orientation, adaptive
          item size, turret station and half index are properties of the
          machine rather than of the tool block, so they are not shown here. */}
    </>
  );
}

function ReadOnlyRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (value == null || value.trim() === "") return null;

  return (
    <FormRow label={label}>
      <span className="block py-1 text-xs text-weave-text">{value}</span>
    </FormRow>
  );
}

function FormRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-2 flex gap-0.5 pr-1">
      <label className="w-[155px] shrink-0 py-1 text-xs font-medium capitalize text-weave-text">
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function SelectField({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-6 w-full border-0 bg-weave-input px-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-weave-focus/40 disabled:opacity-55"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-weave-divider bg-weave-surface-250/50 px-2 py-1">
      <span className="block text-[10px] text-weave-text-placeholder">{label}</span>
      <span className="font-semibold text-weave-text">{value}</span>
    </div>
  );
}

function IconButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center border border-weave-input-border hover:bg-weave-surface-250"
    >
      <span className="text-[10px]">···</span>
    </button>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
