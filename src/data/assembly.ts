/**
 * The assembly model: a tool block with N positions, each a view over one real
 * library tool.
 *
 * Fusion stores neither a seat index nor any block-owns-slots record, so the
 * positions and their ordinals live here and are never written back. What a
 * position does own that Fusion can store is a turret station, which is why
 * reordering rows is a real edit rather than cosmetic.
 */

import {
  blockCapacity,
  isAdaptiveRecord,
  isColletRecord,
  isHalfIndex,
  stationNumber,
  toolById,
  type DerivedBlock,
  type LibraryToolRecord,
} from "./realLibrary";
import type {
  AssemblyConfig,
  AssemblyRow,
  AssemblySlot,
  SlotLevel,
  ValidationIssue,
  ValidationStatus,
} from "../types";

export function emptySlot(): AssemblySlot {
  return { stack: [], stationNumber: null, halfIndex: false };
}

/** True once a position holds anything at all. */
export function slotIsOccupied(slot: AssemblySlot): boolean {
  return slot.stack.length > 0;
}

/** What a component is, as far as a position is concerned. */
export function slotKind(record: LibraryToolRecord): SlotLevel {
  if (!isAdaptiveRecord(record)) return "tool";
  return isColletRecord(record) ? "collet" : "extension";
}

/**
 * What a position can take next, given what it already holds.
 *
 * An empty position takes a cutting tool as readily as an extension: the
 * adaptive items are there to make a tool fit, not to be mounted for their
 * own sake. An extension can then take another extension, a collet or a tool
 * — stacking extensions is common when a tool needs more reach than any one
 * extension gives. A collet takes the tool it grips, and a cutting tool ends
 * the stack, since nothing mounts on the far side of the part that cuts.
 */
export function slotAccepts(kinds: SlotLevel[]): SlotLevel[] {
  const top = kinds[kinds.length - 1];
  if (top === undefined) return ["extension", "tool"];
  if (top === "extension") return ["extension", "collet", "tool"];
  if (top === "collet") return ["tool"];
  return [];
}

/** True once a position is finished: it holds a cutting tool at the end. */
export function slotIsComplete(kinds: SlotLevel[]): boolean {
  return kinds[kinds.length - 1] === "tool";
}

/**
 * What a stack of library ids holds, in order.
 *
 * An id the library cannot resolve counts as a cutting tool, which ends the
 * stack: better to stop there than to let an unknown carry more parts.
 */
export function slotKinds(ids: string[]): SlotLevel[] {
  return ids.map((id) => {
    const record = toolById(id);
    return record === undefined ? "tool" : slotKind(record);
  });
}

/** The longest run of `rest` the rules allow on top of what is already there. */
function keepValid(base: SlotLevel[], rest: SlotLevel[]): number {
  const kinds = [...base];
  let kept = 0;

  for (const kind of rest) {
    if (!slotAccepts(kinds).includes(kind)) break;
    kinds.push(kind);
    kept += 1;
  }

  return kept;
}

/**
 * Grow or truncate the positions to the block's declared tool count.
 *
 * Truncation drops from the end, so raising the count again reopens empty rows
 * rather than restoring what was there.
 */
export function syncSlotCount(slots: AssemblySlot[], count: number): AssemblySlot[] {
  const wanted = Math.max(1, Math.trunc(count));
  if (slots.length === wanted) return slots;
  if (slots.length > wanted) return slots.slice(0, wanted);
  return [
    ...slots,
    ...Array.from({ length: wanted - slots.length }, () => emptySlot()),
  ];
}

/**
 * Move the stack at `index` by `delta` rows.
 *
 * The whole stack travels together, since an extension, its collet and its tool
 * are one assembly. Stations belong to the position rather than to the stack, so
 * each stack takes over the station of the row it lands on.
 */
export function moveSlot(
  slots: AssemblySlot[],
  index: number,
  delta: number,
): AssemblySlot[] {
  const target = index + delta;
  if (index < 0 || index >= slots.length) return slots;
  if (target < 0 || target >= slots.length) return slots;

  const next = [...slots];
  next[index] = { ...slots[index], stack: slots[target].stack };
  next[target] = { ...slots[target], stack: slots[index].stack };
  return next;
}

/**
 * Swap two neighbouring components within one position's stack.
 *
 * The move only lands if the resulting stack still passes ``slotAccepts`` end
 * to end — swapping a collet above an extension would strand it, so the
 * caller sees the original slots back and can leave the button disabled. The
 * position's station-carrying occupant may change, so the station is
 * recomputed off the new first component.
 */
