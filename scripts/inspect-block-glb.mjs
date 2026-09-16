// Pure-Node GLB inspector: dumps materials, meshes, primitives, and per-primitive
// POSITION AABB (from accessor min/max) so we can tell body vs tool parts.
// No external deps — parses the GLB container directly.
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "src/assets/models/toolblock-3x-clean.glb";
const buf = readFileSync(path);

// GLB header: magic(u32) version(u32) length(u32)
const magic = buf.readUInt32LE(0);
if (magic !== 0x46546c67) throw new Error("not a GLB");
let off = 12;
let json = null;
const chunks = [];
while (off < buf.length) {
  const clen = buf.readUInt32LE(off);
  const ctype = buf.readUInt32LE(off + 4);
  const cdata = buf.subarray(off + 8, off + 8 + clen);
  chunks.push({ ctype, clen, start: off + 8 });
  if (ctype === 0x4e4f534a) json = JSON.parse(Buffer.from(cdata).toString("utf8"));
  off += 8 + clen;
}

const g = json;
console.log("=== MATERIALS ===");
(g.materials ?? []).forEach((m, i) => {
  const pbr = m.pbrMetallicRoughness ?? {};
  console.log(
    `[${i}] name=${JSON.stringify(m.name)} baseColor=${JSON.stringify(pbr.baseColorFactor)} metal=${pbr.metallicFactor} rough=${pbr.roughnessFactor}`,
  );
});

console.log("\n=== MESHES / PRIMITIVES (POSITION AABB) ===");
(g.meshes ?? []).forEach((mesh, mi) => {
  console.log(`mesh[${mi}] name=${JSON.stringify(mesh.name)} prims=${mesh.primitives.length}`);
  mesh.primitives.forEach((p, pi) => {
    const posAcc = g.accessors[p.attributes.POSITION];
    const mat = p.material;
    const matName = mat != null ? g.materials[mat].name : "(none)";
    console.log(
      `  prim[${pi}] material=${mat}(${matName}) count=${posAcc.count} min=${JSON.stringify(posAcc.min)} max=${JSON.stringify(posAcc.max)}`,
    );
  });
});
