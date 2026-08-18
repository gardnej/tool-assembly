import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BLOCK_TYPE,
  LIBRARIES,
  TOOLS,
  assemblies,
  chainFor,
  cuttingTools,
  displayName,
  hasCompleteFrames,
  isBlockType,
  isHalfIndex,
  isTurningType,
  measuredStackUpMm,
  missingFrameLabel,
  solidSpanMm,
  stationNumber,
  toolBlocks,
  toolById,
  toolsForLibrary,
} from "../src/data/realLibrary";
import { closeTo } from "./helpers";

describe("snapshot shape", () => {
  it("carries libraries and tools", () => {
    assert.ok(LIBRARIES.length > 0);
    assert.ok(TOOLS.length > 0);
  });

  it("uses Fusion's real type strings, not invented categories", () => {
    const types = new Set(TOOLS.map((tool) => tool.type));
    assert.ok(types.has("turning general"));
    assert.ok(types.has(BLOCK_TYPE));
  });

  it("groups every tool under a known library", () => {
    const ids = new Set(LIBRARIES.map((library) => library.id));
    for (const tool of TOOLS) {
      assert.ok(ids.has(tool.libraryId), `unknown library ${tool.libraryId}`);
    }
  });

  it("reports a tool count per library that matches its tools", () => {
    for (const library of LIBRARIES) {
      assert.equal(toolsForLibrary(library.id).length, library.toolCount);
    }
  });
});

describe("type predicates", () => {
  it("separates blocks from cutting tools", () => {
    assert.equal(isBlockType(BLOCK_TYPE), true);
    assert.equal(isBlockType("turning general"), false);
    assert.equal(isTurningType("turning general"), true);
    assert.equal(isTurningType("flat end mill"), false);
  });

  it("partitions the snapshot with no overlap", () => {
    assert.equal(toolBlocks().length + cuttingTools().length, TOOLS.length);
  });
});

describe("existing assemblies in the real data", () => {
  it("finds tools that already carry a nested block", () => {
    assert.ok(assemblies().length > 0);
  });

  it("models the block as owned by the tool, per Fusion's schema", () => {
    for (const tool of assemblies()) {
      assert.notEqual(tool.block, null);
      assert.equal(isBlockType(tool.type), false);
    }
  });

  it("builds a block-then-holder chain", () => {
    const components = chainFor(assemblies()[0]);
    assert.deepEqual(
      components.map((component) => component.role),
      ["block", "holder"],
    );
  });

  it("measures a real assembly as longer than either component alone", () => {
    const measurable = assemblies()
      .map((tool) => chainFor(tool))
      .find((components) => measuredStackUpMm(components) !== null);

    assert.ok(measurable !== undefined, "expected at least one measurable assembly");

    const total = measuredStackUpMm(measurable);
    assert.ok(total !== null);
    for (const component of measurable) {
      assert.ok(component.spanMm !== null);
      assert.ok(total >= component.spanMm - 1e-9, "total shorter than a component");
    }
  });

  it("measures the EWS block span from its stored frames", () => {
    const block = TOOLS.find(
      (tool) => tool.type === BLOCK_TYPE && tool.geometryId !== null,
    );
    assert.ok(block !== undefined);
    closeTo(solidSpanMm(block.geometryId) ?? 0, 101.828, 3);
  });
});

describe("joint frame gaps", () => {
  it("treats a missing geometry id as having no frames", () => {
    assert.equal(solidSpanMm(null), null);
    assert.equal(hasCompleteFrames(undefined), false);
  });

  it("cannot measure a chain through a component with no geometry", () => {
    const withoutGeometry = TOOLS.find((tool) => tool.geometryId === null);
    assert.ok(withoutGeometry !== undefined);

    const components = chainFor(withoutGeometry);
    assert.equal(measuredStackUpMm(components), null);
    assert.equal(missingFrameLabel(components[components.length - 1]), "geometry");
  });

  it("measures nothing for an empty chain", () => {
    assert.equal(measuredStackUpMm([]), null);
  });
});

describe("turret fields", () => {
  it("reads station number where the real data defines one", () => {
    const withStation = TOOLS.filter((tool) => stationNumber(tool) !== null);
    assert.ok(withStation.length > 0);
    for (const tool of withStation) {
      assert.equal(typeof stationNumber(tool), "number");
    }
  });

  it("reports half index as a boolean", () => {
    for (const tool of assemblies()) {
      assert.equal(typeof isHalfIndex(tool), "boolean");
    }
  });
});

describe("naming", () => {
  it("never shows an empty label", () => {
    for (const tool of TOOLS) {
      assert.ok(displayName(tool).trim().length > 0);
    }
  });

  it("looks a tool up by id", () => {
    const first = TOOLS[0];
    assert.equal(toolById(first.id)?.id, first.id);
    assert.equal(toolById("no-such-tool"), undefined);
  });
});