export function swapStackItems(
  slots: AssemblySlot[],
  index: number,
  depth: number,
  delta: number,
): AssemblySlot[] {
  if (delta !== 1 && delta !== -1) return slots;
  if (index < 0 || index >= slots.length) return slots;

  const slot = slots[index];
  const targetDepth = depth + delta;
  if (depth < 0 || depth >= slot.stack.length) return slots;
  if (targetDepth < 0 || targetDepth >= slot.stack.length) return slots;

  const stack = [...slot.stack];
  [stack[depth], stack[targetDepth]] = [stack[targetDepth], stack[depth]];

  // Reject the swap if the reordered stack no longer satisfies the rules.
  const kinds = slotKinds(stack);
  if (keepValid([], kinds) !== kinds.length) return slots;

  const firstOccupant =
    stack.length > 0 ? toolById(stack[0]) ?? null : null;

  const next = [...slots];
  next[index] = {
    ...slot,
    stack,
    stationNumber:
      firstOccupant === null ? slot.stationNumber : stationNumber(firstOccupant),
    halfIndex: firstOccupant === null ? slot.halfIndex : isHalfIndex(firstOccupant),
  };
  return next;
}

/**
 * Put a component at one step of a position, or clear that step.
 *
 * Clearing takes everything the component was holding with it, since a collet
 * and a tool have nothing to mount in once what carried them is gone. Replacing
 * keeps whatever still fits: swapping one extension for another leaves its
 * collet and tool in place, while swapping it for a drill drops them, because
 * nothing mounts past a cutting tool.
 *
 * The station comes off the first component in the stack, since that is what
 * occupies the position and so what carries the position's post-process fields.
 */
export function setSlotComponent(
  slots: AssemblySlot[],
  index: number,
  depth: number,
  tool: LibraryToolRecord | null,
): AssemblySlot[] {
  if (index < 0 || index >= slots.length) return slots;

  const slot = slots[index];
  if (depth < 0 || depth > slot.stack.length) return slots;

  const before = slot.stack.slice(0, depth);
  let stack: string[];

  if (tool === null) {
    stack = before;
  } else {
    const rest = slot.stack.slice(depth + 1);
    // Only keep what still fits under the replacement.
    const kept = keepValid([...slotKinds(before), slotKind(tool)], slotKinds(rest));
    stack = [...before, tool.id, ...rest.slice(0, kept)];
  }

  const occupant = depth === 0 ? tool : null;
  const next = [...slots];
  next[index] = {
    ...slot,
    stack,
    // A position's station follows whatever occupies it.
    stationNumber:
      depth !== 0
        ? slot.stationNumber
        : occupant === null
          ? null
          : stationNumber(occupant),
    halfIndex:
      depth !== 0 ? slot.halfIndex : occupant !== null && isHalfIndex(occupant),
  };
  return next;
}

/**
 * Insert a component into a position at ``depth``, shifting the rest down.
 *
 * Whatever sat at ``depth`` and below is walked through the accept rules under
 * the new component; anything that no longer fits is dropped. Passing a depth
 * past the end appends, which is the same as filling the open row that would
 * be showing there.
 */
export function insertSlotComponent(
  slots: AssemblySlot[],
  index: number,
  depth: number,
  tool: LibraryToolRecord,
): AssemblySlot[] {
  if (index < 0 || index >= slots.length) return slots;

  const slot = slots[index];
  const at = Math.max(0, Math.min(depth, slot.stack.length));
  const before = slot.stack.slice(0, at);
  const after = slot.stack.slice(at);

  // The new component only sits here if what came before it accepts its kind;
  // otherwise nothing sensible happens and the stack is left as it was.
  if (!slotAccepts(slotKinds(before)).includes(slotKind(tool))) return slots;

  const kept = keepValid(
    [...slotKinds(before), slotKind(tool)],
    slotKinds(after),
  );
  const stack = [...before, tool.id, ...after.slice(0, kept)];

  const next = [...slots];
  next[index] = {
    ...slot,
    stack,
    stationNumber:
      at === 0
        ? stationNumber(tool)
        : slot.stationNumber,
    halfIndex: at === 0 ? isHalfIndex(tool) : slot.halfIndex,
  };
  return next;
}

/** Drop a position entirely. One row always remains, as there is no empty block. */
export function removeSlot(slots: AssemblySlot[], index: number): AssemblySlot[] {
  if (slots.length <= 1 || index < 0 || index >= slots.length) return slots;
  return slots.filter((_, i) => i !== index);
}

/** Station a position assigns: its occupant's own, or else its row order. */
export function slotStation(slot: AssemblySlot, index: number): number {
  return slot.stationNumber ?? index;
}

