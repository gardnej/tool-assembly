import { useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { displayName, type LibraryRef, type LibraryToolRecord } from "../data/realLibrary";
import type { AssemblyRow, RowId, SlotLevel } from "../types";
import { ContextMenu } from "./ContextMenu";
import type { ContextMenuItem } from "./ContextMenu";

interface AssemblyGridProps {
  /** Parent block row first, then one row per position under it. */
  rows: AssemblyRow[];
  selectedId: RowId | null;
  /**
   * Library scoping is derived from the chosen block rather than picked, so
   * nothing below renders these three. They stay on the interface because a
   * library selector row is a plausible thing to want back.
   */
  libraries: LibraryRef[];
  libraryId: string;
  availableBlocks: LibraryToolRecord[];
  availableTools: LibraryToolRecord[];
  /** Candidates per kind, so a row can offer everything that fits it. */
  availableByLevel: Record<SlotLevel, LibraryToolRecord[]>;
  onSelectRow: (id: RowId) => void;
  onSelectLibrary: (libraryId: string) => void;
  onSelectToolBlock: (toolId: string | null) => void;
  onSelectSlotTool: (index: number, depth: number, toolId: string | null) => void;
  /**
   * Reorder two neighbouring components inside one position's stack. The
   * handler refuses the swap if it would violate the acceptance rules, so
   * arrows on those combinations appear disabled.
   */
  onSwapStackItem: (index: number, depth: number, delta: number) => void;
  onRemoveSlot: (index: number) => void;
  onBrowseLibrary: (id: RowId, mode?: "replace" | "insertAbove" | "insertBelow") => void;
}

const LEVEL_NOUN: Record<SlotLevel, string> = {
  extension: "extension",
  collet: "collet",
  tool: "tool",
};

const LEVEL_GROUP: Record<SlotLevel, string> = {
  extension: "Extensions",
  collet: "Collets",
  tool: "Cutting tools",
};

/** "extension or tool", so a row can say what it takes in plain words. */
function acceptsText(accepts: SlotLevel[]): string {
  return accepts.map((kind) => LEVEL_NOUN[kind]).join(" or ");
}

/** Sentinel option: hands off to the Tool Library picker instead of choosing a tool. */
const BROWSE_LIBRARY_VALUE = "__browse-tool-library__";

/**
 * A position's reach past the block face.
 *
 * Fusion's mill-drill libraries carry each part's own gauge length —
 * ``assemblyGaugeLength`` on a tool, top-level ``gaugeLength`` on an extension
 * or collet — and the position's total is the sum of them, since a component
 * packs the one above it out by its own length. Positions built out of turning
 * records rely on their joint-frame chain instead and only carry one gauge per
 * row, in which case the sum reduces to that number.
 */
function slotTotalGauge(rows: AssemblyRow[], index: number): number | null {
  const gauges = rows
    .filter((row) => row.slotIndex === index && row.gaugeLengthMm !== null)
    .map((row) => row.gaugeLengthMm as number);
  return gauges.length === 0
    ? null
    : gauges.reduce((total, value) => total + value, 0);
}

/** Stands for whatever the row already holds, so the select has something to show. */
const CURRENT_VALUE = "__current__";

interface MenuState {
  x: number;
  y: number;
  id: RowId;
}

export function AssemblyGrid({
  rows,
  selectedId,
  availableByLevel,
  onSelectRow,
  onSelectToolBlock,
  onSelectSlotTool,
  onSwapStackItem,
  onRemoveSlot,
  onBrowseLibrary,
}: AssemblyGridProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [expanded, setExpanded] = useState(true);

  const blockRow = rows.find((row) => row.role === "block");
  const slotRows = rows.filter((row) => row.slotIndex !== null);
  const selectedSlot = slotRows.find((row) => row.id === selectedId);

  const openMenu = (event: MouseEvent, id: RowId) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectRow(id);
    setMenu({ x: event.clientX, y: event.clientY, id });
  };

  const menuItems = (id: RowId): ContextMenuItem[] => {
    const row = rows.find((item) => item.id === id);
    const index = row?.slotIndex ?? null;
    const depth = row?.depth ?? null;

    const items: ContextMenuItem[] = [
      {
        id: "browse",
        label: "Select from Tool Library…",
        onSelect: () => onBrowseLibrary(id),
      },
    ];

    // Insert options only make sense on a filled position row, since inserting
    // above nothing is the same as filling the open row that is already there.
    // Each is greyed out when the acceptance rules leave no component that
    // could actually go there — nothing mounts below a cutting tool, say.
    if (index !== null && depth !== null && row !== undefined && row.toolId !== null) {
      items.push(
        {
          id: "insert-above",
          label: "Insert component above…",
          separatorBefore: true,
          disabled: !row.canInsertAbove,
          onSelect: () => onBrowseLibrary(id, "insertAbove"),
        },
        {
          id: "insert-below",
          label: "Insert component below…",
          disabled: !row.canInsertBelow,
          onSelect: () => onBrowseLibrary(id, "insertBelow"),
        },
      );
    }

    if (index !== null && depth === 0 && row?.toolId !== null) {
      items.push({
        id: "clear-position",
        label: "Clear this position",
        separatorBefore: true,
        onSelect: () => onRemoveSlot(index),
      });
    }

    items.push({
      id: "clear",
      label: index === null ? "Clear tool block" : "Remove this component",
      separatorBefore: index === null || depth !== 0 || row?.toolId === null,
      disabled: row?.toolId === null,
      onSelect: () =>
        index === null || depth === null
          ? onSelectToolBlock(null)
          : onSelectSlotTool(index, depth, null),
    });

    return items;
  };

  const positionCount = slotRows.filter((row) => row.depth === 0).length;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-weave-text">Positions</h3>
        {/* The count is read off the tool block, not entered by the user. */}
        <span className="text-[11px] text-weave-text-placeholder">
          {positionCount} {positionCount === 1 ? "position" : "positions"} on this
          tool block
        </span>
      </div>
      <div className="overflow-hidden rounded-[2px] border border-weave-divider bg-weave-input/40">
        <div className="grid grid-cols-[minmax(180px,1.6fr)_minmax(90px,0.8fr)_minmax(110px,0.9fr)]">
          <GridHeader>Name</GridHeader>
          <GridHeader>Type</GridHeader>
          <GridHeader title="How far each tool reaches past the tool block's face. The total below is measured from the turret face instead, so it includes the block.">
            Gauge length
          </GridHeader>

          <BlockRow
            row={blockRow}
            selected={selectedId === "block"}
            expanded={expanded}
            onToggle={() => setExpanded((open) => !open)}
            onSelectRow={onSelectRow}
            onBrowse={() => onBrowseLibrary("block")}
            onContextMenu={openMenu}
          />

          {expanded &&
            slotRows.map((row, index) => {
              const rendered = (
                <SlotRow
                  key={row.id}
                  row={row}
                  availableByLevel={availableByLevel}
                  selected={selectedId === row.id}
                  onSelectRow={onSelectRow}
                  onChoose={onSelectSlotTool}
                  onBrowse={() => onBrowseLibrary(row.id)}
                  onContextMenu={openMenu}
                />
              );
              // The last row of a position is followed by a summary line so its
              // reach past the block face reads on its own.
              const next = slotRows[index + 1];
              const lastOfSlot = next === undefined || next.slotIndex !== row.slotIndex;
              if (!lastOfSlot || row.slotIndex === null) return rendered;

              const total = slotTotalGauge(slotRows, row.slotIndex);
              return (
                <span key={`${row.id}-wrap`} className="contents">
                  {rendered}
                  <SlotSummary index={row.slotIndex} totalMm={total} />
                </span>
              );
            })}
        </div>

        {/* Collapsed slots are not editable, since the row being acted on is hidden. */}
        <RowToolbar
          slot={expanded ? selectedSlot : undefined}
          slotStackSize={
            selectedSlot?.slotIndex != null
              ? slotRows.filter((row) => row.slotIndex === selectedSlot.slotIndex && row.toolId !== null).length
              : 0
          }
          onSwapStackItem={onSwapStackItem}
          onClear={onSelectSlotTool}
          onRemove={onRemoveSlot}
        />
      </div>

      {menu !== null && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.id)}
          onClose={() => setMenu(null)}
        />
      )}
    </section>
  );
}

