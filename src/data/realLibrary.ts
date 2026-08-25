/**
 * Access to the real Fusion tool libraries, snapshotted from disk.
 *
 * The snapshot keeps Fusion's own schema rather than a reshaped one: real tool
 * `type` strings, the nested `block` a cutting tool carries, `postProcess`
 * fields such as `stationNumber` and `halfIndex`, and the MCS/CSW joint frames
 * Fusion extracted from each STEP file.
 *
 * Regenerate with `python3 scripts/export-library-snapshot.py`.
 */

import snapshot from "./realLibrarySnapshot.json";
import {
  applyLibraryRename,
  applyToolEdit,
  isLibraryHidden,
  sessionLibraries,
  sessionTools,
} from "./libraryEdits";
import { PREVIEW_LIBRARY, PREVIEW_TOOLS } from "./previewGeometry";
import {
  assemblyLength,
  chainPlacements,
  multiply,
  originOf,
  type JointPair,
  type Matrix,
  type Vector,
} from "./joints";

export interface LibraryRef {
  id: string;
  name: string;
  folder: string | null;
  breadcrumb: string;
  version: number | null;
  toolCount: number;
  blockCount: number;
  assemblyCount: number;
  /**
   * Which User Libraries parent the library sits under.
   *
   * Real libraries exported from Fusion always sit under ``local``; session
   * libraries created by the app itself (saved assemblies, for one) can
   * declare a different parent so the tree groups them alongside Fusion's
   * own ``Documents`` and ``Cloud`` roots.
   */
  parent?: "local" | "documents" | "cloud";
}

export interface BlockPostProcess {
  stationNumber: number | null;
  halfIndex: boolean | null;
  live: boolean | null;
  maximumRotationalSpeed: number | null;
}

export interface TransformOverride {
  rotation: { x: number; y: number; z: number };
  translation: { x: number; y: number; z: number };
}

/** The tool block a cutting tool carries inline, per Fusion's schema. */
export interface NestedBlock {
  guid: string;
  description: string;
  vendor: string;
  productId: string;
  geometry: Record<string, number | string | boolean>;
  geometryId: string | null;
  stepFileName: string | null;
  transformOverride: TransformOverride | null;
  postProcess: BlockPostProcess;
}

export interface ToolPostProcess {
  number: number | null;
  turret: number | null;
  compensationOffset: number | null;
  stationNumber: number | null;
  halfIndex: boolean | null;
}

/** One frustum of an adaptive item, machine-side first. Heights are millimetres. */
export interface HolderSegment {
  height: number;
  "lower-diameter": number;
  "upper-diameter": number;
}

export interface LibraryToolRecord {
  id: string;
  libraryId: string;
  type: string;
  description: string;
  vendor: string;
  productId: string;
  productLink: string;
  unit: string;
  geometry: Record<string, number | string | boolean>;
  holder: Record<string, number | string | boolean> | null;
  geometryId: string | null;
  stepFileName: string | null;
  /**
   * Frusta describing an adaptive item's profile. Empty for cutting tools and
   * standalone holders, since those are described by their `geometry` fields.
   */
  segments: HolderSegment[] | null;
  /** Fusion's own gauge length for an adaptive item, in millimetres. */
  gaugeLength: number | null;
  postProcess: ToolPostProcess;
  block: NestedBlock | null;
}

export interface StoredJointFrames {
  stepFileName: string | null;
  /** Machine-side mounting frame, row-major 4x4 in millimetres. */
  mcs: Matrix | null;
  /** Cutting/workpiece-side frame, row-major 4x4 in millimetres. */
  csw: Matrix | null;
}

interface Snapshot {
  generatedAt: string;
  source: string;
  libraries: LibraryRef[];
  tools: LibraryToolRecord[];
  jointFrames: Record<string, StoredJointFrames>;
}

const DATA = snapshot as unknown as Snapshot;

export const SNAPSHOT_GENERATED_AT = DATA.generatedAt;

// Prototype-only records come last so anything scanning for real data still
// meets the snapshot's own items first. See `previewGeometry.ts`.
/** The libraries as exported. Read them through `libraries()` to see renames. */
export const LIBRARIES: LibraryRef[] = [...DATA.libraries, PREVIEW_LIBRARY];
/** The records as exported. Read them through `libraryTools()` to see edits. */
export const TOOLS: LibraryToolRecord[] = [...DATA.tools, ...PREVIEW_TOOLS];
export const JOINT_FRAMES: Record<string, StoredJointFrames> = DATA.jointFrames;

