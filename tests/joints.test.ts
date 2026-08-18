import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IDENTITY,
  alongZ,
  assemblyLength,
  chainPlacements,
  flipZ,
  fromAxes,
  identity,
  invertRigid,
  multiply,
  originOf,
  spanJoints,
  zAxisOf,
  type JointPair,
} from "../src/data/joints";
import { closeTo } from "./helpers";

/** Build a joint chain from `[spanMm, reversedSolid]` pairs. */
function chain(...spans: [number, boolean][]): JointPair[] {
  return spans.map(([span, reversed]) => spanJoints(span, reversed));
}

describe("span convention", () => {
  it("reports a single span as positive either way round", () => {
    for (const reversed of [false, true]) {
      closeTo(assemblyLength(chain([125, reversed])), 125);
    }
  });

  it("stacks up as a sum for every flip combination", () => {
    for (const first of [false, true]) {
      for (const second of [false, true]) {
        closeTo(assemblyLength(chain([40, first], [125, second])), 165);
      }
    }
  });

  it("handles a mixed three-component chain", () => {
    closeTo(assemblyLength(chain([40, true], [125, false], [30, true])), 195);
  });

  it("seats components progressively forward", () => {
    const placements = chainPlacements(chain([40, true], [125, false]));
    closeTo(originOf(placements[0])[2], 0);
    closeTo(originOf(placements[1])[2], 40);
  });

  it("does not hand a flipped frame onward from a reversed component", () => {
    const pairs = chain([40, true]);
    const frontier = multiply(chainPlacements(pairs)[0], pairs[0][1]);
    closeTo(zAxisOf(frontier)[2], 1);
  });
});

describe("joint offsets", () => {
  it("does not let a machine-side offset leak into the stack-up", () => {
    const pairs: JointPair[] = [[alongZ(30), alongZ(80)]];
    closeTo(assemblyLength(pairs), 50);
  });

  it("measures an empty chain as zero", () => {
    assert.equal(assemblyLength([]), 0);
  });
});

describe("rigid maths", () => {
  it("inverts as a round trip", () => {
    const m = multiply(alongZ(25), flipZ());
    multiply(m, invertRigid(m)).forEach((value, index) => {
      closeTo(value, IDENTITY[index], 12);
    });
  });

  it("treats identity as the multiplicative unit", () => {
    const m = fromAxes([1, 2, 3], [0, 1, 0], [-1, 0, 0], [0, 0, 1]);
    multiply(identity(), m).forEach((value, index) => {
      closeTo(value, m[index], 12);
    });
  });

  it("reads the origin and Z axis out of a frame", () => {
    const m = alongZ(63);
    assert.deepEqual(originOf(m), [0, 0, 63]);
    assert.deepEqual(zAxisOf(m), [0, 0, 1]);
  });
});

describe("agreement with the Python implementation", () => {
  it("matches the measured span of the real EWS block", () => {
    // The frames stored in the EWS_163950_DIN4003 .3DTool file: identity MCS and
    // a CSW translated (63, 0, -80). The Python suite measures 101.828 mm.
    const pairs: JointPair[] = [
      [identity(), fromAxes([63, 0, -80], [1, 0, 0], [0, 1, 0], [0, 0, 1])],
    ];
    closeTo(assemblyLength(pairs), 101.828, 3);
  });
});