export interface ValidationInput {
  rows: AssemblyRow[];
  slots: AssemblySlot[];
  /** Parent blocks the occupants imply; more than one is a conflict. */
  blocks: DerivedBlock[];
  config: AssemblyConfig;
  measuredMm: number | null;
}

/**
 * Validation against what Fusion actually requires: a component is only usable
 * once its solid carries both joint frames, a chain with a gap in it cannot be
 * measured at all, and every occupant of one block has to agree about which
 * block that is and which station it sits in.
 */
export function runValidation({
  rows,
  slots,
  blocks,
  config,
  measuredMm,
}: ValidationInput): { status: ValidationStatus; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  const block = rows.find((row) => row.role === "block");
  // Positions, not rows: one position shows a row per component it holds.
  const occupied = slots.filter(slotIsOccupied);

  if (occupied.length === 0) {
    return {
      status: "fail",
      issues: [
        {
          id: "no-tool",
          severity: "error",
          message:
            "Nothing mounted on the block — a position takes a cutting tool, " +
            "or an extension to hold one.",
        },
      ],
    };
  }

  if (block === undefined || block.toolId === null) {
    issues.push({
      id: "no-block",
      severity: "warning",
      message: "No tool block chosen, so the assembly has no machine-side root.",
    });
  }

  if (blocks.length > 1) {
    const names = blocks
      .map((entry) => entry.block.description || entry.block.guid)
      .join(", ");
    issues.push({
      id: "conflicting-blocks",
      severity: "error",
      message:
        `The selected tools reference ${blocks.length} different tool blocks ` +
        `(${names}). An assembly can only use one.`,
    });
  }

  // Capacity is the block's own declaration, not the row count the UI is showing,
  // so overfilling a real block is reported rather than quietly allowed.
  const capacity = blocks.length === 1
    ? blockCapacity(blocks[0].block) ?? config.numberOfTools
    : config.numberOfTools;
  if (occupied.length > capacity) {
    issues.push({
      id: "capacity-overflow",
      severity: "error",
      message:
        `The tool block holds ${capacity} tool(s) but ${occupied.length} are assigned.`,
    });
  }

  // An adaptive item on its own is a position that was started and not finished.
  slots.forEach((slot, index) => {
    if (!slotIsOccupied(slot)) return;
    if (slotIsComplete(slotKinds(slot.stack))) return;
    issues.push({
      id: `incomplete-slot-${index}`,
      severity: "warning",
      message:
        `Slot ${index + 1} holds no cutting tool yet — an extension or collet ` +
        "is there to hold one.",
    });
  });

  const byStation = new Map<number, number>();
  slots.forEach((slot, index) => {
    if (!slotIsOccupied(slot)) return;
    const station = slotStation(slot, index);
    byStation.set(station, (byStation.get(station) ?? 0) + 1);
  });
  for (const [station, count] of byStation) {
    if (count > 1) {
      issues.push({
        id: `duplicate-station-${station}`,
        severity: "error",
        message: `Station ${station} is used by more than one tool.`,
      });
    }
  }

  for (const row of rows) {
    if (row.toolId === null || row.missingFrame === null) continue;
    if (row.missingFrame === "geometry") {
      issues.push({
        id: `no-geometry-${row.id}`,
        severity: "error",
        message: `${row.name} has no 3D solid, so it carries no joint frames.`,
        toolId: row.toolId,
      });
      continue;
    }
    issues.push({
      id: `missing-frame-${row.id}`,
      severity: "error",
      message:
        `${row.name} is missing its ${row.missingFrame} frame. ` +
        "Joint frames come from the STEP file, so add it in CAD and re-import.",
      toolId: row.toolId,
    });
  }

  if (measuredMm === null && issues.every((issue) => issue.severity !== "error")) {
    issues.push({
      id: "not-measurable",
      severity: "warning",
      message: "Stack-up cannot be measured through this chain.",
    });
  }

  const overridden = rows.find((row) => row.hasTransformOverride);
  if (overridden !== undefined) {
    issues.push({
      id: "transform-override",
      severity: "warning",
      message:
        `${overridden.name} is positioned manually by transformOverride, ` +
        "which overrides the joint chain.",
      toolId: overridden.toolId ?? undefined,
    });
  }

  if (config.machineSideConnectionType === "Unspecified") {
    issues.push({
      id: "connection-unspecified",
      severity: "warning",
      message: "Machine-side connection type is unspecified — verify the turret interface.",
    });
  }

  if (issues.some((issue) => issue.severity === "error")) {
    return { status: "fail", issues };
  }
  if (issues.length > 0) {
    return { status: "warning", issues };
  }
  return { status: "pass", issues: [] };
}