/**
 * The root row of the assembly, and the only place a tool block is chosen.
 *
 * Its dropdown carries one action rather than a list of every block in a library:
 * a block is found by navigating the Tool Library, so the row shows what it holds
 * and offers the browser as the way to change it.
 */
function BlockRow({
  row,
  selected,
  expanded,
  onToggle,
  onSelectRow,
  onBrowse,
  onContextMenu,
}: {
  row: AssemblyRow | undefined;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelectRow: (id: RowId) => void;
  onBrowse: () => void;
  onContextMenu: (event: MouseEvent, id: RowId) => void;
}) {
  const name = row?.name ?? "";
  const chosen = row?.toolId ?? null;

  return (
    <Row
      selected={selected}
      onClick={() => onSelectRow("block")}
      onContextMenu={(event) => onContextMenu(event, "block")}
    >
      <GridCell selected={selected} className="flex items-center gap-1 pl-1">
        <Disclosure expanded={expanded} onToggle={onToggle} />
        <select
          aria-label="Tool block"
          value={CURRENT_VALUE}
          title={name}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            if (event.target.value === BROWSE_LIBRARY_VALUE) onBrowse();
          }}
          className={[
            "h-6 min-w-0 flex-1 border-0 bg-weave-input px-1.5 text-xs outline-none focus:ring-1 focus:ring-weave-focus/40",
            chosen !== null ? "text-weave-text" : "text-weave-text-placeholder",
          ].join(" ")}
        >
          <option value={CURRENT_VALUE}>
            {name !== "" ? name : "Select tool block…"}
          </option>
          <option value={BROWSE_LIBRARY_VALUE}>Select from Tool Library…</option>
        </select>
      </GridCell>

      <GridCell selected={selected} className="truncate" title={row?.type}>
        {row?.type !== undefined && row.type !== "" ? row.type : "—"}
      </GridCell>

      {/* The block is the datum every gauge length is measured from, not something
          mounted on it, so it has none of its own. */}
      <GridCell selected={selected}>—</GridCell>
    </Row>
  );
}

