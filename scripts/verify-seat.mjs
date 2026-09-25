/**
 * Authoritative seating check — measures the REAL gap between the mounted block
 * and the REAL turret surface, from actual vertex data of both GLBs.
 *
 * Unlike check-seating.mjs (which was circular: it seated the block at
 * ring.radius and then measured the gap *from* ring.radius, always ~0), this
 * loads:
 *   • the turret mesh (au-part-2023.glb) and finds the outer surface radius
 *     directly under station 1 (its radial footprint), and
 *   • the seatable block mesh (…-caps.glb), applies its node transforms and the
 *     real placement matrix, and finds the block body's innermost radius.
 * The signed gap = block innermost radius − turret surface radius. Positive
 * means the block floats above the turret (a visible gap); ~0 means flush.
 *
 * Usage: node scripts/verify-seat.mjs [stationNumber]
 */

import fs from "node:fs";

const ring = JSON.parse(
  fs.readFileSync(new URL("../src/data/turretStations.json", import.meta.url), "utf8"),
);

const TURRET_GLB = new URL("../src/assets/models/turret-stations.glb", import.meta.url);
const CAPS_GLB = new URL("../src/assets/models/3x-spot-drill-tap-caps.glb", import.meta.url);
const BODY_MATERIAL = "part_0";

// /spot-drill-tap/ calibration mirrored from src/data/turretSolids.ts.
const SCALE = 0.8;
const RECENTER = [0.75, -2.52, -4.675];
const OFFSET = [4.7, -4.6, 0];
const UP = [1, 0, 0];
const MOUNT_NORMAL = [0, 0, 1];

/* vector helpers */
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

/* --- GLB parsing: read full POSITION vertex data, honouring node transforms - */
function parseGlb(url) {
  const buf = fs.readFileSync(url);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const total = dv.getUint32(8, true);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < total) {
    const len = dv.getUint32(offset, true);
    const type = dv.getUint32(offset + 4, true);
    offset += 8;
    const chunk = buf.subarray(offset, offset + len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === 0x004e4942) bin = chunk;
    offset += len;
  }
  return { json, bin };
}

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function multiply(a, b) {
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i += 1)
    for (let j = 0; j < 4; j += 1) {
      let s = 0;
      for (let k = 0; k < 4; k += 1) s += a[k * 4 + j] * b[i * 4 + k];
      r[i * 4 + j] = s;
    }
  return r;
}
function applyMat4(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

/** All vertices of a GLB in scene space, optionally only for one material. */
function readVertices({ json, bin }, materialName) {
  const world = {};
  const visit = (index, parent) => {
    const node = json.nodes[index];
    const m = multiply(parent, node.matrix ?? identity);
    world[index] = m;
    (node.children ?? []).forEach((c) => visit(c, m));
  };
  const scene = json.scenes[json.scene ?? 0];
  (scene.nodes ?? []).forEach((r) => visit(r, identity));

  const names = (json.materials ?? []).map((m) => m.name);
  const out = [];
  json.nodes.forEach((node, index) => {
    if (node.mesh === undefined) return;
    const wm = world[index] ?? identity;
    for (const prim of json.meshes[node.mesh].primitives) {
      if (materialName !== undefined) {
        if (prim.material === undefined || names[prim.material] !== materialName) continue;
      }
      const acc = json.accessors[prim.attributes.POSITION];
      const bv = json.bufferViews[acc.bufferView];
      const stride = bv.byteStride ?? 12;
      const base = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
      const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
      for (let i = 0; i < acc.count; i += 1) {
        const o = base + i * stride;
        const p = [dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)];
        out.push(applyMat4(wm, p));
      }
    }
  });
  return out;
}

/* --- station frame (mirrors turretSolids.ts) ----------------------------- */
function stationFrame(station) {
  const center = ring.center;
  const axis = norm(ring.axis);
  const fromCenter = sub(station.position, center);
  const axialMount = dot(fromCenter, axis);
  const radial = norm(sub(fromCenter, scale(axis, axialMount)));
  const tangent = norm(cross(axis, radial));
  const origin = add(add(center, scale(axis, axialMount)), scale(radial, ring.radius));
  return { origin, axis, radial, tangent, center, axialMount };
}

function placementMatrix(frame) {
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
  // return as column-major mat4
  return [
    col0[0], col0[1], col0[2], 0,
    col1[0], col1[1], col1[2], 0,
    col2[0], col2[1], col2[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

/* --- measurement --------------------------------------------------------- */
const stationNumber = Number(process.argv[2] ?? 1);
const station = ring.stations.find((s) => s.number === stationNumber);
const frame = stationFrame(station);
const axis = norm(ring.axis);
const center = ring.center;

// Radial/axial/tangent coordinate of a world point relative to the ring.
const coords = (p) => {
  const d = sub(p, center);
  const ax = dot(d, axis);
  const rad = dot(d, frame.radial);
  const tan = dot(d, frame.tangent);
  return { ax, rad, tan };
};

// Block body vertices, placed.
const capsRaw = readVertices(parseGlb(CAPS_GLB), BODY_MATERIAL);
const m = placementMatrix(frame);
const block = capsRaw.map((p) => applyMat4(m, p));
const blockC = block.map(coords);
const blockRadMin = Math.min(...blockC.map((c) => c.rad));
const blockRadMax = Math.max(...blockC.map((c) => c.rad));
const blockAx = { min: Math.min(...blockC.map((c) => c.ax)), max: Math.max(...blockC.map((c) => c.ax)) };
const blockTan = { min: Math.min(...blockC.map((c) => c.tan)), max: Math.max(...blockC.map((c) => c.tan)) };

// Turret surface directly under the block footprint: the OUTERMOST turret
// radius among vertices whose tangent+axial fall within the block's footprint.
const turret = readVertices(parseGlb(TURRET_GLB)).map(coords);
const underFoot = turret.filter(
  (c) =>
    c.tan >= blockTan.min && c.tan <= blockTan.max &&
    c.ax >= blockAx.min && c.ax <= blockAx.max,
);
const turretSurfaceRad =
  underFoot.length > 0 ? Math.max(...underFoot.map((c) => c.rad)) : NaN;

console.log(`station ${stationNumber}`);
console.log(`  ring.radius (assumed facet): ${ring.radius.toFixed(3)}`);
console.log(`  block radial: min ${blockRadMin.toFixed(3)}  max ${blockRadMax.toFixed(3)}`);
console.log(`  block axial:  min ${blockAx.min.toFixed(3)}  max ${blockAx.max.toFixed(3)}  (frontAxial ${ring.frontAxial})`);
console.log(`  block tangent footprint: ${blockTan.min.toFixed(3)} … ${blockTan.max.toFixed(3)}`);
console.log(`  turret surface radius under footprint (${underFoot.length} pts): ${turretSurfaceRad.toFixed(3)}`);
console.log("");
const gap = blockRadMin - turretSurfaceRad;
console.log(`  >>> SEATING GAP = block bottom − turret surface = ${gap.toFixed(3)} mm`);
console.log(`      (positive = block floats above; negative = block sinks in)`);
