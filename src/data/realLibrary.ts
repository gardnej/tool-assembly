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
  assemblyLength,
  type JointPair,
  type Matrix,
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

export interface LibraryToolRecord {
  id: string;
  libraryId: string;
  type: string;
  description: string;
  vendor: string;
  productId: string;
  unit: string;
  geometry: Record<string, number | string | boolean>;
  holder: Record<string, number | string | boolean> | null;
  geometryId: string | null;
  stepFileName: string | null;
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
export const LIBRARIES: LibraryRef[] = DATA.libraries;
export const TOOLS: LibraryToolRecord[] = DATA.tools;
export const JOINT_FRAMES: Record<string, StoredJointFrames> = DATA.jointFrames;

export const BLOCK_TYPE = "tool block";

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
  return LIBRARIES.find((library) => library.id === id);
}

export function toolsForLibrary(libraryId: string): LibraryToolRecord[] {
  return TOOLS.filter((tool) => tool.libraryId === libraryId);
}

export function toolById(id: string): LibraryToolRecord | undefined {
  return TOOLS.find((tool) => tool.id === id);
}

/** Standalone tool block items, usable as the machine-side root. */
export function toolBlocks(libraryId?: string): LibraryToolRecord[] {
  const pool = libraryId === undefined ? TOOLS : toolsForLibrary(libraryId);
  return pool.filter((tool) => isBlockType(tool.type));
}

/** Cutting tools, i.e. everything that is not itself a block. */
export function cuttingTools(libraryId?: string): LibraryToolRecord[] {
  const pool = libraryId === undefined ? TOOLS : toolsForLibrary(libraryId);
  return pool.filter((tool) => !isBlockType(tool.type));
}

/** Tools that already carry a nested tool block, i.e. existing assemblies. */
export function assemblies(libraryId?: string): LibraryToolRecord[] {
  const pool = libraryId === undefined ? TOOLS : toolsForLibrary(libraryId);
  return pool.filter((tool) => tool.block !== null);
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
 * before it has been written back to the tool.
 */
export function chainFor(
  tool: LibraryToolRecord,
  blockOverride?: LibraryToolRecord | null,
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
