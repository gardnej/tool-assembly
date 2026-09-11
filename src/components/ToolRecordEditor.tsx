import { useState, type MouseEvent, type ReactNode } from "react";
import { geometryLabel, geometryUnit } from "../data/geometryLabels";
import {
  isToolEdited,
  revertToolEdit,
  saveToolEdit,
  toolEditDraft,
  type ToolPostProcessEdit,
  type ToolRecordEdit,
} from "../data/libraryEdits";
import {
  LIBRARIES,
  displayName,
  isBlockType,
  libraryById,
  solidSpanMm,
  toolsForLibrary,
  type LibraryToolRecord,
} from "../data/realLibrary";
import { PrimaryButton } from "./buttons/PrimaryButton";
import { SecondaryButton } from "./buttons/SecondaryButton";
import { ToolEditorPreview } from "./ToolEditorPreview";
import "./tool-record-editor.css";

interface ToolRecordEditorProps {
  record: LibraryToolRecord;
  onClose: () => void;
}

/** Full tab set for a cutting tool. */
const TOOL_TABS = [
  "General",
  "Cutter",
  "Shaft",
  "Holder",
  "Tool block",
  "Cutting data",
  "Post processor",
] as const;

/**
 * A tool block is agnostic to spindle direction and carries no cutter, shaft or
 * holder, so its editor is pared back to the three tabs that describe the block
 * itself: identity, its own geometry, and how it posts.
 */
const BLOCK_TABS = ["General", "Geometry", "Post processor"] as const;

type TabId = (typeof TOOL_TABS)[number] | (typeof BLOCK_TABS)[number];

/** The cutter fields Fusion lists for a milling or drilling tool, in its order. */
const MILLING_FIELDS = [
  "DC",
  "SFDM",
  "RE",
  "SIG",
  "TP",
  "OAL",
  "LB",
  "LS",
  "LCF",
];

/** The insert fields Fusion lists for a turning tool. */
const TURNING_FIELDS = [
  "SC",
  "SCTY",
  "TC",
  "INSD",
  "S",
  "RE",
  "EPSR",
  "RA",
  "LH",
  "OAL",
];

/**
 * Block geometry fields shown on the block's Geometry tab.
 *
 * `numberOfTools` and `numberOfAttachmentPoints` are intentionally omitted: the
 * number of mounting positions is read straight off the block and shown by the
 * assembly table, so it is not an editable field of the block itself.
 */
const BLOCK_FIELDS = [
  "adaptiveItemSize",
  "orientationType",
  "machineSideConnectionType",
];

const MATERIALS = ["", "HSS", "Carbide", "Cobalt", "Ceramic", "Diamond"];

/**
 * Fusion's tool editor.
 *
 * The tabs, their order and their fields follow the real dialog. Values come
 * from the record where the export carries them; the fields Fusion has and the
 * export does not open empty and are kept with the edit, so the dialog stays
 * whole rather than showing a shortened form of itself.
 */
