import type { ReactNode } from "react";
import { displayName, type LibraryToolRecord } from "../data/realLibrary";
import type { AssemblyConfig, Orientation } from "../types";

interface ConfigurationPanelProps {
  tool: LibraryToolRecord | undefined;
  config: AssemblyConfig;
  onConfigChange: (patch: Partial<AssemblyConfig>) => void;
  readOnly?: boolean;
}

/** Real geometry keys worth showing, with the labels Fusion uses. */
const GEOMETRY_LABELS: Record<string, string> = {
  OAL: "Overall length",
  RE: "Corner radius",
  SC: "Shape code",
  INSD: "Insert size",
  S: "Thickness",
  DC: "Diameter",
  LCF: "Flute length",
  NOF: "Flutes",
  adaptiveItemSize: "Adaptive item size",
};

export function ConfigurationPanel({
  tool,
  config,
  onConfigChange,
  readOnly = false,
}: ConfigurationPanelProps) {
  const title =
    tool !== undefined ? `${tool.type} properties` : "Tool block properties";

  const geometryEntries = Object.entries(tool?.geometry ?? {})
    .filter(([key]) => key in GEOMETRY_LABELS)
    .slice(0, 6);

  return (
    <section className="py-2">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-base font-semibold leading-[22px] text-weave-text">{title}</h3>
        <div className="flex-1" />
        <button
          type="button"
          className="inline-flex h-6 items-center gap-1 rounded-[2px] border border-weave-divider-heavy px-3 text-xs font-semibold text-weave-text hover:bg-weave-surface-250"
        >
          <PencilIcon />
          Edit tool block in library
        </button>
      </div>

      {tool !== undefined && (
        <FormRow label="Model">
          <div className="flex items-center gap-1">
            <input
              readOnly
              value={tool.productId !== "" ? tool.productId : displayName(tool)}
              className="h-6 min-w-0 flex-1 border-0 bg-weave-input px-2 text-xs font-semibold"
            />
            <IconButton label="Browse" />
            <IconButton label="Clear" />
          </div>
        </FormRow>
      )}

      <FormRow label="">
        <button
          type="button"
          className="h-6 rounded-[2px] border border-weave-divider-heavy px-3 text-xs font-semibold hover:bg-weave-surface-250"
        >
          Edit Connection Points
        </button>
      </FormRow>

      <FormRow label="Orientation">
        <OrientationPicker
          value={config.orientation}
          onChange={(v) => onConfigChange({ orientation: v })}
          disabled={readOnly}
        />
      </FormRow>

      <FormRow label="Machine side connection">
        <SelectField
          value={config.machineSideConnectionType}
          options={["Unspecified", "VDI 16", "VDI 25", "VDI 30", "VDI 40", "HSK-A63"]}
          onChange={(v) => onConfigChange({ machineSideConnectionType: v })}
          disabled={readOnly}
        />
      </FormRow>

      <FormRow label="Adaptive item size">
        <NumericField
          value={config.adaptiveItemSize}
          suffix="mm"
          onChange={(v) => onConfigChange({ adaptiveItemSize: v })}
          disabled={readOnly}
        />
      </FormRow>

      <FormRow label="Number of tools">
        <NumericField
          value={config.numberOfTools}
          onChange={(v) => onConfigChange({ numberOfTools: v })}
          disabled={readOnly}
          min={1}
          max={8}
        />
      </FormRow>

      <FormRow label="Attachment points">
        <NumericField
          value={config.numberOfAttachmentPoints}
          onChange={(v) => onConfigChange({ numberOfAttachmentPoints: v })}
          disabled={readOnly}
          min={0}
          max={12}
        />
      </FormRow>

      <FormRow label="Turret station">
        <NumericField
          value={config.stationNumber ?? 0}
          onChange={(v) => onConfigChange({ stationNumber: v })}
          disabled={readOnly}
          min={0}
          max={99}
        />
      </FormRow>

      <FormRow label="Half index">
        <label className="inline-flex cursor-pointer items-center gap-1.5 py-1 text-xs">
          <input
            type="checkbox"
            checked={config.halfIndex}
            disabled={readOnly}
            onChange={(event) => onConfigChange({ halfIndex: event.target.checked })}
            className="accent-weave-primary"
          />
          Station offset by half an index
        </label>
      </FormRow>

      {geometryEntries.length > 0 && (
        <div className="mt-3 border-t border-weave-divider pt-3">
          <p className="mb-2 text-xs font-semibold text-weave-text">
            Library geometry
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {geometryEntries.map(([key, value]) => (
              <Metric
                key={key}
                label={GEOMETRY_LABELS[key]}
                value={typeof value === "number" ? `${value} mm` : String(value)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
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

function OrientationPicker({
  value,
  onChange,
  disabled,
}: {
  value: Orientation;
  onChange: (v: Orientation) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-3">
      {(["axial", "radial"] as Orientation[]).map((opt) => (
        <label
          key={opt}
          className={[
            "inline-flex cursor-pointer items-center gap-1.5 text-xs capitalize",
            disabled ? "opacity-55" : "",
          ].join(" ")}
        >
          <input
            type="radio"
            name="orientation"
            checked={value === opt}
            disabled={disabled}
            onChange={() => onChange(opt)}
            className="accent-weave-primary"
          />
          <OrientationGlyph type={opt} />
          {opt}
        </label>
      ))}
    </div>
  );
}

function OrientationGlyph({ type }: { type: Orientation }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="text-weave-text">
      {type === "axial" ? (
        <rect x="8" y="3" width="4" height="14" fill="currentColor" opacity="0.35" />
      ) : (
        <rect x="3" y="8" width="14" height="4" fill="currentColor" opacity="0.35" />
      )}
    </svg>
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

function NumericField({
  value,
  onChange,
  suffix,
  disabled,
  min = 0,
  max = 999,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex h-6 w-full items-center border-0 bg-weave-input">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="min-w-0 flex-1 border-0 bg-transparent px-2 text-xs font-semibold outline-none disabled:opacity-55"
      />
      {suffix !== undefined && (
        <span className="border-l border-weave-divider px-2 text-[10px] text-weave-text-placeholder">
          {suffix}
        </span>
      )}
      <div className="flex flex-col border-l border-weave-divider">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-3 w-6 items-center justify-center text-[8px] hover:bg-weave-surface-250 disabled:opacity-40"
        >
          ▲
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-3 w-6 items-center justify-center text-[8px] hover:bg-weave-surface-250 disabled:opacity-40"
        >
          ▼
        </button>
      </div>
    </div>
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

function IconButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
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
