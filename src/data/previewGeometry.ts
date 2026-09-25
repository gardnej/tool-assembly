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

/**
 * Bore-cap material per seat, in {@link PREVIEW_SEATS} order.
 *
 * `scripts/add-bore-caps.py` bakes a short cylinder into each hole so the viewer
 * can colour a near-flush disc for the selected empty seat instead of revealing
 * the full-length adaptor, which stood proud like a peg. Requires the mesh built
 * with those caps (the `-caps` GLB); a plain export has no such material.
 */
export const PREVIEW_SEAT_CAPS = ["cap_0", "cap_1", "cap_2"];

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

/** A point on the block, in the mesh's own coordinate space, and its facing. */
export interface SeatAnchor {
  position: [number, number, number];
  normal: [number, number, number];
  /**
   * The seat's ring diameter on the face, in the mesh's units.
   *
   * Recognised from the block mesh by `scripts/hole-rings.py`: the machined
   * counterbore around each seat, which is the ring the eye reads on the block.
   * The viewer draws an outline this wide so it hugs the real hole rather than
   * sitting as a fixed dot.
   */
  ringDiameter: number;
}

/**
 * Where each seat's hole opens on the block face, per {@link PREVIEW_SEATS}.
 *
 * Read off the GLB with `scripts/seat-hotspots.py`: the tool axis is +X, so the
 * block's outer face sits at x ≈ 5.25 and each flush (extension) body's y,z give
 * its hole centre. A `<model-viewer>` hotspot anchored here lands a ring right on
 * the physical hole and rides the camera, so which position is which is read off
 * the block itself rather than inferred from a chip. The mouth is nudged just
 * proud of the face (x = 5.4) so the ring is not swallowed by the solid, and the
 * +X normal lets the viewer dim rings on holes turned away. `ringDiameter` is the
 * seat bore each tool passes through, recognised by `scripts/hole-rings.py` — the
 * tight hole itself, not the wider machined counterbore around it.
 */
export const PREVIEW_SEAT_ANCHORS: SeatAnchor[] = [
  { position: [5.4, 0.0, -8.5], normal: [1, 0, 0], ringDiameter: 2.2 },
  { position: [5.4, 0.0, -3.81], normal: [1, 0, 0], ringDiameter: 2.2 },
  { position: [5.4, -6.341, -7.665], normal: [1, 0, 0], ringDiameter: 2.2 },
];

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