/** Every record, with whatever the tool editor changed this session applied. */
export function libraryTools(): LibraryToolRecord[] {
  return [...TOOLS, ...sessionTools()]
    .filter((tool) => !isLibraryHidden(tool.libraryId))
    .map(applyToolEdit);
}

/** Every library, under whatever it was renamed to this session. */
export function libraries(): LibraryRef[] {
  return [...LIBRARIES, ...sessionLibraries()]
    .filter((library) => !isLibraryHidden(library.id))
    .map(applyLibraryRename);
}

export const BLOCK_TYPE = "tool block";

/**
 * Adaptive items: components that adapt a position to a tool rather than cut.
 *
 * An extension mounts in a position on the block and packs it out; a collet sits
 * in the extension and grips the tool. Neither removes material, which is why
 * they are listed apart from the cutting tools.
 */
export const ADAPTIVE_TYPES: Record<"extension" | "collet", string> = {
  extension: "extension",
  collet: "collet",
};

/**
 * Whether a record plays an adaptive role in a position.
 *
 * Fusion tags a modern mill-drill extension or collet as ``type: "holder"``
 * with a ``segments`` array, not as ``type: "extension"``/``"collet"``, so
 * anything with segments is treated as adaptive as well. Turning holders never
 * carry segments — their profile is on their nested ``holder`` object — so
 * they still fall through to the cutting-tool side.
 */
export function isAdaptiveType(type: string): boolean {
  return type === ADAPTIVE_TYPES.extension || type === ADAPTIVE_TYPES.collet;
}

export function isAdaptiveRecord(record: LibraryToolRecord): boolean {
  if (isAdaptiveType(record.type)) return true;
  return record.type === "holder" && Array.isArray(record.segments);
}

/**
 * Whether an adaptive record acts as a collet — the part inside an extension
 * that grips the tool — rather than as the extension itself.
 *
 * Fusion does not tag it explicitly, but the description always names it,
 * because the same solid can be sold as both roles and the record makes the
 * choice.
 */
export function isColletRecord(record: LibraryToolRecord): boolean {
  if (record.type === ADAPTIVE_TYPES.collet) return true;
  return record.type === "holder" && /collet/i.test(record.description);
}

/**
 * Gauge length Fusion has already computed for this record.
 *
 * Milling and drilling records carry an ``assemblyGaugeLength`` on their
 * geometry that is what Fusion itself shows in its Manufacture tab; extension-
 * style holders carry a top-level ``gaugeLength`` for their own reach. Where
 * both are absent this reader returns null and callers fall back to measuring
 * through the joint chain.
 */
export function storedGaugeLengthMm(record: LibraryToolRecord): number | null {
  const geo = record.geometry as Record<string, number | string | boolean>;
  const assembly = geo["assemblyGaugeLength"];
  if (typeof assembly === "number" && Number.isFinite(assembly)) return assembly;
  const own = record.gaugeLength;
  if (typeof own === "number" && Number.isFinite(own)) return own;
  return null;
}

/** Turning types carry a holder that takes part in the joint chain. */
const TURNING_TYPES = new Set([
  "turning general",
  "turning threading",
  "turning grooving",
  "turning boring",
  "turning drill",
  "turning tap",
]);

export function isBlockType(type: string): boolean {
  return type === BLOCK_TYPE;
}

export function isTurningType(type: string): boolean {
  return TURNING_TYPES.has(type);
}

export function libraryById(id: string): LibraryRef | undefined {
  const library = LIBRARIES.find((entry) => entry.id === id);
  return library === undefined ? undefined : applyLibraryRename(library);
}

export function toolsForLibrary(libraryId: string): LibraryToolRecord[] {
  return libraryTools().filter((tool) => tool.libraryId === libraryId);
}

export function toolById(id: string): LibraryToolRecord | undefined {
  const record = TOOLS.find((tool) => tool.id === id);
  return record === undefined ? undefined : applyToolEdit(record);
}

/** Standalone tool block items, usable as the machine-side root. */
export function toolBlocks(libraryId?: string): LibraryToolRecord[] {
  const pool = libraryId === undefined ? libraryTools() : toolsForLibrary(libraryId);
  return pool.filter((tool) => isBlockType(tool.type));
}

/** Cutting tools: everything that is neither a block nor an adaptive item. */
export function cuttingTools(libraryId?: string): LibraryToolRecord[] {
  const pool = libraryId === undefined ? libraryTools() : toolsForLibrary(libraryId);
  return pool.filter((tool) => !isBlockType(tool.type) && !isAdaptiveRecord(tool));
}

