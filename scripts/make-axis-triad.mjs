// Procedural RGB axis-triad GLB generator (pure Node, no external deps — the
// npm registry is unreachable in this environment, so we emit the GLB bytes by
// hand the same way `tint-block-glb.mjs` rewrites them).
//
// Produces `src/assets/models/axis-triad.glb`: three thin colored bars from a
// shared origin — +X red, +Y green, +Z blue — each ~7 cm long (GLB space is cm)
// and 0.5 cm square, plus a small white cube at the origin. Materials are given
// a strong emissiveFactor so the colors read clearly against the white turret
// regardless of scene lighting (unlit-ish). The triad is added as an extra
// mount in `turretPreview.ts`; its node matrix places/orients it at a frame, so
// the bars visualise that frame's X/Y/Z axes directly.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const OUT = process.argv[2] ?? "src/assets/models/axis-triad.glb";

const LEN = 7.0; // bar length, cm
const TH = 0.5; // bar cross-section, cm (square)
const HUB = 0.9; // origin cube edge, cm

/** 24-vertex axis-aligned box (4 verts/face) with per-face normals. */
function makeBox(min, max) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const positions = [];
  const normals = [];
  const indices = [];
  // face = { normal, quad corners CCW seen from outside }
  const faces = [
    { n: [1, 0, 0], v: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
    { n: [-1, 0, 0], v: [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]] },
    { n: [0, 1, 0], v: [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]] },
    { n: [0, -1, 0], v: [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]] },
    { n: [0, 0, 1], v: [[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]] },
    { n: [0, 0, -1], v: [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]] },
  ];
  for (const { n, v } of faces) {
    const base = positions.length / 3;
    for (const p of v) {
      positions.push(p[0], p[1], p[2]);
      normals.push(n[0], n[1], n[2]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
}

// The four parts: three bars along +axis and the origin hub.
const half = TH / 2;
const hub = HUB / 2;
const parts = [
  { name: "axis-x", color: [0.9, 0.05, 0.05], emissive: [0.8, 0.0, 0.0], box: makeBox([0, -half, -half], [LEN, half, half]) },
  { name: "axis-y", color: [0.05, 0.8, 0.05], emissive: [0.0, 0.7, 0.0], box: makeBox([-half, 0, -half], [half, LEN, half]) },
  { name: "axis-z", color: [0.05, 0.2, 0.95], emissive: [0.0, 0.1, 0.85], box: makeBox([-half, -half, 0], [half, half, LEN]) },
  { name: "axis-o", color: [0.95, 0.95, 0.95], emissive: [0.5, 0.5, 0.5], box: makeBox([-hub, -hub, -hub], [hub, hub, hub]) },
];

// --- pack binary buffer: per part [positions f32][normals f32][indices u16] ---
const chunks = [];
let byteLength = 0;
const bufferViews = [];
const accessors = [];
const meshPrimitives = [];
const materials = [];

function align4() {
  const pad = (4 - (byteLength % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad, 0));
    byteLength += pad;
  }
}

for (let i = 0; i < parts.length; i += 1) {
  const { name, color, emissive, box } = parts[i];
  const posF = Float32Array.from(box.positions);
  const nrmF = Float32Array.from(box.normals);
  const idxU = Uint16Array.from(box.indices);

  // POSITION
  align4();
  const posOffset = byteLength;
  const posBuf = Buffer.from(posF.buffer, posF.byteOffset, posF.byteLength);
  chunks.push(Buffer.from(posBuf));
  byteLength += posBuf.length;
  const posBv = bufferViews.length;
  bufferViews.push({ buffer: 0, byteOffset: posOffset, byteLength: posBuf.length, target: 34962 });
  // min/max over positions
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < posF.length; k += 3) {
    for (let d = 0; d < 3; d += 1) {
      min[d] = Math.min(min[d], posF[k + d]);
      max[d] = Math.max(max[d], posF[k + d]);
    }
  }
  const posAcc = accessors.length;
  accessors.push({ bufferView: posBv, componentType: 5126, count: posF.length / 3, type: "VEC3", min, max });

  // NORMAL
  align4();
  const nrmOffset = byteLength;
  const nrmBuf = Buffer.from(nrmF.buffer, nrmF.byteOffset, nrmF.byteLength);
  chunks.push(Buffer.from(nrmBuf));
  byteLength += nrmBuf.length;
  const nrmBv = bufferViews.length;
  bufferViews.push({ buffer: 0, byteOffset: nrmOffset, byteLength: nrmBuf.length, target: 34962 });
  const nrmAcc = accessors.length;
  accessors.push({ bufferView: nrmBv, componentType: 5126, count: nrmF.length / 3, type: "VEC3" });

  // INDICES
  align4();
  const idxOffset = byteLength;
  const idxBuf = Buffer.from(idxU.buffer, idxU.byteOffset, idxU.byteLength);
  chunks.push(Buffer.from(idxBuf));
  byteLength += idxBuf.length;
  const idxBv = bufferViews.length;
  bufferViews.push({ buffer: 0, byteOffset: idxOffset, byteLength: idxBuf.length, target: 34963 });
  const idxAcc = accessors.length;
  accessors.push({ bufferView: idxBv, componentType: 5123, count: idxU.length, type: "SCALAR" });

  materials.push({
    name,
    pbrMetallicRoughness: { baseColorFactor: [...color, 1], metallicFactor: 0.0, roughnessFactor: 0.9 },
    emissiveFactor: emissive,
  });
  meshPrimitives.push({ attributes: { POSITION: posAcc, NORMAL: nrmAcc }, indices: idxAcc, material: i });
}

const bin = Buffer.concat(chunks);

const gltf = {
  asset: { version: "2.0", generator: "make-axis-triad.mjs" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: "axis-triad" }],
  meshes: [{ name: "axis-triad", primitives: meshPrimitives }],
  materials,
  accessors,
  bufferViews,
  buffers: [{ byteLength: bin.length }],
};

// --- emit GLB container ---
let jsonBuf = Buffer.from(JSON.stringify(gltf), "utf8");
const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
if (jsonPad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
let binOut = bin;
const binPad = (4 - (binOut.length % 4)) % 4;
if (binPad) binOut = Buffer.concat([binOut, Buffer.alloc(binPad, 0)]);

const total = 12 + 8 + jsonBuf.length + 8 + binOut.length;
const out = Buffer.alloc(total);
out.writeUInt32LE(0x46546c67, 0);
out.writeUInt32LE(2, 4);
out.writeUInt32LE(total, 8);
let p = 12;
out.writeUInt32LE(jsonBuf.length, p); p += 4;
out.writeUInt32LE(0x4e4f534a, p); p += 4; // JSON
jsonBuf.copy(out, p); p += jsonBuf.length;
out.writeUInt32LE(binOut.length, p); p += 4;
out.writeUInt32LE(0x004e4942, p); p += 4; // BIN\0
binOut.copy(out, p);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(`Wrote ${OUT} (${out.length} bytes): +X red, +Y green, +Z blue, ${LEN}cm bars, ${TH}cm thick.`);
