/**
 * Runtime GLB composition — merge extra solids into the turret model.
 *
 * `<model-viewer>` loads a single glTF, so to show the *actual* solid of the
 * assembly a user mounts on a station we build a new GLB in the browser: the
 * base turret, plus each mounted assembly's solid parented under a node whose
 * transform seats it on that station. The result is handed to model-viewer as a
 * Blob URL, reusing its lighting, camera and hotspots without any new runtime
 * dependency (three.js and friends).
 *
 * The merger is intentionally scoped to the shape our GLBs actually take, all
 * produced by `scripts/obj-to-glb.py` or the STEP converter: a single buffer,
 * no images/textures/samplers/animations/skins, only POSITION/NORMAL accessors
 * and simple `pbrMetallicRoughness` materials. It does not attempt to be a
 * general glTF merger.
 */

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"

/** Column-major 4×4, glTF node.matrix order. */
export type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

interface Gltf {
  scene?: number;
  scenes: { nodes: number[] }[];
  nodes: GltfNode[];
  meshes: GltfMesh[];
  materials?: unknown[];
  accessors: GltfAccessor[];
  bufferViews: GltfBufferView[];
  buffers: { byteLength: number; uri?: string }[];
  [key: string]: unknown;
}

interface GltfNode {
  mesh?: number;
  children?: number[];
  matrix?: number[];
  [key: string]: unknown;
}

interface GltfMesh {
  primitives: {
    attributes: Record<string, number>;
    indices?: number;
    material?: number;
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}

interface GltfAccessor {
  bufferView?: number;
  [key: string]: unknown;
}

interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  [key: string]: unknown;
}

interface ParsedGlb {
  json: Gltf;
  bin: Uint8Array;
}

function pad4(n: number): number {
  return (n + 3) & ~3;
}

/** Parse a GLB buffer into its json + binary chunk (binary copied out). */
function parseGlb(buffer: ArrayBuffer): ParsedGlb {
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error("not a GLB (bad magic)");
  }
  const length = dv.getUint32(8, true);
  let offset = 12;
  let json: Gltf | null = null;
  let bin: Uint8Array | null = null;
  const decoder = new TextDecoder();
  while (offset < length) {
    const chunkLength = dv.getUint32(offset, true);
    const chunkType = dv.getUint32(offset + 4, true);
    offset += 8;
    const chunk = new Uint8Array(buffer, offset, chunkLength);
    if (chunkType === CHUNK_JSON) {
      json = JSON.parse(decoder.decode(chunk)) as Gltf;
    } else if (chunkType === CHUNK_BIN) {
      bin = chunk.slice();
    }
    offset += chunkLength;
  }
  if (json === null) throw new Error("GLB has no JSON chunk");
  return { json, bin: bin ?? new Uint8Array(0) };
}

async function loadGlb(url: string): Promise<ParsedGlb> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`fetch ${url}: ${response.status}`);
  return parseGlb(await response.arrayBuffer());
}

/**
 * Merge `add` into `base` (mutating `base`), parenting the addition's scene
 * roots under a new node carrying `matrix`. Both are assumed single-buffer.
 *
 * When `keepMaterials` is given, only primitives whose material is named in the
 * set are carried over (primitives with no material are always kept). This lets
 * a seatable block mesh — one body per part, each on its own named material —
 * mount showing just the block and the tools the assembly actually fills, the
 * same way the assembly editor reveals seats by material.
 */