/** Adaptive items of one kind, for the level of a position that takes them. */
export function adaptiveItems(
  kind: "extension" | "collet",
  libraryId?: string,
): LibraryToolRecord[] {
  const pool = libraryId === undefined ? libraryTools() : toolsForLibrary(libraryId);
  return pool.filter((tool) => {
    if (!isAdaptiveRecord(tool)) return false;
    return kind === "collet" ? isColletRecord(tool) : !isColletRecord(tool);
  });
}

/** Tools that already carry a nested tool block, i.e. existing assemblies. */
export function assemblies(libraryId?: string): LibraryToolRecord[] {
  const pool = libraryId === undefined ? libraryTools() : toolsForLibrary(libraryId);
  return pool.filter((tool) => tool.block !== null);
}

/** A parent tool block implied by the tools that carry a copy of it. */
export interface DerivedBlock {
  /** Grouping key, normally the block guid Fusion stores in every copy. */
  key: string;
  block: NestedBlock;
  /** Positions of the occupants that imply this block, in first-use order. */
  occupants: number[];
}

function blockKey(block: NestedBlock, fallback: string): string {
  if (block.guid.trim() !== "") return block.guid;
  if (block.description.trim() !== "") return block.description;
  return fallback;
}

/**
 * The parent tool blocks a set of occupants implies, grouped by block guid.
 *
 * Fusion has no record that says a block holds these tools — each tool holds a
 * copy of the block instead — so the parent row has to be read back out of the
 * occupants. More than one entry means the occupants disagree about which block
 * they sit in, which is a conflict rather than a two-block assembly.
 */
export function derivedBlocks(
  occupants: (LibraryToolRecord | null | undefined)[],
): DerivedBlock[] {
  const list: DerivedBlock[] = [];
  const byKey = new Map<string, DerivedBlock>();

  occupants.forEach((tool, index) => {
    const block = tool?.block;
    if (block == null) return;

    const key = blockKey(block, `row-${index}`);
    let entry = byKey.get(key);
    if (entry === undefined) {
      entry = { key, block, occupants: [] };
      byKey.set(key, entry);
      list.push(entry);
    } else if (
      entry.block.description.trim() === "" &&
      block.description.trim() !== ""
    ) {
      // Copies of one block do not always agree about their description in real
      // data, so the named copy represents the group and reordering rows cannot
      // rename the parent.
      entry.block = block;
    }
    entry.occupants.push(index);
  });

  return list;
}

/** Seats a block declares it can hold, from its own `numberOfTools` field. */
export function blockCapacity(block: NestedBlock): number | null {
  const value = block.geometry.numberOfTools;
  return typeof value === "number" ? value : null;
}

/**
 * Best available label. Real library items often leave `description` empty, so
 * fall back through the other identifying fields before showing a bare type.
 */
export function displayName(tool: LibraryToolRecord): string {
  if (tool.description.trim() !== "") return tool.description;
  if (tool.productId.trim() !== "") return tool.productId;
  if (tool.stepFileName != null && tool.stepFileName.trim() !== "") {
    return tool.stepFileName.replace(/\.(stp|step)$/i, "");
  }
  const number = tool.postProcess.number;
  return number !== null ? `${tool.type} #${number}` : tool.type;
}

export function framesFor(geometryId: string | null): StoredJointFrames | undefined {
  if (geometryId === null) return undefined;
  return JOINT_FRAMES[geometryId];
}

export function hasCompleteFrames(frames: StoredJointFrames | undefined): boolean {
  return frames !== undefined && frames.mcs !== null && frames.csw !== null;
}

function jointPair(frames: StoredJointFrames): JointPair | null {
  if (frames.mcs === null || frames.csw === null) return null;
  return [frames.mcs, frames.csw];
}

/** Machine-side to cutting-side distance for one stored solid, in millimetres. */
export function solidSpanMm(geometryId: string | null): number | null {
  const frames = framesFor(geometryId);
  if (frames === undefined) return null;
  const pair = jointPair(frames);
  if (pair === null) return null;
  return assemblyLength([pair]);
}

/** One element of an assembly, ordered machine side first. */
export interface ChainComponent {
  role: "block" | "holder";
  name: string;
  geometryId: string | null;
  frames: StoredJointFrames | undefined;
  spanMm: number | null;
}

/**
 * The assembly chain for a cutting tool: its nested block, then the tool itself.
 *
 * A block may also be supplied separately, for a chain being assembled in the UI
 * before it has been written back to the tool. Adaptive items sit between the
 * two, in the order they are mounted, since a tool reaches the block through
 * them and the stack-up has to be measured the same way.
 */
