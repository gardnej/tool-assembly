/**
 * Measure a block GLB's bounding box so seating stays derived, not eyeballed.
 *
 * Prints the axis-aligned bounding box (from the POSITION accessors' min/max,
 * which glTF requires) of the block body material and of the whole assembly, in
 * the mesh's own coordinate space. The block-body centre feeds `recenter` in
 * src/data/turretSolids.ts and its half-extents feed the seating offsets, so
 * placement is grounded in the real geometry rather than tuned against
 * screenshots.
 *
 * Usage: node scripts/measure-block.mjs [path-to.glb] [bodyMaterialName]
 */

import fs from "node:fs";
import process from "node:process";

const GLB = process.argv[2] ?? "src/assets/models/3x-spot-drill-tap-caps.glb";
const BODY_MATERIAL = process.argv[3] ?? "part_0";

const buf = fs.readFileSync(GLB);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const total = dv.getUint32(8, true);
let offset = 12;
let json = null;
while (offset < total) {
  const chunkLength = dv.getUint32(offset, true);
  const chunkType = dv.getUint32(offset + 4, true);
  offset += 8;
  const chunk = buf.subarray(offset, offset + chunkLength);
  if (chunkType === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
  offset += chunkLength;
}
if (json === null) throw new Error("GLB has no JSON chunk");

const materialNames = (json.materials ?? []).map((m) => m.name);
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
function apply(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

// World matrix per node, following the scene graph.
const world = {};
function visit(index, parent) {
  const node = json.nodes[index];
  const local = node.matrix ?? identity;
  const m = multiply(parent, local);
  world[index] = m;
  (node.children ?? []).forEach((child) => visit(child, m));
}
const scene = json.scenes[json.scene ?? 0];
(scene.nodes ?? []).forEach((root) => visit(root, identity));

function emptyBox() {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
}
function grow(box, p) {
  for (let d = 0; d < 3; d += 1) {
    box.min[d] = Math.min(box.min[d], p[d]);
    box.max[d] = Math.max(box.max[d], p[d]);
  }
}

const bodyBox = emptyBox();
const allBox = emptyBox();
json.nodes.forEach((node, index) => {
  if (node.mesh === undefined) return;
  const wm = world[index] ?? identity;
  for (const primitive of json.meshes[node.mesh].primitives) {
    const accessor = json.accessors[primitive.attributes.POSITION];
    if (accessor?.min === undefined || accessor.max === undefined) continue;
    const [nx, ny, nz] = accessor.min;
    const [xx, xy, xz] = accessor.max;
    for (const corner of [
      [nx, ny, nz], [nx, ny, xz], [nx, xy, nz], [nx, xy, xz],
      [xx, ny, nz], [xx, ny, xz], [xx, xy, nz], [xx, xy, xz],
    ]) {
      const w = apply(wm, corner);
      grow(allBox, w);
      if (primitive.material !== undefined && materialNames[primitive.material] === BODY_MATERIAL) {
        grow(bodyBox, w);
      }
    }
  }
});

const fmt = (v) => v.map((n) => n.toFixed(3));
const centre = (box) => box.min.map((n, i) => (n + box.max[i]) / 2);
const size = (box) => box.max.map((n, i) => n - box.min[i]);

console.log(`GLB: ${GLB}`);
console.log(`Body material: ${BODY_MATERIAL}`);
console.log(`  body  min ${fmt(bodyBox.min)}  max ${fmt(bodyBox.max)}`);
console.log(`  body  centre ${fmt(centre(bodyBox))}  size ${fmt(size(bodyBox))}`);
console.log(`  all   centre ${fmt(centre(allBox))}  size ${fmt(size(allBox))}`);
console.log("");
console.log("Seat with (in turretSolids.ts): recenter = body centre;");
console.log("  offset[0] (radial) = body +mountNormal half-extent × scale;");
console.log("  offset[1] (axial)  = frontAxial − facetAxial − (+up half-extent × scale).");
