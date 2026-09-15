/**
 * Verify the seatable block lands flush — in millimetres, not by screenshot.
 *
 * Recomputes the same seating maths as src/data/turretSolids.ts from the turret
 * ring data and the measured block-body AABB, then reports two gaps per station:
 *   • mountFaceGap — the block's +Z mounting face vs the rim facet (0 = flush)
 *   • frontFaceGap — the block's +X front face vs the turret's numbered front
 *     plane (0 = coplanar)
 * Exits non-zero if any station is off by more than 0.05 mm, so this can guard
 * the placement calibration in CI instead of eyeballing renders.
 *
 * Usage: node scripts/check-seating.mjs
 */

import fs from "node:fs";
import process from "node:process";

const ring = JSON.parse(
  fs.readFileSync(new URL("../src/data/turretStations.json", import.meta.url), "utf8"),
);

// Mirrors the /spot-drill-tap/ calibration in src/data/turretSolids.ts.
const SCALE = 0.8;
const RECENTER = [0.75, -2.52, -4.675];
const OFFSET = [4.7, -4.6, 0]; // [radial, axial, tangent]
const UP = [1, 0, 0]; // tool axis -> forward
const MOUNT_NORMAL = [0, 0, 1]; // pins -> into facet
// Measured with scripts/measure-block.mjs (material part_0).
const BODY_AABB = { min: [-3.75, -8.79, -10.55], max: [5.25, 3.75, 1.2] };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => {
  const m = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / m, a[1] / m, a[2] / m];
};

function frameFor(station) {
  const center = ring.center;
  const axis = norm(ring.axis);
  const fromCenter = sub(station.position, center);
  const axialMount = dot(fromCenter, axis);
  const radial = norm(sub(fromCenter, scale(axis, axialMount)));
  const tangent = norm(cross(axis, radial));
  const origin = add(add(center, scale(axis, axialMount)), scale(radial, ring.radius));
  return { origin, axis, radial, tangent };
}

function placement(frame) {
  const e1 = norm(UP);
  const e2 = norm(MOUNT_NORMAL);
  const e3 = norm(cross(e1, e2));
  const t1 = frame.axis;
  const t2 = scale(frame.radial, -1);
  const t3 = norm(cross(t1, t2));
  const es = [e1, e2, e3];
  const ts = [t1, t2, t3];
  const rotCol = (k) => {
    let c = [0, 0, 0];
    for (let j = 0; j < 3; j += 1) c = add(c, scale(ts[j], es[j][k]));
    return c;
  };
  const col0 = scale(rotCol(0), SCALE);
  const col1 = scale(rotCol(1), SCALE);
  const col2 = scale(rotCol(2), SCALE);
  const origin = add(
    add(add(frame.origin, scale(frame.radial, OFFSET[0])), scale(frame.axis, OFFSET[1])),
    scale(frame.tangent, OFFSET[2]),
  );
  const m3r = [
    col0[0] * RECENTER[0] + col1[0] * RECENTER[1] + col2[0] * RECENTER[2],
    col0[1] * RECENTER[0] + col1[1] * RECENTER[1] + col2[1] * RECENTER[2],
    col0[2] * RECENTER[0] + col1[2] * RECENTER[1] + col2[2] * RECENTER[2],
  ];
  const t = sub(origin, m3r);
  return { col0, col1, col2, t };
}

const applyMat = (m, p) => [
  m.col0[0] * p[0] + m.col1[0] * p[1] + m.col2[0] * p[2] + m.t[0],
  m.col0[1] * p[0] + m.col1[1] * p[1] + m.col2[1] * p[2] + m.t[1],
  m.col0[2] * p[0] + m.col1[2] * p[1] + m.col2[2] * p[2] + m.t[2],
];

const mid = (d) => (BODY_AABB.min[d] + BODY_AABB.max[d]) / 2;
const mountFaceLocal = [mid(0), mid(1), BODY_AABB.max[2]];
const frontFaceLocal = [BODY_AABB.max[0], mid(1), mid(2)];
const axis = norm(ring.axis);

let worst = 0;
for (const station of ring.stations) {
  const frame = frameFor(station);
  const m = placement(frame);
  const mountFaceGap = dot(sub(applyMat(m, mountFaceLocal), frame.origin), frame.radial);
  const frontFaceGap = dot(sub(applyMat(m, frontFaceLocal), ring.center), axis) - ring.frontAxial;
  worst = Math.max(worst, Math.abs(mountFaceGap), Math.abs(frontFaceGap));
  console.log(
    `station ${String(station.number).padStart(2)}  ` +
      `mountFaceGap ${mountFaceGap.toFixed(4)} mm  frontFaceGap ${frontFaceGap.toFixed(4)} mm`,
  );
}

console.log(`\nworst gap: ${worst.toFixed(4)} mm`);
if (worst > 0.05) {
  console.error("FAIL: a face is more than 0.05 mm out of position.");
  process.exit(1);
}
console.log("PASS: block seats flush and front-coplanar on every station.");
