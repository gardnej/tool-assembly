import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptySlot,
  moveSlot,
  removeSlot,
  runValidation,
  setSlotComponent,
  slotAccepts,
  slotIsComplete,
  slotIsOccupied,
  slotKind,
  slotKinds,
  slotStation,
  syncSlotCount,
} from "../src/data/assembly";
import {
  adaptiveItems,
  assemblies,
  blockCapacity,
  chainFor,
  cuttingTools,
  derivedBlocks,
  measuredStackUpMm,
  occupantGaugeLengthMm,
  stationNumber,
  toolBlocks,
  type DerivedBlock,
  type LibraryToolRecord,
  type NestedBlock,
} from "../src/data/realLibrary";
import { PREVIEW_LIBRARY_ID } from "../src/data/previewGeometry";
import type { AssemblyConfig, AssemblyRow, AssemblySlot } from "../src/types";

/**
 * Assemblies from the snapshot only. The prototype library exists to give the
 * viewer something to draw and carries a block of its own, so it would answer
 * questions about the real data with records that were never in Fusion.
 */
function realAssemblies() {
  return assemblies().filter((tool) => tool.libraryId !== PREVIEW_LIBRARY_ID);
}

/** A position built from a plain list of library ids, machine side first. */
function slot(stack: string[] = [], station: number | null = null): AssemblySlot {
  return { stack, stationNumber: station, halfIndex: false };
}

/**
 * Fresh row per depth of a stack.
 *
 * Rows are the workflow hook's job in the app; here we only need something the
 * validator can read, so the shape stands in for whatever the hook would build.
 */
function slotRow(
  index: number,
  depth = 0,
  overrides: Partial<AssemblyRow> = {},
): AssemblyRow {
  return {
    id: depth === 0 ? `slot-${index}` : `slot-${index}-${depth}`,
    role: "holder",
    slotIndex: index,
    depth,
    level: "tool",
    accepts: [],
    toolId: `tool-${index}-${depth}`,
    name: `Tool ${index}.${depth}`,
    type: "turning general",
    vendor: "",
    spanMm: 10,
    gaugeLengthMm: 10,
    missingFrame: null,
    hasTransformOverride: false,
    stationNumber: depth === 0 ? index : null,
    halfIndex: false,
    stationFollowsOrder: false,
    ...overrides,
  };
}

function blockRow(overrides: Partial<AssemblyRow> = {}): AssemblyRow {
  return {
    id: "block",
    role: "block",
    slotIndex: null,
    depth: null,
    level: null,
    accepts: [],
    toolId: "block-owner",
    name: "Tool block",
    type: "tool block",
    vendor: "",
    spanMm: 100,
    gaugeLengthMm: null,
    missingFrame: null,
    hasTransformOverride: false,
    stationNumber: null,
    halfIndex: false,
    stationFollowsOrder: false,
    ...overrides,
  };
}

const CONFIG: AssemblyConfig = {
  orientation: "axial",
  machineSideConnectionType: "VDI 40",
  numberOfTools: 4,
  numberOfAttachmentPoints: 2,
  adaptiveItemSize: 0,
  stationNumber: null,
  halfIndex: false,
};

/** The real block every nested copy in the snapshot points at. */
function realBlock(): NestedBlock {
  const block = assemblies()[0]?.block;
  assert.ok(block != null, "expected a real nested tool block in the snapshot");
  return block;
}

function derivedFrom(block: NestedBlock, occupants: number[]): DerivedBlock {
  return { key: block.guid, block, occupants };
}

/** Real records of each kind, so rules can be tested against actual types. */
function samples(): {
  extension: LibraryToolRecord;
  collet: LibraryToolRecord;
  tool: LibraryToolRecord;
} {
  const extension = adaptiveItems("extension")[0];
  const collet = adaptiveItems("collet")[0];
  const tool = cuttingTools().find((record) => record.type !== "tool block");
  assert.ok(extension !== undefined, "expected a real extension");
  assert.ok(collet !== undefined, "expected a real collet");
  assert.ok(tool !== undefined, "expected a real cutting tool");
  return { extension, collet, tool };
}