/**
 * One step of one position: what it holds at that depth, or the open row at the
 * end offering whatever can go next, indented to show what holds what.
 *
 * The dropdown lists every kind the step accepts rather than one kind decided in
 * advance, so slot 1 offers extensions and cutting tools together and an
 * extension offers collets and cutting tools together.
 */
function SlotRow({
  row,
  availableByLevel,
  selected,
  onSelectRow,
  onChoose,
  onBrowse,
  onContextMenu,
}: {
  row: AssemblyRow;
  availableByLevel: Record<SlotLevel, LibraryToolRecord[]>;
  selected: boolean;
  onSelectRow: (id: RowId) => void;
  onChoose: (index: number, depth: number, toolId: string | null) => void;
  onBrowse: () => void;
  onContextMenu: (event: MouseEvent, id: RowId) => void;
}) {
  const index = row.slotIndex as number;
  const depth = row.depth as number;
  const chosen = row.toolId;
  const takes = acceptsText(row.accepts);
  // The dropdown itself says what a row is, and indent shows what holds it.
  const placeholder =
    depth === 0 ? `Select ${takes}…` : `Add ${takes}…`;

  return (
    <Row
      selected={selected}
      onClick={() => onSelectRow(row.id)}
      onContextMenu={(event) => onContextMenu(event, row.id)}
    >
      <GridCell
        selected={selected}
        className="flex items-center gap-1"
        style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
      >
        {/* Every position keeps a persistent label, whatever it holds, so the
            row always names the physical position it maps to on the block. */}
        {depth === 0 ? (
          <span className="inline-flex h-5 shrink-0 items-center rounded-[2px] bg-weave-surface-300 px-1.5 text-[10px] font-semibold text-weave-text">
            Position {index + 1}
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="shrink-0 text-[11px] leading-none text-weave-text-placeholder"
          >
            └
          </span>
        )}
        <select
          aria-label={
            depth === 0
              ? `Position ${index + 1}`
              : `Position ${index + 1} step ${depth + 1}`
          }
          title={chosen === null ? `This position takes ${takes} here` : undefined}
          value={chosen ?? ""}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            if (event.target.value === BROWSE_LIBRARY_VALUE) {
              onBrowse();
              return;
            }
            onChoose(index, depth, event.target.value === "" ? null : event.target.value);
          }}
          className={[
            "h-6 min-w-0 flex-1 border-0 bg-weave-input px-1.5 text-xs outline-none focus:ring-1 focus:ring-weave-focus/40",
            chosen !== null ? "text-weave-text" : "text-weave-text-placeholder",
          ].join(" ")}
        >
          <option value="">{placeholder}</option>
          {/* What the row holds may come from another library than the one the
              lists below are scoped to, so it is named here to stay visible. */}
          {chosen !== null &&
            !row.accepts.some((kind) =>
              availableByLevel[kind].some((tool) => tool.id === chosen),
            ) && <option value={chosen}>{row.name}</option>}
          {row.accepts.map((kind) => (
            <optgroup key={kind} label={LEVEL_GROUP[kind]}>
              {availableByLevel[kind].map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {displayName(tool)}
                </option>
              ))}
            </optgroup>
          ))}
          <option disabled>──────────</option>
          <option value={BROWSE_LIBRARY_VALUE}>Select from Tool Library…</option>
        </select>
      </GridCell>

      <GridCell selected={selected} className="truncate" title={row.type}>
        {row.type !== "" ? row.type : "—"}
      </GridCell>

      <GridCell selected={selected} className="tabular-nums">
        {row.gaugeLengthMm != null ? `${row.gaugeLengthMm.toFixed(2)} mm` : "—"}
      </GridCell>
    </Row>
  );
}