export function ToolRecordEditor({ record, onClose }: ToolRecordEditorProps) {
  const isBlock = isBlockType(record.type);
  const tabs = isBlock ? BLOCK_TABS : TOOL_TABS;
  const [tab, setTab] = useState<TabId>("General");
  const [draft, setDraft] = useState<ToolRecordEdit>(() => toolEditDraft(record));
  const library = libraryById(record.libraryId);
  const edited = isToolEdited(record.id);

  const patch = (part: Partial<ToolRecordEdit>) => {
    setDraft((prev) => ({ ...prev, ...part }));
  };

  const patchPost = (part: Partial<ToolPostProcessEdit>) => {
    setDraft((prev) => ({ ...prev, postProcess: { ...prev.postProcess, ...part } }));
  };

  const setGeometry = (key: string, value: number | string | boolean | null) => {
    setDraft((prev) => {
      const geometry = { ...prev.geometry };
      if (value === null) delete geometry[key];
      else geometry[key] = value;
      return { ...prev, geometry };
    });
  };

  const handleBackdrop = (event: MouseEvent) => {
    if (event.target === event.currentTarget) onClose();
  };

  const handleSave = () => {
    saveToolEdit(record.id, draft);
    onClose();
  };

  return (
    <div className="te-overlay" role="presentation" onMouseDown={handleBackdrop}>
      <section
        className="te-shell"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${displayName(record)}`}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="te-crumbs">
          <span className="te-crumbs__library">{library?.name ?? "Library"}</span>
          <span className="te-crumbs__sep">/</span>
          <span className="te-crumbs__icon" aria-hidden="true" />
          <span className="te-crumbs__tool">{toolCaption(record, draft)}</span>
          <span className="te-crumbs__spacer" />
          <button
            type="button"
            className="te-crumbs__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <nav className="te-tabs" role="tablist" aria-label="Tool">
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={["te-tab", tab === id ? "te-tab--active" : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                setTab(id);
              }}
            >
              {id}
            </button>
          ))}
        </nav>

        <div className="te-body">
          <div className="te-panel" role="tabpanel" aria-label={tab}>
            {tab === "General" && (
              <Card>
                <Field label="Description">
                  <input
                    className="te-input"
                    value={draft.description}
                    onChange={(e) => patch({ description: e.target.value })}
                  />
                </Field>
                <Field label="Vendor">
                  <input
                    className="te-input"
                    value={draft.vendor}
                    onChange={(e) => patch({ vendor: e.target.value })}
                  />
                </Field>
                <Field label="Product id">
                  <input
                    className="te-input"
                    value={draft.productId}
                    onChange={(e) => patch({ productId: e.target.value })}
                  />
                </Field>
                <Field label="Product link">
                  <input
                    className="te-input"
                    value={draft.productLink}
                    onChange={(e) => patch({ productLink: e.target.value })}
                  />
                </Field>
              </Card>
            )}

            {tab === "Geometry" && (
              <BlockGeometryTab
                record={record}
                draft={draft}
                onGeometry={setGeometry}
              />
            )}

            {tab === "Cutter" && (
              <CutterTab
                record={record}
                draft={draft}
                onPatch={patch}
                onGeometry={setGeometry}
              />
            )}

            {tab === "Shaft" && <ShaftTab />}

            {tab === "Holder" && <HolderTab record={record} />}

            {tab === "Tool block" && <ToolBlockTab record={record} />}

            {tab === "Cutting data" && <CuttingDataTab unit={draft.unit} />}

            {tab === "Post processor" && (
              <PostProcessorTab post={draft.postProcess} onPatch={patchPost} />
            )}
          </div>

          <ToolEditorPreview record={record} geometry={draft.geometry} />
        </div>

        <footer className="te-footer">
          <span className="te-footer__version">v2.13.4 Online</span>
          {edited && (
            <button
              type="button"
              className="te-revert"
              onClick={() => {
                revertToolEdit(record.id);
                onClose();
              }}
            >
              Revert to library
            </button>
          )}
          <span className="te-footer__spacer" />
          <PrimaryButton split onClick={handleSave}>
            OK
          </PrimaryButton>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        </footer>
      </section>
    </div>
  );
}

/** The caption Fusion puts in the breadcrumb: number, size and type. */
function toolCaption(record: LibraryToolRecord, draft: ToolRecordEdit): string {
  const number = draft.postProcess.number;
  const diameter = draft.geometry.DC;
  const angle = draft.geometry.SIG;

  const size = typeof diameter === "number" ? `⌀${diameter}mm` : "";
  const point = typeof angle === "number" ? `${angle}°` : "";
  const named = [size, point].filter((part) => part !== "").join(" ");
  const label = named !== "" ? named : displayName(record);

  return `${number !== null ? `${number} - ` : ""}${label} (${record.type})`;
}

/**
 * The block's own geometry, shown in place of the cutter tab.
 *
 * A tool block has no cutter, so this lists only the block's dimensional and
 * connection fields. The position count is deliberately not here — it is read
 * off the block and shown by the assembly table instead.
 */
function BlockGeometryTab({
  record,
  draft,
  onGeometry,
}: {
  record: LibraryToolRecord;
  draft: ToolRecordEdit;
  onGeometry: (key: string, value: number | string | boolean | null) => void;
}) {
  const span = solidSpanMm(record.geometryId);

  return (
    <div className="te-column">
      <Card>
        <Field label="Type">
          <input
            className="te-input"
            value={record.type}
            readOnly
            title="A record's type decides where it can sit in an assembly, so it is fixed here"
          />
        </Field>
        <Field label="Unit">
          <input className="te-input" value={draft.unit} readOnly />
        </Field>
      </Card>

      <Card title="Geometry">
        {BLOCK_FIELDS.map((key) => (
          <GeometryField
            key={key}
            fieldKey={key}
            value={draft.geometry[key]}
            unit={draft.unit}
            onChange={onGeometry}
          />
        ))}
      </Card>

      <Card title="Tool assembly">
        <Field label="Gauge length">
          <input
            className="te-input"
            readOnly
            value={span !== null ? `${span.toFixed(4)} mm` : "No solid to measure"}
          />
        </Field>
      </Card>
    </div>
  );
}

function CutterTab({
  record,
  draft,
  onPatch,
  onGeometry,
}: {
  record: LibraryToolRecord;
  draft: ToolRecordEdit;
  onPatch: (part: Partial<ToolRecordEdit>) => void;
  onGeometry: (key: string, value: number | string | boolean | null) => void;
}) {
  const fields = fieldsFor(record, draft.geometry);
  const rest = Object.keys(draft.geometry).filter(
    (key) => !fields.includes(key) && key !== "NOF",
  );
  const span = solidSpanMm(record.geometryId);

  return (
    <div className="te-column">
      <Card>
        <Field label="Type">
          <input
            className="te-input"
            value={record.type}
            readOnly
            title="A record's type decides where it can sit in an assembly, so it is fixed here"
          />
        </Field>
        <Field label="Unit">
          <select
            className="te-input"
            value={draft.unit}
            onChange={(e) => onPatch({ unit: e.target.value })}
          >
            <option value="millimeters">Millimeters</option>
            <option value="inches">Inches</option>
          </select>
        </Field>
        <Field label="Clockwise spindle rotation">
          <input
            type="checkbox"
            checked={draft.clockwiseSpindleRotation}
            onChange={(e) => onPatch({ clockwiseSpindleRotation: e.target.checked })}
          />
        </Field>
        {"NOF" in draft.geometry && (
          <Field label="Number of flutes">
            <NumberInput
              value={numberOrNull(draft.geometry.NOF)}
              onChange={(value) => onGeometry("NOF", value ?? 0)}
            />
          </Field>
        )}
        <Field label="Material">
          <select
            className="te-input"
            value={draft.material}
            onChange={(e) => onPatch({ material: e.target.value })}
          >
            {MATERIALS.map((material) => (
              <option key={material} value={material}>
                {material === "" ? "Unspecified" : material}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card title="Geometry">
        {fields.map((key) => (
          <GeometryField
            key={key}
            fieldKey={key}
            value={draft.geometry[key]}
            unit={draft.unit}
            onChange={onGeometry}
          />
        ))}
      </Card>

      {rest.length > 0 && (
        <Card title="Other geometry">
          {rest.map((key) => (
            <GeometryField
              key={key}
              fieldKey={key}
              value={draft.geometry[key]}
              unit={draft.unit}
              onChange={onGeometry}
            />
          ))}
        </Card>
      )}

      <Card title="Tool assembly">
        <Field label="Gauge length">
          <input
            className="te-input"
            readOnly
            value={span !== null ? `${span.toFixed(4)} mm` : "No solid to measure"}
          />
        </Field>
      </Card>
    </div>
  );
}

/** Fusion's field list for the family this record belongs to. */
function fieldsFor(
  record: LibraryToolRecord,
  geometry: Record<string, number | string | boolean>,
): string[] {
  if (isBlockType(record.type)) return BLOCK_FIELDS;
  if ("SC" in geometry || "INSD" in geometry) return TURNING_FIELDS;
  return MILLING_FIELDS;
}

function GeometryField({
  fieldKey,
  value,
  unit,
  onChange,
}: {
  fieldKey: string;
  value: number | string | boolean | undefined;
  unit: string;
  onChange: (key: string, value: number | string | boolean | null) => void;
}) {
  const suffix = geometryUnit(fieldKey, unit);

  if (typeof value === "boolean") {
    return (
      <Field label={geometryLabel(fieldKey)}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(fieldKey, e.target.checked)}
        />
      </Field>
    );
  }

  if (typeof value === "string") {
    return (
      <Field label={geometryLabel(fieldKey)}>
        <input
          className="te-input"
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
        />
      </Field>
    );
  }

  return (
    <Field label={geometryLabel(fieldKey)}>
      <NumberInput
        value={value ?? null}
        suffix={suffix}
        placeholder="Not in export"
        onChange={(next) => onChange(fieldKey, next)}
      />
    </Field>
  );
}

function ShaftTab() {
  return (
    <div className="te-table-card">
      <div className="te-table-toolbar">
        <IconButton label="Add segment" glyph="plus" />
        <IconButton label="Delete segment" glyph="trash" />
      </div>
      <table className="te-table">
        <thead>
          <tr>
            <th>Index</th>
            <th>Height</th>
            <th>Upper diameter</th>
            <th>Lower diameter</th>
          </tr>
        </thead>
      </table>
      <EmptyState
        caption="No data"
        detail="The export does not carry shaft segments."
      />
    </div>
  );
}

function HolderTab({ record }: { record: LibraryToolRecord }) {
  const holders = toolsForLibrary(record.libraryId).filter(
    (tool) => tool.type === "holder",
  );
  const holder = record.holder;

  return (
    <div className="te-split">
      <PickerColumn items={holders} />

      <div className="te-split__main">
        <Card title="Info">
          <Field label="Description">
            <input className="te-input" readOnly value="" />
          </Field>
          <Field label="Product ID">
            <input className="te-input" readOnly value="" />
          </Field>
          <Field label="Product link">
            <input className="te-input" readOnly value="" />
          </Field>
          <Field label="Vendor">
            <input className="te-input" readOnly value="" />
          </Field>
          <Field label="Gauge length">
            <input
              className="te-input"
              readOnly
              value={
                holder !== null && typeof holder.OAL === "number"
                  ? `${holder.OAL} mm`
                  : "—"
              }
            />
          </Field>
        </Card>

        <div className="te-actions">
          <button type="button" className="te-btn te-btn--quiet" disabled>
            Select holder
          </button>
          <button type="button" className="te-btn">
            Extract holder
          </button>
          <button type="button" className="te-btn">
            Remove holder
          </button>
        </div>

        {holder === null ? (
          <p className="te-note">This record carries no holder.</p>
        ) : (
          <Card title="Holder geometry">
            {Object.entries(holder).map(([key, value]) => (
              <Field key={key} label={geometryLabel(key)}>
                <input className="te-input" readOnly value={String(value)} />
              </Field>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function ToolBlockTab({ record }: { record: LibraryToolRecord }) {
  const block = record.block;

  return (
    <div className="te-split">
      <BlockColumn />

      <div className="te-split__main">
        <p className="te-banner">
          <span className="te-banner__icon" aria-hidden="true">
            i
          </span>
          Assign a tool block to mount your milling tool to a turn-mill machine
        </p>

        <Card title="Info">
          <Field label="Description">
            <input className="te-input" readOnly value={block?.description ?? ""} />
          </Field>
          <Field label="Product ID">
            <input className="te-input" readOnly value={block?.productId ?? ""} />
          </Field>
          <Field label="Product link">
            <input className="te-input" readOnly value="" />
          </Field>
          <Field label="Vendor">
            <input className="te-input" readOnly value={block?.vendor ?? ""} />
          </Field>
        </Card>

        <div className="te-actions">
          <button type="button" className="te-btn te-btn--quiet" disabled>
            Select tool block
          </button>
          <button type="button" className="te-btn">
            Extract tool block
          </button>
          <button type="button" className="te-btn">
            Remove tool block
          </button>
        </div>

        {block !== null && (
          <Card title="Block settings">
            {Object.entries(block.geometry).map(([key, value]) => (
              <Field key={key} label={geometryLabel(key)}>
                <input className="te-input" readOnly value={String(value)} />
              </Field>
            ))}
            <Field label="Turret station">
              <input
                className="te-input"
                readOnly
                value={block.postProcess.stationNumber ?? "—"}
              />
            </Field>
            <Field label="Half index">
              <input
                className="te-input"
                readOnly
                value={block.postProcess.halfIndex === true ? "Yes" : "No"}
              />
            </Field>
          </Card>
        )}
      </div>
    </div>
  );
}

function CuttingDataTab({ unit }: { unit: string }) {
  const length = unit === "inches" ? "in" : "mm";

  return (
    <div className="te-split">
      <div className="te-split__aside">
        <div className="te-table-toolbar">
          <IconButton label="New preset" glyph="plus" />
          <IconButton label="Edit preset" glyph="pencil" />
          <IconButton label="Delete preset" glyph="trash" />
        </div>
        <ul className="te-list">
          <li className="te-list__group">Cutting data</li>
          <li className="te-list__item te-list__item--selected">Default Preset</li>
        </ul>
        <p className="te-note te-note--aside">
          Presets are not carried by the export, so this shows Fusion's defaults.
        </p>
      </div>

      <div className="te-split__main">
        <Card title="Stock material association">
          <button type="button" className="te-btn">
            Edit stock material association
          </button>
        </Card>

        <Card title="Strategy association">
          <button type="button" className="te-btn">
            Edit strategy association
          </button>
        </Card>

        <Card title="Speed">
          <Field label="Spindle speed">
            <input className="te-input" readOnly value="1000 rpm" />
          </Field>
          <Field label="Surface speed">
            <input className="te-input" readOnly value="21.99115 m/min" />
          </Field>
        </Card>

        <Card title="Vertical feedrates">
          <Field label="Use feed per revolution">
            <input type="checkbox" readOnly checked={false} />
          </Field>
          <Field label="Plunge feedrate">
            <input className="te-input" readOnly value={`100 ${length}/min`} />
          </Field>
          <Field label="Plunge feed per revolution">
            <input className="te-input" readOnly value={`0.1 ${length}`} />
          </Field>
          <Field label="Retract feedrate">
            <input className="te-input" readOnly value={`1000 ${length}/min`} />
          </Field>
          <Field label="Retract feedrate per revolution">
            <input className="te-input" readOnly value={`1 ${length}`} />
          </Field>
          <Field label="Coolant">
            <input className="te-input" readOnly value="Flood" />
          </Field>
        </Card>
      </div>
    </div>
  );
}

function PostProcessorTab({
  post,
  onPatch,
}: {
  post: ToolPostProcessEdit;
  onPatch: (part: Partial<ToolPostProcessEdit>) => void;
}) {
  return (
    <>
      <Card>
        <Field label="Number">
          <NumberInput
            value={post.number}
            onChange={(value) => onPatch({ number: value })}
          />
        </Field>
        <Field label="Length offset">
          <NumberInput
            value={post.lengthOffset}
            onChange={(value) => onPatch({ lengthOffset: value })}
          />
        </Field>
        <Field label="Diameter offset">
          <NumberInput
            value={post.diameterOffset}
            onChange={(value) => onPatch({ diameterOffset: value })}
          />
        </Field>
        <Field label="Turret">
          <NumberInput
            value={post.turret}
            onChange={(value) => onPatch({ turret: value })}
          />
        </Field>
        <Field label="Comment">
          <input
            className="te-input"
            value={post.comment}
            onChange={(e) => onPatch({ comment: e.target.value })}
          />
        </Field>
        <Field label="Manual tool change">
          <input
            type="checkbox"
            checked={post.manualToolChange}
            onChange={(e) => onPatch({ manualToolChange: e.target.checked })}
          />
        </Field>
        <Field label="Live tool">
          <input
            type="checkbox"
            checked={post.liveTool}
            onChange={(e) => onPatch({ liveTool: e.target.checked })}
          />
        </Field>
        <Field label="Break control">
          <input
            type="checkbox"
            checked={post.breakControl}
            onChange={(e) => onPatch({ breakControl: e.target.checked })}
          />
        </Field>
      </Card>

      <Card title="Turret">
        <Field label="Station number">
          <NumberInput
            value={post.stationNumber}
            placeholder="Not set"
            onChange={(value) => onPatch({ stationNumber: value })}
          />
        </Field>
        <Field label="Half index">
          <input
            type="checkbox"
            checked={post.halfIndex === true}
            onChange={(e) => onPatch({ halfIndex: e.target.checked })}
          />
        </Field>
      </Card>
    </>
  );
}

function PickerColumn({ items }: { items: LibraryToolRecord[] }) {
  return (
    <div className="te-split__aside">
      <input className="te-input te-search" placeholder="Search" readOnly />
      <ul className="te-list">
        {items.length === 0 ? (
          <li className="te-list__empty">No holders in this library.</li>
        ) : (
          items.slice(0, 40).map((item) => (
            <li key={item.id} className="te-list__item">
              <span className="te-list__thumb" aria-hidden="true" />
              {displayName(item)}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function BlockColumn() {
  const groups = blocksByLibrary();

  return (
    <div className="te-split__aside">
      <input className="te-input te-search" placeholder="Search" readOnly />
      <ul className="te-list">
        {groups.map(([libraryName, blocks]) => (
          <li key={libraryName}>
            <span className="te-list__group">{libraryName}</span>
            <ul className="te-list">
              {blocks.map((block) => (
                <li key={block.id} className="te-list__item">
                  <span className="te-list__thumb" aria-hidden="true" />
                  {displayName(block)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tool blocks grouped by the library that holds them, as Fusion lists them. */
function blocksByLibrary(): [string, LibraryToolRecord[]][] {
  return LIBRARIES.map(
    (library) =>
      [
        library.name,
        toolsForLibrary(library.id).filter((tool) => isBlockType(tool.type)),
      ] as [string, LibraryToolRecord[]],
  ).filter(([, blocks]) => blocks.length > 0);
}

function IconButton({
  label,
  glyph,
}: {
  label: string;
  glyph: "plus" | "pencil" | "trash";
}) {
  return (
    <button type="button" className="te-icon-btn" aria-label={label} title={label}>
      <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
        {glyph === "plus" && (
          <path fill="none" stroke="currentColor" strokeWidth="1.6" d="M8 3.5v9M3.5 8h9" />
        )}
        {glyph === "pencil" && (
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            d="M11 2l3 3-8 8H3v-3l8-8z"
          />
        )}
        {glyph === "trash" && (
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            d="M3.5 4.5h9M6 4.5V3h4v1.5M5 4.5l.6 8.5h4.8L11 4.5"
          />
        )}
      </svg>
    </button>
  );
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="te-card">
      {title !== undefined && <h3 className="te-card__title">{title}</h3>}
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="te-field">
      <span className="te-field__label">{label}</span>
      <span className="te-field__control">{children}</span>
    </label>
  );
}

function NumberInput({
  value,
  suffix,
  placeholder,
  onChange,
}: {
  value: number | null;
  suffix?: string;
  placeholder?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <span className="te-number">
      <input
        className="te-input"
        type="number"
        step="any"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const next = Number(raw);
          if (!Number.isNaN(next)) onChange(next);
        }}
      />
      {suffix !== undefined && suffix !== "" && (
        <span className="te-number__suffix">{suffix}</span>
      )}
    </span>
  );
}

function numberOrNull(value: number | string | boolean | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function EmptyState({ caption, detail }: { caption: string; detail: string }) {
  return (
    <div className="te-empty-state">
      <svg width="72" height="60" viewBox="0 0 72 60" aria-hidden="true">
        <rect x="10" y="14" width="52" height="34" rx="2" fill="#e6ecf2" />
        <rect x="10" y="28" width="52" height="20" rx="2" fill="#cfd8e2" />
        <rect x="26" y="34" width="20" height="4" rx="2" fill="#9aa8b8" />
      </svg>
      <p className="te-empty-state__caption">{caption}</p>
      <p className="te-note">{detail}</p>
    </div>
  );
}
