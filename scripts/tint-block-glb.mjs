// Pure-Node GLB material re-tint (no external deps; npm registry was unreachable
// in this environment). Rewrites the JSON chunk's baseColorFactor/metallic/
// roughness for selected materials and re-emits a valid GLB (re-padded chunks,
// corrected chunk + container lengths). Geometry/accessors/nodes are untouched.
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2] ?? "src/assets/models/toolblock-3x-clean.glb";
const buf = readFileSync(path);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");

// --- split container into chunks ---
let off = 12;
let jsonChunk = null;
let binChunk = null;
while (off < buf.length) {
  const clen = buf.readUInt32LE(off);
  const ctype = buf.readUInt32LE(off + 4);
  const data = buf.subarray(off + 8, off + 8 + clen);
  if (ctype === 0x4e4f534a) jsonChunk = data;
  else if (ctype === 0x004e4942) binChunk = data;
  off += 8 + clen;
}
if (jsonChunk === null) throw new Error("no JSON chunk");

const g = JSON.parse(Buffer.from(jsonChunk).toString("utf8"));

// --- desired colors ---
// Medium steel/cornflower blue. Deepened & de-saturated toward blue (lower R/G,
// held B) so it reads as a solid medium blue rather than pale cyan under
// model-viewer's bright neutral IBL + tone mapping (which washes light colors).
const BLUE = [0.16, 0.34, 0.74, 1.0]; // block body
const GOLD = [0.83, 0.69, 0.22, 1.0]; // drill/tap cutting tools

function setMat(idx, baseColor, metallic, roughness) {
  const m = g.materials[idx];
  m.pbrMetallicRoughness = m.pbrMetallicRoughness ?? {};
  m.pbrMetallicRoughness.baseColorFactor = baseColor;
  if (metallic !== undefined) m.pbrMetallicRoughness.metallicFactor = metallic;
  if (roughness !== undefined) m.pbrMetallicRoughness.roughnessFactor = roughness;
}

// mat_0 = EWS_222115_DIN4003 block body -> blue.
setMat(0, BLUE, 0.1, 0.6);
// mat_3 = TPGN tap insert tip, mat_4 = drill/tap flute bodies (cantilever) -> gold.
setMat(3, GOLD, 0.6, 0.4);
setMat(4, GOLD, 0.6, 0.4);
// mat_1 (collets/shanks) and mat_2 (ER16 springs) left as authored metal gray.

// --- re-emit GLB ---
let newJson = Buffer.from(JSON.stringify(g), "utf8");
const jsonPad = (4 - (newJson.length % 4)) % 4;
if (jsonPad) newJson = Buffer.concat([newJson, Buffer.alloc(jsonPad, 0x20)]); // space pad

let bin = binChunk ?? Buffer.alloc(0);
const binPad = (4 - (bin.length % 4)) % 4;
if (binPad) bin = Buffer.concat([bin, Buffer.alloc(binPad, 0x00)]);

const hasBin = binChunk !== null;
const total = 12 + 8 + newJson.length + (hasBin ? 8 + bin.length : 0);
const out = Buffer.alloc(total);
out.writeUInt32LE(0x46546c67, 0); // magic glTF
out.writeUInt32LE(2, 4); // version
out.writeUInt32LE(total, 8);
let p = 12;
out.writeUInt32LE(newJson.length, p); p += 4;
out.writeUInt32LE(0x4e4f534a, p); p += 4; // "JSON"
newJson.copy(out, p); p += newJson.length;
if (hasBin) {
  out.writeUInt32LE(bin.length, p); p += 4;
  out.writeUInt32LE(0x004e4942, p); p += 4; // "BIN\0"
  bin.copy(out, p); p += bin.length;
}

writeFileSync(path, out);
console.log(`Wrote ${path} (${out.length} bytes)`);
console.log("mat_0 ->", BLUE, "(block body, blue)");
console.log("mat_3, mat_4 ->", GOLD, "(drill/tap cutting tools, gold)");
console.log("mat_1, mat_2 -> unchanged (collets/springs/shanks)");
