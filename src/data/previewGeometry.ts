/**
 * Prototype-only library records for the one block we have a mesh for.
 *
 * These are not from Fusion. The real snapshot has no geometry anything can
 * render — the solids live in `.3DTool` files as Autodesk Shape Manager B-rep,
 * which nothing outside Autodesk reads — so this block was exported from CAD as
 * OBJ and converted to glTF for the viewer.
 *
 * The exported mesh is a whole assembly in one shared coordinate space with no
 * per-part transforms: a block body, and in each of its three seats an
 * extension, a collet inside it, and a cutting tool held through both. That is
 * why the viewer can seat a component by making a node visible rather than by
 * composing joint frames. It also means the seating is the CAD model's, not
 * Fusion's: this block carries no MCS or CSW frames, so it still cannot be
 * measured and its gauge lengths read as unknown.
 *
 * The records below are nominal. Every seat holds the same bodies whichever
 * record is chosen for it, so picking a different extension changes the label
 * and not the solid.
 *
 * Deliberately kept out of the generated snapshot, which `scripts/
 * export-library-snapshot.py` overwrites, and appended after the real records
 * so lookups that want real data still find it first.
 */

import type { LibraryRef, LibraryToolRecord, NestedBlock } from "./realLibrary";

const LIBRARY_ID = "prototype-geometry";

/** Lets real-data checks exclude these records explicitly. */
export const PREVIEW_LIBRARY_ID = LIBRARY_ID;

const BLOCK_GUID = "preview-3x-spot-drill-tap-guid";

/** Identifies the block whose mesh the viewer knows how to load. */
export const PREVIEW_BLOCK_GEOMETRY_ID = "preview-3x-spot-drill-tap";

/**
 * Parts are addressed by material because `<model-viewer>` exposes materials
 * but not nodes. `scripts/prepare-preview-model.py` puts each body on one.
 */
export const PREVIEW_BLOCK_MATERIAL = "part_0";

/** Materials of one seat, by what the part is. */
export interface PreviewSeat {
  extension: string;
  collet: string;
  /** The cutting tool is two bodies, a shank and a cutting end. */
  tool: string[];
}

/**
 * Seats of the exported mesh, in slot order.
 *
 * The export names every body `Body1`, `Body1:1` and so on, so which part is
 * which was read off the geometry with `scripts/inspect-obj.py`: parts cluster
 * into three seats by position, and within a seat they stack along the tool
 * axis. Slots are ordered by the tool each seat holds — 6 mm, 8 mm, 9.5 mm — so
 * that they read spot drill, drill, tap as the block's name does.
 */
export const PREVIEW_SEATS: PreviewSeat[] = [
  { extension: "part_1", collet: "part_6", tool: ["part_9", "part_10"] },
  { extension: "part_3", collet: "part_5", tool: ["part_7", "part_8"] },
  { extension: "part_2", collet: "part_4", tool: ["part_11", "part_12"] },
];

/** Every material of a seat, for hit-testing a click back to its level. */
export function seatMaterials(seat: PreviewSeat): string[] {
  return [seat.extension, seat.collet, ...seat.tool];
}

/** The OBJ came out in Fusion's native centimetres. */
export const PREVIEW_UNIT_SCALE_MM = 10;

export const PREVIEW_LIBRARY: LibraryRef = {
  id: LIBRARY_ID,
  name: "Prototype geometry",
  folder: null,
  breadcrumb: "Local > Prototype geometry",
  version: null,
  toolCount: 10,
  blockCount: 1,
  assemblyCount: 3,
};

/** Three seats, counted off the exported mesh rather than assumed. */
const BLOCK_GEOMETRY = { numberOfTools: 3 };

/**
 * The block as an occupant carries it. Each extension has to hold a copy for the
 * parent row to derive back to this block instead of flipping to whichever block
 * the real library's tools carry.
 */
const NESTED_BLOCK: NestedBlock = {
  guid: BLOCK_GUID,
  description: "3X Spot-Drill-Tap",
  vendor: "",
  productId: "",
  geometry: BLOCK_GEOMETRY,
  geometryId: PREVIEW_BLOCK_GEOMETRY_ID,
  stepFileName: "3X Spot-Drill-Tap.obj",
  transformOverride: null,
  postProcess: {
    stationNumber: null,
    halfIndex: null,
    live: null,
    maximumRotationalSpeed: null,
  },
};

/**
 * One prototype record.
 *
 * Only the extensions carry the nested block, because the extension is what
 * mounts in a position: that is what the parent block row derives from. Nothing
 * has a solid of its own, since every part is a body of the block's exported
 * mesh rather than a separate file.
 */
function previewRecord(
  id: string,
  type: string,
  description: string,
  { carriesBlock = false }: { carriesBlock?: boolean } = {},
): LibraryToolRecord {
  return {
    id,
    libraryId: LIBRARY_ID,
    type,
    description,
    vendor: "",
    productId: "",
    productLink: "",
    unit: "millimeters",
    geometry: {},
    holder: null,
    geometryId: null,
    stepFileName: null,
    segments: null,
    gaugeLength: null,
    postProcess: {
      number: null,
      turret: null,
      compensationOffset: null,
      // Left unset so positions take their station from row order.
      stationNumber: null,
      halfIndex: null,
    },
    block: carriesBlock ? NESTED_BLOCK : null,
  };
}

export const PREVIEW_TOOLS: LibraryToolRecord[] = [
  {
    id: "preview-block-3x-spot-drill-tap",
    libraryId: LIBRARY_ID,
    type: "tool block",
    description: "3X Spot-Drill-Tap",
    vendor: "",
    productId: "",
    productLink: "",
    unit: "millimeters",
    geometry: BLOCK_GEOMETRY,
    holder: null,
    geometryId: PREVIEW_BLOCK_GEOMETRY_ID,
    stepFileName: "3X Spot-Drill-Tap.obj",
    segments: null,
    gaugeLength: null,
    postProcess: {
      number: null,
      turret: null,
      compensationOffset: null,
      stationNumber: null,
      halfIndex: null,
    },
    block: null,
  },
  previewRecord("preview-extension-6", "extension", "Extension ⌀6", { carriesBlock: true }),
  previewRecord("preview-extension-8", "extension", "Extension ⌀8", { carriesBlock: true }),
  previewRecord("preview-extension-10", "extension", "Extension ⌀10", { carriesBlock: true }),

  previewRecord("preview-collet-6", "collet", "Collet ⌀6"),
  previewRecord("preview-collet-8", "collet", "Collet ⌀8"),
  previewRecord("preview-collet-10", "collet", "Collet ⌀10"),

  previewRecord("preview-tool-spot-drill", "drill", "Spot drill ⌀6"),
  previewRecord("preview-tool-drill", "drill", "Drill ⌀8"),
  previewRecord("preview-tool-tap", "tap", "Tap M10"),
];