export function chainFor(
  tool: LibraryToolRecord,
  blockOverride?: LibraryToolRecord | null,
  adaptive: LibraryToolRecord[] = [],
): ChainComponent[] {
  const components: ChainComponent[] = [];

  const blockGeometryId =
    tool.block?.geometryId ?? blockOverride?.geometryId ?? null;
  const blockName =
    tool.block !== null && tool.block.description.trim() !== ""
      ? tool.block.description
      : blockOverride !== null && blockOverride !== undefined
        ? displayName(blockOverride)
        : tool.block?.stepFileName ?? "Tool block";

  if (blockGeometryId !== null || tool.block !== null || blockOverride) {
    components.push({
      role: "block",
      name: blockName,
      geometryId: blockGeometryId,
      frames: framesFor(blockGeometryId),
      spanMm: solidSpanMm(blockGeometryId),
    });
  }

  for (const item of adaptive) {
    components.push({
      role: "holder",
      name: displayName(item),
      geometryId: item.geometryId,
      frames: framesFor(item.geometryId),
      spanMm: solidSpanMm(item.geometryId),
    });
  }

  components.push({
    role: "holder",
    name: displayName(tool),
    geometryId: tool.geometryId,
    frames: framesFor(tool.geometryId),
    spanMm: solidSpanMm(tool.geometryId),
  });

  return components;
}

/**
 * The chain for one position of a block: the block, then the stack mounted in
 * it, machine side first.
 *
 * The stack is however much of the extension, collet and tool has been chosen so
 * far, so a half-built position still measures as far as it goes.
 */
export function stackChain(
  stack: LibraryToolRecord[],
  blockOverride?: LibraryToolRecord | null,
): ChainComponent[] {
  if (stack.length === 0) return [];
  const last = stack[stack.length - 1];
  return chainFor(last, blockOverride, stack.slice(0, -1));
}

/**
 * Measured stack-up of a chain in millimetres, from stored joint frames.
 *
 * Returns null when any component lacks an MCS or CSW frame, because a chain
 * cannot be measured through a gap.
 */
export function measuredStackUpMm(components: ChainComponent[]): number | null {
  if (components.length === 0) return null;

  const chain: JointPair[] = [];
  for (const component of components) {
    if (component.frames === undefined) return null;
    const pair = jointPair(component.frames);
    if (pair === null) return null;
    chain.push(pair);
  }

  return assemblyLength(chain);
}

/**
 * Gauge length for each component: how far it reaches past the tool block's
 * face, in millimetres, positionally matching `components`.
 *
 * The block is what everything else mounts on rather than something that sticks
 * out of it, so it has no gauge length of its own. A frame gap anywhere makes
 * the whole chain unplaceable, so every entry comes back null together.
 */
export function gaugeLengthsMm(
  components: ChainComponent[],
): (number | null)[] {
  const pairs: JointPair[] = [];
  for (const component of components) {
    const pair = component.frames === undefined ? null : jointPair(component.frames);
    if (pair === null) return components.map(() => null);
    pairs.push(pair);
  }

  const placements = chainPlacements(pairs);
  const blockIndex = components.findIndex((component) => component.role === "block");

  // Without a block the turret face is the only datum available.
  const datum: Vector =
    blockIndex === -1
      ? [0, 0, 0]
      : originOf(multiply(placements[blockIndex], pairs[blockIndex][1]));

  return components.map((_, index) => {
    if (index <= blockIndex) return null;
    const tip = originOf(multiply(placements[index], pairs[index][1]));
    return Math.hypot(tip[0] - datum[0], tip[1] - datum[1], tip[2] - datum[2]);
  });
}

/**
 * Gauge length of one occupant of a block, in millimetres.
 *
 * Each occupant is measured through its own chain — the block, then the tool —
 * because a block seats every one of its tools against the same cutting face.
 */
export function occupantGaugeLengthMm(
  tool: LibraryToolRecord,
  blockOverride?: LibraryToolRecord | null,
): number | null {
  const components = chainFor(tool, blockOverride);
  const index = components.findIndex((component) => component.role === "holder");
  if (index === -1) return null;
  return gaugeLengthsMm(components)[index];
}

/** Which joint frame a component is missing, for reporting gaps. */
export function missingFrameLabel(
  component: ChainComponent,
): "MCS" | "CSW" | "geometry" | null {
  if (component.frames === undefined) return "geometry";
  if (component.frames.mcs === null) return "MCS";
  if (component.frames.csw === null) return "CSW";
  return null;
}

/** Turret station for a tool, from whichever post-process block defines it. */
export function stationNumber(tool: LibraryToolRecord): number | null {
  return tool.block?.postProcess.stationNumber ?? tool.postProcess.stationNumber;
}

export function isHalfIndex(tool: LibraryToolRecord): boolean {
  return tool.block?.postProcess.halfIndex === true;
}