function mergeInto(
  base: ParsedGlb,
  add: ParsedGlb,
  matrix: Mat4,
  keepMaterials?: ReadonlySet<string>,
): void {
  const bj = base.json;
  const aj = add.json;
  const addMaterials = (aj.materials ?? []) as { name?: string }[];
  const keepPrimitive = (material: number | undefined): boolean => {
    if (keepMaterials === undefined || material === undefined) return true;
    const name = addMaterials[material]?.name;
    return name === undefined ? true : keepMaterials.has(name);
  };

  const padBaseLen = pad4(base.bin.length);
  const accOffset = bj.accessors.length;
  const bvOffset = bj.bufferViews.length;
  const meshOffset = bj.meshes.length;
  const nodeOffset = bj.nodes.length;
  if (bj.materials === undefined) bj.materials = [];
  const matOffset = bj.materials.length;

  // Buffer views: repoint into buffer 0, shifted past the base's (padded) bin.
  for (const bv of aj.bufferViews) {
    bj.bufferViews.push({
      ...bv,
      buffer: 0,
      byteOffset: (bv.byteOffset ?? 0) + padBaseLen,
    });
  }

  // Accessors: remap their buffer view.
  for (const accessor of aj.accessors) {
    bj.accessors.push({
      ...accessor,
      bufferView:
        accessor.bufferView === undefined ? undefined : accessor.bufferView + bvOffset,
    });
  }

  // Materials: appended verbatim.
  for (const material of aj.materials ?? []) {
    bj.materials.push(material);
  }

  // Meshes: remap accessor + material indices on every primitive, dropping any
  // whose material the caller asked to hide.
  for (const mesh of aj.meshes) {
    bj.meshes.push({
      ...mesh,
      primitives: mesh.primitives
        .filter((primitive) => keepPrimitive(primitive.material))
        .map((primitive) => {
          const attributes: Record<string, number> = {};
          for (const [key, index] of Object.entries(primitive.attributes)) {
            attributes[key] = index + accOffset;
          }
          return {
            ...primitive,
            attributes,
            indices: primitive.indices === undefined ? undefined : primitive.indices + accOffset,
            material: primitive.material === undefined ? undefined : primitive.material + matOffset,
          };
        }),
    });
  }

  // Nodes: remap mesh + children indices, keeping any internal transforms.
  for (const node of aj.nodes) {
    const next: GltfNode = { ...node };
    if (next.mesh !== undefined) next.mesh += meshOffset;
    if (next.children !== undefined) next.children = next.children.map((c) => c + nodeOffset);
    bj.nodes.push(next);
  }

  // Wrapper node seats the addition's roots as one unit on the station.
  const addScene = aj.scenes?.[aj.scene ?? 0];
  const roots = (addScene?.nodes ?? aj.nodes.map((_, i) => i)).map((i) => i + nodeOffset);
  bj.nodes.push({ matrix: [...matrix], children: roots, name: "mounted" });
  const wrapperIndex = bj.nodes.length - 1;
  const baseScene = bj.scenes[bj.scene ?? 0];
  baseScene.nodes.push(wrapperIndex);

  // Binary: base (padded to 4) followed by the addition's bin.
  const merged = new Uint8Array(padBaseLen + add.bin.length);
  merged.set(base.bin, 0);
  merged.set(add.bin, padBaseLen);
  base.bin = merged;
  bj.buffers[0].byteLength = merged.length;
}

/** Serialize a parsed GLB back into a binary Blob. */
function serializeGlb({ json, bin }: ParsedGlb): Blob {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadded = pad4(jsonBytes.length);
  const binPadded = pad4(bin.length);
  const total = 12 + 8 + jsonPadded + 8 + binPadded;

  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, GLB_MAGIC, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);

  let offset = 12;
  dv.setUint32(offset, jsonPadded, true);
  dv.setUint32(offset + 4, CHUNK_JSON, true);
  offset += 8;
  out.set(jsonBytes, offset);
  // Pad the JSON chunk with spaces, per the GLB spec.
  for (let i = jsonBytes.length; i < jsonPadded; i += 1) out[offset + i] = 0x20;
  offset += jsonPadded;

  dv.setUint32(offset, binPadded, true);
  dv.setUint32(offset + 4, CHUNK_BIN, true);
  offset += 8;
  out.set(bin, offset);
  // Trailing bin padding is already zero-filled.

  return new Blob([out], { type: "model/gltf-binary" });
}

export interface SolidPlacement {
  /** URL of the solid GLB to mount. */
  url: string;
  /** Column-major transform seating the solid on its station. */
  matrix: Mat4;
  /**
   * If set, only primitives on these named materials are merged (untextured
   * primitives with no material are always kept). Used to mount a seatable
   * block mesh showing just the block and the seats the assembly fills.
   */
  keepMaterials?: string[];
}

/** Cache parsed source GLBs so recomposition only reparses on first use. */
const glbCache = new Map<string, Promise<ParsedGlb>>();

function loadGlbCached(url: string): Promise<ParsedGlb> {
  const existing = glbCache.get(url);
  if (existing !== undefined) return existing;
  const promise = loadGlb(url);
  glbCache.set(url, promise);
  return promise;
}

/** Deep-ish clone of a parsed GLB so merges never mutate the cached source. */
function cloneParsed(parsed: ParsedGlb): ParsedGlb {
  return {
    json: JSON.parse(JSON.stringify(parsed.json)) as Gltf,
    bin: parsed.bin.slice(),
  };
}

/**
 * Compose the base turret with any mounted solids and return an object URL for
 * the merged GLB. Callers own the URL and should revoke it when replaced.
 */
export async function composeTurretGlb(
  baseUrl: string,
  placements: SolidPlacement[],
): Promise<string> {
  const base = cloneParsed(await loadGlbCached(baseUrl));
  for (const placement of placements) {
    const add = cloneParsed(await loadGlbCached(placement.url));
    const keep =
      placement.keepMaterials === undefined ? undefined : new Set(placement.keepMaterials);
    mergeInto(base, add, placement.matrix, keep);
  }
  return URL.createObjectURL(serializeGlb(base));
}