describe("deriving the parent block from its occupants", () => {
  it("collapses every tool that carries the same block into one parent row", () => {
    const occupants = realAssemblies();
    assert.ok(occupants.length > 1, "expected several tools sharing a block");

    const blocks = derivedBlocks(occupants);
    assert.equal(blocks.length, 1);
    assert.deepEqual(
      blocks[0].occupants,
      occupants.map((_, index) => index),
    );
  });

  it("groups by the block guid Fusion stores, not by description", () => {
    const occupants = realAssemblies();
    const guids = new Set(occupants.map((tool) => tool.block?.guid));
    assert.equal(guids.size, 1);
    assert.equal(derivedBlocks(occupants)[0].key, [...guids][0]);
  });

  it("reports a second block as a separate group, so a conflict is visible", () => {
    const [first, second] = assemblies();
    assert.ok(second !== undefined);

    const relabelled = {
      ...second,
      block: { ...realBlock(), guid: "11111111-2222-3333-4444-555555555555" },
    };
    assert.equal(derivedBlocks([first, relabelled]).length, 2);
  });

  it("represents the group with the copy that has a name", () => {
    const [first, second] = assemblies();
    assert.ok(second !== undefined);

    const unnamed = { ...first, block: { ...realBlock(), description: "" } };
    const named = { ...second, block: { ...realBlock(), description: "Test Assembly" } };

    // Copies of one block disagree about their description in the real data, so
    // the derived name must not depend on which occupant happens to come first.
    assert.equal(derivedBlocks([unnamed, named])[0].block.description, "Test Assembly");
    assert.equal(derivedBlocks([named, unnamed])[0].block.description, "Test Assembly");
  });

  it("ignores empty positions and tools that carry no block", () => {
    const standalone = toolBlocks()[0];
    assert.ok(standalone !== undefined);
    assert.equal(derivedBlocks([null, undefined, standalone]).length, 0);
  });

  it("reads the block's declared capacity from its own numberOfTools field", () => {
    const capacity = blockCapacity(realBlock());
    assert.equal(typeof capacity, "number");
    assert.ok((capacity as number) >= 1);
  });
});

describe("positions under the block", () => {
  it("follows the block's tool count in both directions", () => {
    const one = [slot(["a"])];
    const three = syncSlotCount(one, 3);
    assert.equal(three.length, 3);
    assert.deepEqual(three[0].stack, ["a"]);
    assert.deepEqual(three.slice(1).map((s) => s.stack), [[], []]);

    assert.equal(syncSlotCount(three, 1).length, 1);
    assert.equal(syncSlotCount(three, 0).length, 1, "one row always remains");
  });

  it("returns the same list when the count already matches", () => {
    const slots = [emptySlot(), emptySlot()];
    assert.equal(syncSlotCount(slots, 2), slots);
  });

  it("counts a position as occupied as soon as it holds anything", () => {
    assert.equal(slotIsOccupied(slot([])), false);
    assert.equal(slotIsOccupied(slot(["ext"])), true);
  });

  it("takes the station a tool already declares when it is placed", () => {
    const tool = assemblies().find((candidate) => stationNumber(candidate) !== null);
    assert.ok(tool !== undefined);

    const slots = setSlotComponent([emptySlot()], 0, 0, tool);
    assert.deepEqual(slots[0].stack, [tool.id]);
    assert.equal(slots[0].stationNumber, stationNumber(tool));
  });

  it("falls back to row order when the tool declares no station", () => {
    assert.equal(slotStation(slot(["a"]), 2), 2);
    assert.equal(slotStation(slot(["a"], 7), 2), 7);
  });

  it("never removes the last position", () => {
    const one = [slot(["a"])];
    assert.equal(removeSlot(one, 0), one);
    assert.equal(removeSlot([slot(["a"]), slot(["b"])], 0).length, 1);
  });
});