/**
 * Row actions for the selected row.
 *
 * Moving and deleting act on the whole position, since a position is what the
 * block holds, while clearing empties only the level that is selected.
 */
function RowToolbar({
  slot,
  slotStackSize,
  onSwapStackItem,
  onClear,
  onRemove,
}: {
  slot: AssemblyRow | undefined;
  /** Number of filled components in the selected position's stack. */
  slotStackSize: number;
  onSwapStackItem: (index: number, depth: number, delta: number) => void;
  onClear: (index: number, depth: number, toolId: string | null) => void;
  onRemove: (index: number) => void;
}) {
  const index = slot?.slotIndex ?? null;
  const depth = slot?.depth ?? null;
  const isFilledStackRow =
    index !== null && depth !== null && slot?.toolId !== null;
  // Arrows reorder components *within* the selected position's own stack. They
  // never move a component between positions, so a tool can't be reassigned to
  // the wrong position by accident.
  const canMoveUp = isFilledStackRow && (depth as number) > 0;
  const canMoveDown = isFilledStackRow && (depth as number) < slotStackSize - 1;

  // The trash icon is context-aware. When the position row itself is selected
  // (the "Position N" row, depth 0) it clears the whole position, leaving it
  // open with nothing in it. When a mounted component deeper in the stack is
  // highlighted it removes just that item, leaving the position in place for a
  // new selection.
  const isPositionRow = index !== null && depth === 0;
  const isComponentItem = isFilledStackRow && (depth as number) > 0;
  const trashLabel = isComponentItem
    ? "Remove selected component"
    : "Clear this position";
  const trashDisabled =
    index === null ||
    (isPositionRow ? slotStackSize === 0 : !isComponentItem);
  const onTrash = () => {
    if (index === null) return;
    if (isComponentItem && depth !== null) onClear(index, depth, null);
    else onRemove(index);
  };

  return (
    <div className="flex items-center gap-1 border-t border-weave-divider bg-weave-surface-300/50 px-2 py-1">
      <IconButton
        label="Move component up within this position"
        glyph="↑"
        disabled={!canMoveUp}
        onClick={() =>
          index !== null && depth !== null && onSwapStackItem(index, depth, -1)
        }
      />
      <IconButton
        label="Move component down within this position"
        glyph="↓"
        disabled={!canMoveDown}
        onClick={() =>
          index !== null && depth !== null && onSwapStackItem(index, depth, 1)
        }
      />
      <IconButton
        label={trashLabel}
        glyph={<TrashIcon />}
        disabled={trashDisabled}
        onClick={onTrash}
      />
      <span className="ml-1 truncate text-[10px] text-weave-text-placeholder">
        {index === null
          ? "Select a position to edit"
          : `Position ${index + 1}${
              slot?.level == null ? "" : ` · ${LEVEL_NOUN[slot.level]}`
            }`}
      </span>
    </div>
  );
}

/** A summary line under the last row of a position, showing its total reach. */
function SlotSummary({
  index,
  totalMm,
}: {
  index: number;
  totalMm: number | null;
}) {
  return (
    <div
      role="row"
      className="col-span-3 grid cursor-default grid-cols-subgrid"
    >
      <div className="border-b border-r border-weave-divider bg-weave-surface-300/40 py-1 pl-6 pr-2 text-right text-[11px] font-semibold text-weave-text-placeholder">
        Position {index + 1} total
      </div>
      <div className="border-b border-r border-weave-divider bg-weave-surface-300/40" />
      <div className="border-b border-weave-divider bg-weave-surface-300/40 px-2 py-1 text-[11px] font-semibold tabular-nums text-weave-text">
        {totalMm !== null ? `${totalMm.toFixed(2)} mm` : "—"}
      </div>
    </div>
  );
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
      className="col-span-3 grid cursor-default grid-cols-subgrid outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-weave-focus"
    >
      {children}
    </div>
  );
}

function GridHeader({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div
      className="border-b border-r border-weave-divider bg-weave-surface-300 px-2 py-1.5 text-xs font-semibold"
      title={title}
    >
      {children}
    </div>
  );
}

function GridCell({
  children,
  selected,
  className = "",
  title,
  style,
}: {
  children?: ReactNode;
  selected?: boolean;
  className?: string;
  title?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      title={title}
      style={style}
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

function Disclosure({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={expanded ? "Collapse positions" : "Expand positions"}
      aria-expanded={expanded}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className="flex h-4 w-4 shrink-0 items-center justify-center text-[9px] text-weave-text"
    >
      <span className={expanded ? "" : "-rotate-90"}>▼</span>
    </button>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2.5 3.5h7l-.6 7H3.1l-.6-7zM4.5 3.5V2h3v1.5M1.5 3.5h9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
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
  glyph: ReactNode;
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
