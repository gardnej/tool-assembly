import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { displayName, type LibraryRef, type LibraryToolRecord } from "../data/realLibrary";
import type { AssemblyRow, ComponentRole } from "../types";
import { ContextMenu } from "./ContextMenu";
import type { ContextMenuItem } from "./ContextMenu";

interface AssemblyGridProps {
  rows: AssemblyRow[];
  selectedId: ComponentRole | null;
  /** Measured through the joint frames; null when the chain has a gap. */
  measuredStackUpMm: number | null;
  libraries: LibraryRef[];
  libraryId: string;
  availableBlocks: LibraryToolRecord[];
  availableTools: LibraryToolRecord[];
  onSelectRow: (id: ComponentRole) => void;
  onSelectLibrary: (libraryId: string) => void;
  onSelectToolBlock: (toolId: string | null) => void;
  onSelectCuttingTool: (toolId: string | null) => void;
  onBrowseLibrary: (role: ComponentRole) => void;
}

/** Sentinel option: hands off to the Tool Library picker instead of choosing a tool. */
const BROWSE_LIBRARY_VALUE = "__browse-tool-library__";

interface MenuState {
  x: number;
  y: number;
  role: ComponentRole;
}

export function AssemblyGrid({
  rows,
  selectedId,
  measuredStackUpMm,
  libraries,
  libraryId,
  availableBlocks,
  availableTools,
  onSelectRow,
  onSelectLibrary,
  onSelectToolBlock,
  onSelectCuttingTool,
  onBrowseLibrary,
}: AssemblyGridProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  const blockRow = rows.find((row) => row.role === "block");
  const holderRow = rows.find((row) => row.role === "holder");

  const openMenu = (event: MouseEvent, role: ComponentRole) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectRow(role);
    setMenu({ x: event.clientX, y: event.clientY, role });
  };

  const menuItems = (role: ComponentRole): ContextMenuItem[] => {
    const row = rows.find((item) => item.role === role);
    const clear = role === "block" ? onSelectToolBlock : onSelectCuttingTool;

    return [
      {
        id: "browse",
        label: "Select from Tool Library…",
        onSelect: () => onBrowseLibrary(role),
      },
      {
        id: "clear",
        label: role === "block" ? "Clear tool block" : "Clear cutting tool",
        separatorBefore: true,
        disabled: row?.toolId === null,
        onSelect: () => clear(null),
      },
    ];
  };

  return (
    <section className="space-y-2">
      <label className="flex items-center gap-2 text-xs">
        <span className="shrink-0 text-weave-text-placeholder">Library</span>
        <select
          value={libraryId}
          onChange={(event) => onSelectLibrary(event.target.value)}
          className="h-6 min-w-0 flex-1 border border-weave-input-border bg-weave-input px-1.5 text-xs outline-none focus:ring-1 focus:ring-weave-focus/40"
        >
          {libraries.map((library) => (
            <option key={library.id} value={library.id}>
              {library.breadcrumb} ({library.toolCount})
            </option>
          ))}
        </select>
      </label>

      <div className="overflow-hidden rounded-[2px] border border-weave-divider bg-weave-input/40">
        <div className="grid grid-cols-[minmax(180px,1.5fr)_minmax(90px,0.8fr)_minmax(96px,0.7fr)_minmax(84px,0.6fr)]">
          <GridHeader>Name</GridHeader>
          <GridHeader>Type</GridHeader>
          <GridHeader>Joint frames</GridHeader>
          <GridHeader>Span</GridHeader>

          <ComponentRow
            row={blockRow}
            role="block"
            placeholder="Select tool block…"
            options={availableBlocks}
            selected={selectedId === "block"}
            onSelectRow={onSelectRow}
            onChoose={onSelectToolBlock}
            onBrowse={() => onBrowseLibrary("block")}
            onContextMenu={openMenu}
          />

          <ComponentRow
            row={holderRow}
            role="holder"
            placeholder="Select cutting tool…"
            options={availableTools}
            selected={selectedId === "holder"}
            onSelectRow={onSelectRow}
            onChoose={onSelectCuttingTool}
            onBrowse={() => onBrowseLibrary("holder")}
            onContextMenu={openMenu}
          />

          <div className="col-span-3 border-r border-weave-divider bg-weave-surface-300/50 px-2 py-1.5 text-right text-xs font-semibold text-weave-text">
            Measured stack-up
          </div>
          <div className="bg-weave-surface-300/50 px-2 py-1.5 text-xs font-semibold text-weave-text">
            {measuredStackUpMm !== null ? `${measuredStackUpMm.toFixed(2)} mm` : "—"}
          </div>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-weave-text-placeholder">
        Order runs machine side to cutting side and is fixed by the joint frames, so
        components cannot be reordered by hand. Stack-up is measured from the MCS and
        CSW frames stored with each solid rather than summed from nominal lengths.
      </p>

      {menu !== null && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.role)}
          onClose={() => setMenu(null)}
        />
      )}
    </section>
  );
}

