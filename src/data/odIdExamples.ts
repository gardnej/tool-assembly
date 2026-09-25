/**
 * User-provided OD/ID example library, ingested from a real Fusion `.tools`
 * library plus its `.3DTool` joint frames and assembly STEP files.
 *
 * Kept out of the generated `realLibrarySnapshot.json` (which
 * `scripts/export-library-snapshot.py` overwrites) so a regenerated export does
 * not clobber it — merged after the snapshot in `realLibrary.ts`, mirroring how
 * `previewGeometry.ts` is appended.
 *
 * Regenerate with `python3 scripts/ingest-od-id-examples.py`.
 *
 * Two blocks are physically DUAL: their `numberOfTools` is faked to 2 and a
 * second cutting tool is synthesised (sharing the block guid so the parent row
 * derives to one block, Model C). Those derived rows are labelled "(derived)".
 *
 * PRESENTATION: the ingested records are one flat Fusion library, but the
 * prototype surfaces them as two libraries under a "Tool Assembly" folder in
 * the Hub — `Tool Blocks` (the machine-side blocks) and `Tools` (the cutting
 * tools that mount on them). Each record's `libraryId` is reassigned here so
 * the split is invisible to the rest of the app. See `positionColours.ts` and
 * `ToolLibraryDialog` for the tree.
 */

import data from "./odIdExamples.json";
import type { LibraryRef, LibraryToolRecord, StoredJointFrames } from "./realLibrary";

/** Library ids for the two split libraries and the folder that groups them. */
export const OD_ID_BLOCKS_LIBRARY_ID = "od-id-blocks";
export const OD_ID_TOOLS_LIBRARY_ID = "od-id-tools";
const TOOL_ASSEMBLY_FOLDER = "Tool Assembly";

/**
 * Geometry ids of the OD/ID example blocks we ship a baked solid for.
 *
 * Must stay in step with `OD_ID_BLOCK_SOLIDS` (turretSolids.ts) and the preview
 * map in `ToolLibrarySolidPreview.tsx` — those are the only blocks with a real
 * 3D solid. Any OTHER example *tool block* (e.g. `20MM OD_SINGLE`, whose Fusion
 * STEP was never converted) would only ever render the "No solid to show"
 * placeholder, so we hide it from the library rather than let it be picked.
 */
const OD_ID_BLOCKS_WITH_SOLID = new Set<string>([
  "3ac2ff71-0a7a-4fa9-80b4-ee79740f884f", // 20MM ID_DUAL
  "60a88fbe-b190-408d-9fb4-81510f603e94", // 25MM OD_DUAL
]);

const ALL_OD_ID_TOOLS = data.tools as unknown as LibraryToolRecord[];

const isBlockRecord = (record: LibraryToolRecord): boolean =>
  record.type === "tool block";

/**
 * The tool-block records, kept only when we ship a baked solid for them, with
 * their `libraryId` repointed at the `Tool Blocks` library.
 */
const BLOCK_RECORDS: LibraryToolRecord[] = ALL_OD_ID_TOOLS.filter(
  (record) =>
    isBlockRecord(record) &&
    record.geometryId !== null &&
    OD_ID_BLOCKS_WITH_SOLID.has(record.geometryId),
).map((record) => ({ ...record, libraryId: OD_ID_BLOCKS_LIBRARY_ID }));

/**
 * The cutting-tool records (everything that isn't a block), repointed at the
 * `Tools` library. Adaptive items would stay here too, but the OD/ID examples
 * carry none.
 */
const TOOL_RECORDS: LibraryToolRecord[] = ALL_OD_ID_TOOLS.filter(
  (record) => !isBlockRecord(record),
).map((record) => ({ ...record, libraryId: OD_ID_TOOLS_LIBRARY_ID }));

/** Every OD/ID record, blocks first, with libraryIds already reassigned. */
export const OD_ID_TOOLS: LibraryToolRecord[] = [...BLOCK_RECORDS, ...TOOL_RECORDS];

export const OD_ID_BLOCKS_LIBRARY: LibraryRef = {
  id: OD_ID_BLOCKS_LIBRARY_ID,
  name: "Tool Blocks",
  folder: TOOL_ASSEMBLY_FOLDER,
  breadcrumb: "User Libraries > Hub > Tool Assembly > Tool Blocks",
  version: null,
  toolCount: 0,
  blockCount: BLOCK_RECORDS.length,
  assemblyCount: 0,
  parent: "hub",
};

export const OD_ID_TOOLS_LIBRARY: LibraryRef = {
  id: OD_ID_TOOLS_LIBRARY_ID,
  name: "Tools",
  folder: TOOL_ASSEMBLY_FOLDER,
  breadcrumb: "User Libraries > Hub > Tool Assembly > Tools",
  version: null,
  toolCount: TOOL_RECORDS.length,
  blockCount: 0,
  assemblyCount: 0,
  parent: "hub",
};

/** Both split libraries, in tree order (blocks before tools). */
export const OD_ID_LIBRARIES: LibraryRef[] = [
  OD_ID_BLOCKS_LIBRARY,
  OD_ID_TOOLS_LIBRARY,
];

export const OD_ID_JOINT_FRAMES: Record<string, StoredJointFrames> =
  data.jointFrames as unknown as Record<string, StoredJointFrames>;

/**
 * The cutting tools compatible with a given block, addressed by the block's
 * `geometryId`.
 *
 * The data has no generic "this tool fits this block" model: each cutting tool
 * carries a copy of the one block it was paired with in Fusion (its nested
 * `block.geometryId`). So a block's compatible tools are exactly those whose
 * carried block matches it. Used to restrict the position tool picker to tools
 * that actually seat on the chosen block. Returns an empty set for blocks that
 * are not OD/ID examples (they fall back to their own library's tools).
 */
export function compatibleToolIdsForBlock(
  blockGeometryId: string | null,
): Set<string> {
  if (blockGeometryId === null) return new Set();
  return new Set(
    TOOL_RECORDS.filter(
      (record) => record.block?.geometryId === blockGeometryId,
    ).map((record) => record.id),
  );
}