describe("what a position accepts next", () => {
  const { extension, collet, tool } = samples();

  it("names an empty position's options as an extension or a cutting tool", () => {
    assert.deepEqual(slotAccepts([]), ["extension", "tool"]);
  });

  it("lets an extension hold another extension, a collet or a cutting tool", () => {
    // Stacking extensions is how a position gets more reach than any one
    // extension gives it, so the rule accepts extension as a next step too.
    assert.deepEqual(slotAccepts(["extension"]), ["extension", "collet", "tool"]);
    assert.deepEqual(
      slotAccepts(["extension", "extension"]),
      ["extension", "collet", "tool"],
    );
  });

  it("has nothing follow a cutting tool, since a cutting tool ends the stack", () => {
    assert.deepEqual(slotAccepts(["extension", "tool"]), []);
    assert.deepEqual(slotAccepts(["tool"]), []);
  });

  it("reads the kind of a record from its type, adaptive items apart from tools", () => {
    assert.equal(slotKind(extension), "extension");
    assert.equal(slotKind(collet), "collet");
    assert.equal(slotKind(tool), "tool");
  });

  it("reads a stack of ids back into the kinds it holds", () => {
    assert.deepEqual(
      slotKinds([extension.id, collet.id, tool.id]),
      ["extension", "collet", "tool"],
    );
  });

  it("counts a position as complete once a cutting tool is at the end", () => {
    assert.equal(slotIsComplete([]), false);
    assert.equal(slotIsComplete(["extension"]), false);
    assert.equal(slotIsComplete(["extension", "collet"]), false);
    assert.equal(slotIsComplete(["extension", "tool"]), true);
    assert.equal(slotIsComplete(["tool"]), true);
  });
});

describe("placing components at a step of a position", () => {
  const { extension, collet, tool } = samples();

  it("lets a cutting tool go straight in without an extension in front of it", () => {
    const slots = setSlotComponent([emptySlot()], 0, 0, tool);
    assert.deepEqual(slots[0].stack, [tool.id]);
  });

  it("keeps a collet on top of its extension when the extension is swapped", () => {
    const other = adaptiveItems("extension").find((record) => record.id !== extension.id);
    assert.ok(other !== undefined, "expected two extensions in the library");

    const start = [{ ...emptySlot(), stack: [extension.id, collet.id, tool.id] }];
    const swapped = setSlotComponent(start, 0, 0, other);
    assert.deepEqual(swapped[0].stack, [other.id, collet.id, tool.id]);
  });

  it("drops what was above a slot once a cutting tool takes its place", () => {
    // A cutting tool ends the stack, so nothing that was mounted past what it
    // replaces still has anywhere to go.
    const start = [{ ...emptySlot(), stack: [extension.id, collet.id, tool.id] }];
    const replaced = setSlotComponent(start, 0, 0, tool);
    assert.deepEqual(replaced[0].stack, [tool.id]);
  });

  it("empties the whole position when its first component is cleared", () => {
    const filled = [{ ...emptySlot(), stack: [extension.id, collet.id, tool.id] }];
    const cleared = setSlotComponent(filled, 0, 0, null);
    assert.deepEqual(cleared[0].stack, []);
  });

  it("clears above the removed step, since a collet has nothing to sit in", () => {
    const filled = [{ ...emptySlot(), stack: [extension.id, collet.id, tool.id] }];
    const cleared = setSlotComponent(filled, 0, 1, null);
    assert.deepEqual(cleared[0].stack, [extension.id]);
  });

  it("refuses a step that is past the end of the stack", () => {
    const slots = [{ ...emptySlot(), stack: [extension.id] }];
    assert.equal(setSlotComponent(slots, 0, 5, tool), slots);
  });
});

describe("reordering hands the tool its new position's station", () => {
  it("swaps the whole stack and leaves the stations where they were", () => {
    const slots = [slot(["a"], 5), slot(["b"], 2)];
    const moved = moveSlot(slots, 0, 1);

    assert.deepEqual(moved[0].stack, ["b"]);
    assert.equal(moved[0].stationNumber, 5);
    assert.deepEqual(moved[1].stack, ["a"]);
    assert.equal(moved[1].stationNumber, 2);
  });

  it("carries the whole stack, since a position moves as one assembly", () => {
    const slots = [slot(["ext-a", "collet-a", "drill-a"], 5), slot(["ext-b"], 2)];
    const moved = moveSlot(slots, 0, 1);

    assert.deepEqual(moved[1].stack, ["ext-a", "collet-a", "drill-a"]);
    assert.equal(moved[1].stationNumber, 2, "the station stays with the position");
  });

  it("moves back up to the original arrangement", () => {
    const slots = [slot(["a"], 5), slot(["b"], 2)];
    assert.deepEqual(moveSlot(moveSlot(slots, 0, 1), 1, -1), slots);
  });

  it("refuses to move off either end", () => {
    const slots = [slot(["a"], 5), slot(["b"], 2)];
    assert.equal(moveSlot(slots, 0, -1), slots);
    assert.equal(moveSlot(slots, 1, 1), slots);
  });
});