function ComponentRow({
  row,
  role,
  placeholder,
  options,
  selected,
  onSelectRow,
  onChoose,
  onBrowse,
  onContextMenu,
}: {
  row: AssemblyRow | undefined;
  role: ComponentRole;
  placeholder: string;
  options: LibraryToolRecord[];
  selected: boolean;
  onSelectRow: (id: ComponentRole) => void;
  onChoose: (toolId: string | null) => void;
  onBrowse: () => void;
  onContextMenu: (event: MouseEvent, role: ComponentRole) => void;
}) {
  const chosen = row?.toolId ?? null;
  const isOwnedBlock =
    role === "block" && chosen !== null && !options.some((tool) => tool.id === chosen);

  return (
    <Row
      selected={selected}
      onClick={() => onSelectRow(role)}
      onContextMenu={(event) => onContextMenu(event, role)}
    >
      <GridCell selected={selected} className="flex items-center gap-1 pl-2">
        <RoleIcon role={role} />
        {isOwnedBlock ? (
          // The tool already carries this block inline, so it is not a separate
          // library item that can be picked from a list.
          <span className="min-w-0 flex-1 truncate px-1.5 text-xs" title={row?.name}>
            {row?.name}
          </span>
        ) : (
          <select
            aria-label={role === "block" ? "Tool block" : "Cutting tool"}
            value={chosen ?? ""}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              if (event.target.value === BROWSE_LIBRARY_VALUE) {
                onBrowse();
                return;
              }
              onChoose(event.target.value === "" ? null : event.target.value);
            }}
            className={[
              "h-6 min-w-0 flex-1 border-0 bg-weave-input px-1.5 text-xs outline-none focus:ring-1 focus:ring-weave-focus/40",
              chosen !== null ? "text-weave-text" : "text-weave-text-placeholder",
            ].join(" ")}
          >
            <option value="">{placeholder}</option>
            {options.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {displayName(tool)}
              </option>
            ))}
            <option disabled>──────────</option>
            <option value={BROWSE_LIBRARY_VALUE}>Select from Tool Library…</option>
          </select>
        )}
        <IconButton label="Browse tool library" glyph="···" onClick={onBrowse} />
        <IconButton
          label={role === "block" ? "Clear tool block" : "Clear cutting tool"}
          glyph="×"
          onClick={() => onChoose(null)}
          disabled={chosen === null}
        />
      </GridCell>

      <GridCell selected={selected}>
        <span className="truncate" title={row?.type}>
          {row?.type !== undefined && row.type !== "" ? row.type : "—"}
        </span>
      </GridCell>

      <GridCell selected={selected}>
        <JointStatus row={row} />
      </GridCell>

      <GridCell selected={selected}>
        {row?.spanMm != null ? `${row.spanMm.toFixed(2)} mm` : "—"}
      </GridCell>
    </Row>
  );
}

/**
 * Joint readiness for one component. Fusion imports these frames from the STEP
 * file, so a gap here is what stops an assembly coming together.
 */
function JointStatus({ row }: { row: AssemblyRow | undefined }) {
  if (row === undefined || row.toolId === null) {
    return <span className="text-weave-text-placeholder">—</span>;
  }

  if (row.missingFrame === null) {
    return (
      <span className="inline-flex items-center gap-1 text-weave-success" title="MCS and CSW frames present">
        <Dot className="bg-weave-success" />
        MCS + CSW
      </span>
    );
  }

  const label =
    row.missingFrame === "geometry" ? "No solid" : `No ${row.missingFrame}`;

  return (
    <span
      className="inline-flex items-center gap-1 text-weave-warning"
      title="Joint frames are authored in the STEP file, not through the API"
    >
      <Dot className="bg-weave-warning" />
      {label}
    </span>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${className}`} />;
}

function Row({
  children,
  selected,
  onClick,
  onContextMenu,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  onContextMenu: (event: MouseEvent) => void;
}) {
  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={selected}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className="col-span-4 grid cursor-default grid-cols-subgrid outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-weave-focus"
    >
      {children}
    </div>
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
        "min-w-0 border-b border-r border-weave-divider px-2 py-1.5 text-xs",
        selected === true ? "bg-weave-selected" : "bg-weave-dialog/60",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/** Block sits on the machine side, holder on the cutting side. */
function RoleIcon({ role }: { role: ComponentRole }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      className="shrink-0 text-weave-focus"
    >
      {role === "block" ? (
        <>
          <rect x="2" y="3" width="10" height="8" fill="currentColor" opacity="0.2" />
          <rect
            x="2"
            y="3"
            width="10"
            height="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </>
      ) : (
        <>
          <path d="M2 2h5l5 5-5 5H2V2z" fill="currentColor" opacity="0.2" />
          <path d="M2 2h5l5 5-5 5H2V2z" fill="none" stroke="currentColor" strokeWidth="1" />
        </>
      )}
    </svg>
  );
}

function IconButton({
  label,
  glyph,
  onClick,
  disabled = false,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex h-6 w-6 shrink-0 items-center justify-center border border-weave-input-border text-[11px] text-weave-text-placeholder hover:bg-weave-surface-250 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {glyph}
    </button>
  );
}