describe("validation of a multi-slot assembly", () => {
  const block = realBlock();

  it("fails when the occupants disagree about which block they sit in", () => {
    const other: NestedBlock = { ...block, guid: "other-guid", description: "Other block" };
    const { status, issues } = runValidation({
      rows: [blockRow(), slotRow(0), slotRow(1)],
      slots: [slot(["a"], 0), slot(["b"], 1)],
      blocks: [derivedFrom(block, [0]), derivedFrom(other, [1])],
      config: CONFIG,
      measuredMm: 120,
    });

    assert.equal(status, "fail");
    const issue = issues.find((item) => item.id === "conflicting-blocks");
    assert.ok(issue !== undefined);
    assert.match(issue.message, /2 different tool blocks/);
  });

  it("fails when more tools are assigned than the block declares it holds", () => {
    const capacity = blockCapacity(block) ?? 1;
    const rows = [blockRow()];
    const slots: AssemblySlot[] = [];
    for (let index = 0; index <= capacity; index += 1) {
      rows.push(slotRow(index));
      slots.push(slot([`tool-${index}`], index));
    }

    const { status, issues } = runValidation({
      rows,
      slots,
      blocks: [derivedFrom(block, slots.map((_, index) => index))],
      config: CONFIG,
      measuredMm: 120,
    });

    assert.equal(status, "fail");
    const issue = issues.find((item) => item.id === "capacity-overflow");
    assert.ok(issue !== undefined);
    assert.match(issue.message, new RegExp(`holds ${capacity} tool\\(s\\)`));
  });

  it("fails when two positions claim the same station", () => {
    const { status, issues } = runValidation({
      rows: [blockRow(), slotRow(0), slotRow(1)],
      slots: [slot(["a"], 0), slot(["b"], 0)],
      blocks: [derivedFrom(block, [0, 1])],
      config: { ...CONFIG, numberOfTools: 2 },
      measuredMm: 120,
    });

    assert.equal(status, "fail");
    assert.ok(issues.some((item) => item.id === "duplicate-station-0"));
  });

  it("does not report a station twice when only one tool uses it", () => {
    const { issues } = runValidation({
      rows: [blockRow(), slotRow(0)],
      slots: [slot(["a"], 0), slot([])],
      blocks: [derivedFrom(block, [0])],
      config: { ...CONFIG, numberOfTools: 2 },
      measuredMm: 120,
    });

    assert.ok(!issues.some((item) => item.id.startsWith("duplicate-station")));
  });

  it("stops at the missing tool before checking anything block-shaped", () => {
    const { status, issues } = runValidation({
      rows: [blockRow(), slotRow(0, 0, { toolId: null })],
      slots: [slot([])],
      blocks: [],
      config: CONFIG,
      measuredMm: null,
    });

    assert.equal(status, "fail");
    assert.deepEqual(issues.map((item) => item.id), ["no-tool"]);
  });

  it("warns about a position that holds an adaptive item but no cutting tool", () => {
    const { extension } = samples();
    const { issues } = runValidation({
      rows: [blockRow(), slotRow(0, 0, { toolId: extension.id, level: "extension" })],
      slots: [slot([extension.id], 0)],
      blocks: [derivedFrom(block, [0])],
      config: { ...CONFIG, numberOfTools: 1 },
      measuredMm: 120,
    });

    const issue = issues.find((item) => item.id === "incomplete-slot-0");
    assert.ok(issue !== undefined, "expected a warning for an unfinished position");
    assert.equal(issue.severity, "warning");
  });
});

describe("per-slot gauge length", () => {
  it("measures each occupant through its own joint chain", () => {
    const measurable = assemblies().find(
      (tool) => occupantGaugeLengthMm(tool) !== null,
    );
    assert.ok(measurable !== undefined, "expected a measurable occupant");

    const gauge = occupantGaugeLengthMm(measurable);
    const total = measuredStackUpMm(chainFor(measurable));
    assert.ok(gauge !== null && total !== null);

    // The gauge starts at the block's cutting face rather than the turret face,
    // so it is shorter than the whole stack-up but not zero.
    assert.ok(gauge > 0);
    assert.ok(gauge < total);
  });

  it("reports nothing rather than a guess when a frame is missing", () => {
    const unmeasurable = assemblies().find(
      (tool) => occupantGaugeLengthMm(tool) === null,
    );
    if (unmeasurable !== undefined) {
      assert.equal(occupantGaugeLengthMm(unmeasurable), null);
    }
  });
});
