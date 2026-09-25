import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import previewBlockUrl from "../assets/models/3x-spot-drill-tap-caps.glb?url";
// Design-frame preview meshes for the user's OD/ID dual blocks. Each part owns a
// uniquely named material (see scripts/make-block-previews.py) so the viewer can
// light up a single position and pick individual parts, the same way the 3X
// block's per-seat materials work.
import od20mmDualIdPreviewUrl from "../assets/models/od-20mm-dual-id-preview.glb?url";
import od25mmDualOdPreviewUrl from "../assets/models/od-25mm-dual-od-preview.glb?url";
import {
  PREVIEW_BLOCK_GEOMETRY_ID,
  PREVIEW_BLOCK_MATERIAL,
  PREVIEW_SEATS,
  PREVIEW_SEAT_CAPS,
} from "../data/previewGeometry";

/**
 * A block's mesh in the assembly viewer.
 *
 * ``seatable`` says whether the file carries a material per seat, which is what
 * the viewer uses to hide, ghost and pick individual parts. The prototype block
 * exported from OBJ is split that way; blocks converted from a plain STEP are
 * one material, so the block draws but its seats are not addressable yet.
 */
interface BlockMesh {
  src: string;
  seatable: boolean;
}

/** The imported 3X Axial block's stored geometry ids, per the JSON snapshot. */
const AXIAL_BLOCK_GEOMETRY_IDS = new Set([
  "3482e088-0690-4e9f-a4d8-4f1514f4ea90",
]);

function blockMeshFor(geometryId: string | null): BlockMesh | null {
  if (geometryId === PREVIEW_BLOCK_GEOMETRY_ID) {
    return { src: previewBlockUrl, seatable: true };
  }
  if (geometryId !== null && AXIAL_BLOCK_GEOMETRY_IDS.has(geometryId)) {
    // The STEP export the user handed us is a single fused body, so its seats
    // cannot be lit up on their own. The 3X Axial block is a three-position
    // block with the same seat layout as the prototype 3X Spot-Drill-Tap, and
    // the prototype GLB already carries a material per seat — use it as the
    // stand-in so the assembly viewer can show a mounted extension, collet or
    // cutting tool in its slot. Once a per-part STEP or OBJ is available for
    // the real block this dispatch can point at that mesh instead.
    return { src: previewBlockUrl, seatable: true };
  }
  return null;
}

/**
 * A user OD/ID dual block whose parts are individually addressable.
 *
 * Unlike the STEP-fused blocks above, these preview meshes carry one material
 * per part, so the viewer can paint the body, highlight a single position and
 * pick parts. ``positions`` is ordered by position ordinal (Position 1 first),
 * mapping each position to the holder/tool part material names that stand for it
 * on the block. Because the block carries no per-seat frames, a position's
 * highlight lights its physical holder region rather than a placed component.
 */
interface OdBlockPreview {
  src: string;
  /** Camera orientation that stands the block up like the machine sees it. */
  orientation: string;
  /** Material names of the block body — coloured as the block, not a position. */
  body: string[];
  /**
   * Real baked tool meshes per position ordinal (index 0 = Position 1), shown
   * solid when the position is filled.
   */
  positions: string[][];
  /**
   * Baked box-mesh material per position ordinal, sized to that position's tool
   * volume (see scripts/add-position-ghosts.py). It is the plain rectangular
   * ghost shown while the position is in focus but empty.
   */
  ghosts: string[];
}

const OD_BLOCK_PREVIEWS: Record<string, OdBlockPreview> = {
  // 20MM ID_DUAL — two boring-bar bores through the block body. Each position
  // is a bar (insert + tip) in its sleeve; the end caps belong to the body.
  "3ac2ff71-0a7a-4fa9-80b4-ee79740f884f": {
    src: od20mmDualIdPreviewUrl,
    orientation: "0deg 0deg 0deg",
    body: ["Tool Block", "End Cap_1", "End Cap_2"],
    positions: [
      ["12mm CNMG", "12mm CNMG_1", "20 x 12"],
      ["16mm CNMG", "16mm CNMG_1", "20 x 16"],
    ],
    ghosts: ["PositionGhost_1", "PositionGhost_2"],
  },
  // 25MM OD_DUAL — two OD holders bolted to the block body (SOLID). This block's
  // source STEP was modelled with its cutting side facing −Z, so a 180° yaw turns
  // the tool-exit face toward the default camera (FRONT) with the bolt/seat face
  // staying up (TOP); the ViewCube reads from this same orientation and follows.
  "60a88fbe-b190-408d-9fb4-81510f603e94": {
    src: od25mmDualOdPreviewUrl,
    orientation: "0deg 0deg 180deg",
    body: ["SOLID"],
    positions: [
      ["3602034-DDJNL 2525M-15 - Basic-mm", "3602034-DDJNL 2525M-15 - Basic-mm_1"],
      ["3800006-SER 2525 M16 - Basic-mm", "3800006-SER 2525 M16 - Basic-mm_1"],
    ],
    ghosts: ["PositionGhost_1", "PositionGhost_2"],
  },
};

function odBlockPreviewFor(geometryId: string | null): OdBlockPreview | null {
  if (geometryId === null) return null;
  return OD_BLOCK_PREVIEWS[geometryId] ?? null;
}

/**
 * Whether a block uses per-position identity colours (teal/amber/…), so the
 * assembly grid can put a matching colour chip on each Position row. Only the
 * OD/ID dual blocks carry colour-coded ghosts; the STEP-fused blocks do not.
 */
export function usesPositionColours(geometryId: string | null): boolean {
  return odBlockPreviewFor(geometryId) !== null;
}
import type { ModelViewerElement, ModelViewerMaterial } from "../model-viewer";
import type { RowId, SlotLevel } from "../types";
import { positionColour } from "../data/positionColours";
import type { LibraryToolRecord } from "../data/realLibrary";
import { displayName } from "../data/realLibrary";
import { meshPreviewFor, ToolLibrarySolidPreview } from "./ToolLibrarySolidPreview";
import { ToolSilhouette } from "./ToolSilhouette";

interface AssemblyViewerProps {
  /** Geometry of the chosen block; only some blocks have a mesh to show. */
  blockGeometryId: string | null;
  /**
   * One entry per position: the kinds it holds, machine side first. The viewer
   * seats them by this order, so the first component fills the bore seat flush
   * with the block face and the rest stack outward — a collet mounted straight
   * in the block reads as seated rather than floating.
   */
  slots: SlotLevel[][];
  /** Position and depth to pick out, or null when the block row is selected. */
  selected: { slotIndex: number; depth: number } | null;
  /**
   * Position whose empty bore seat should be marked, or null. Set even for an
   * empty position, so selecting one confirms which hole on the block it maps
   * to without drawing a ghost of a whole assembly.
   */
  selectedSlotIndex: number | null;
  blockSelected: boolean;
  /**
   * The record the properties panel is on, if any.
   *
   * Used to draw an inset preview when the main mesh cannot show the picked
   * part on its own — the imported blocks are single-material solids, so the
   * cube of the assembly still reads as the block, and the inset stands in for
   * the seat that would otherwise light up.
   */
  selectedTool?: LibraryToolRecord;
  /**
   * The row a picked seat belongs to, by mount depth.
   *
   * Seats are painted in mount order, so clicking the nth seat of a position
   * asks for the row at depth n; the caller maps that back to a row id (or the
   * position row when nothing sits that deep).
   */
  rowIdAt: (slotIndex: number, depth: number) => RowId | null;
  onSelectRow: (id: RowId) => void;
}

const BLOCK_COLOUR: Rgb = [0.60, 0.65, 0.71];
/** Adaptive items share a colour, since both do the same job. */
const ADAPTIVE_COLOUR: Rgb = [0.85, 0.64, 0.29];
const TOOL_COLOUR: Rgb = [0.72, 0.75, 0.79];
const EMPTY_COLOUR: Rgb = [0.78, 0.82, 0.87];
const SELECTED_COLOUR: Rgb = [0.23, 0.60, 0.85];

const LEVEL_COLOUR: Record<SlotLevel, Rgb> = {
  extension: ADAPTIVE_COLOUR,
  collet: ADAPTIVE_COLOUR,
  tool: TOOL_COLOUR,
};

/** Faint enough to read as a free seat rather than as a tool. */
const GHOST_ALPHA = 0.16;
const GHOST_SELECTED_ALPHA = 0.45;

/** Pointer travel that still counts as a click rather than an orbit. */
const CLICK_SLOP_PX = 4;

/**
 * Rotation that stands the block on end, locating pins upwards.
 *
 * The export puts the four pins on the +Z face — `scripts/find-pins.py` finds
 * them as four matching bosses at (±2.90, ±2.90) standing proud of it — while
 * the viewer's up is +Y. Pitching a quarter turn about X brings +Z up, which
 * leaves the tools projecting sideways as they do on the machine.
 */
const PREVIEW_PINS_UP = "0deg -90deg 0deg";

type Rgb = [number, number, number];

/** Whether a part is seated, an empty seat, or beyond the block's capacity. */
type PartState = "solid" | "ghost" | "hidden";

/**
 * The seat bodies of one position, in mount order from the block face outward:
 * the bore seat that sits flush in the block, then the middle body, then the
 * outer body. Mounted components are drawn onto these by depth, whatever their
 * kind, so a stack always seats flush and contiguous.
 */
function orderedBodies(seat: (typeof PREVIEW_SEATS)[number]): string[][] {
  return [[seat.extension], [seat.collet], seat.tool];
}

/** The position and mount-order body a material belongs to, for picking. */
function seatOf(name: string): { slotIndex: number; bodyIndex: number } | null {
  for (const [slotIndex, seat] of PREVIEW_SEATS.entries()) {
    const bodies = orderedBodies(seat);
    for (let bodyIndex = 0; bodyIndex < bodies.length; bodyIndex += 1) {
      if (bodies[bodyIndex].includes(name)) return { slotIndex, bodyIndex };
    }
  }
  return null;
}

/** Base colour factors are linear, while the palette above is written as sRGB. */
function toLinear([r, g, b]: Rgb): Rgb {
  const convert = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return [convert(r), convert(g), convert(b)];
}

/**
 * Solid view of the block with an extension in each filled position.
 *
 * The parts arrive already assembled in one coordinate space, so seating one is
 * a matter of revealing it rather than placing it: the arrangement is the CAD
 * model's own. That is also the limit of it — this shows where the exported
 * geometry puts things, not where Fusion's joint frames would, and the block
 * carries no frames to check it against.
 */
export function AssemblyViewer({
  blockGeometryId,
  slots,
  selected,
  selectedSlotIndex,
  blockSelected,
  selectedTool,
  rowIdAt,
  onSelectRow,
}: AssemblyViewerProps) {
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Radians so the cube can compose them directly into a CSS 3D rotation.
  // Defaults match ``camera-orbit="25deg 70deg auto"``.
  const [orbit, setOrbit] = useState<{ theta: number; phi: number }>({
    theta: (25 * Math.PI) / 180,
    phi: (70 * Math.PI) / 180,
  });

  const mesh = blockMeshFor(blockGeometryId);
  const odBlock = odBlockPreviewFor(blockGeometryId);
  // The mesh to draw: the seatable 3X preview, or a user OD/ID dual block.
  const modelSrc = mesh?.src ?? odBlock?.src ?? null;
  const orientation = odBlock?.orientation ?? PREVIEW_PINS_UP;
  const hasModel = modelSrc !== null;
  const canPickSeats = mesh?.seatable === true;
  const slotCount = slots.length;
  // Identity of the array changes every render, so compare its contents.
  const filledKey = slots.map((kinds) => kinds.join(">")).join("|");
  const selectedKey = selected === null ? "" : `${selected.slotIndex}-${selected.depth}`;

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer === null) return;

    const onLoad = () => setLoaded(true);
    const onCamera = () => {
      const current = viewer.getCameraOrbit?.();
      if (current !== undefined) {
        setOrbit({ theta: current.theta, phi: current.phi });
      }
    };
    viewer.addEventListener("load", onLoad);
    viewer.addEventListener("camera-change", onCamera);
    onCamera();
    return () => {
      viewer.removeEventListener("load", onLoad);
      viewer.removeEventListener("camera-change", onCamera);
    };
  }, [hasModel]);

  /**
   * Picking a part selects its row.
   *
   * Listeners are native and capturing rather than React's, because the element
   * handles its own camera input inside a shadow root and a synthetic handler on
   * the host does not reliably see the click.
   */
  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer === null || !canPickSeats) return;

    // Orbiting ends in a click too, so only a pointer that stayed put selects.
    let pressedAt: { x: number; y: number } | null = null;

    const onDown = (event: MouseEvent) => {
      pressedAt = { x: event.clientX, y: event.clientY };
    };

    const onClick = (event: MouseEvent) => {
      const start = pressedAt;
      pressedAt = null;
      if (
        start !== null &&
        (Math.abs(event.clientX - start.x) > CLICK_SLOP_PX ||
          Math.abs(event.clientY - start.y) > CLICK_SLOP_PX)
      ) {
        return;
      }

      const hit = viewer.materialFromPoint?.(event.clientX, event.clientY);
      if (hit == null) return;

      if (hit.name === PREVIEW_BLOCK_MATERIAL) {
        onSelectRow("block");
        return;
      }

      // A lit bore cap stands in for its empty position, so clicking it selects
      // that position row just like clicking a seated part does.
      const capIndex = PREVIEW_SEAT_CAPS.indexOf(hit.name);
      if (capIndex !== -1 && capIndex < slotCount) {
        onSelectRow(`slot-${capIndex}`);
        return;
      }

      const found = seatOf(hit.name);
      if (found === null || found.slotIndex >= slotCount) return;
      // Seats are painted by mount order, so the body index is the depth.
      const id = rowIdAt(found.slotIndex, found.bodyIndex);
      if (id !== null) onSelectRow(id);
    };

    viewer.addEventListener("mousedown", onDown, true);
    viewer.addEventListener("click", onClick, true);
    return () => {
      viewer.removeEventListener("mousedown", onDown, true);
      viewer.removeEventListener("click", onClick, true);
    };
  }, [canPickSeats, slotCount, rowIdAt, onSelectRow]);

  useEffect(() => {
    if (!canPickSeats) return;
    const materials = viewerRef.current?.model?.materials;
    if (materials === undefined) return;

    const find = (name: string): ModelViewerMaterial | undefined =>
      materials.find((material) => material.name === name);

    const paint = (name: string, state: PartState, highlighted: boolean, base: Rgb) => {
      const material = find(name);
      if (material === undefined) return;

      // model-viewer reaches materials but not nodes, so a part is hidden or
      // ghosted by how it is painted rather than by leaving the scene.
      const [r, g, b] = toLinear(highlighted ? SELECTED_COLOUR : base);
      const alpha =
        state === "solid"
          ? 1
          : state === "hidden"
            ? 0
            : highlighted
              ? GHOST_SELECTED_ALPHA
              : GHOST_ALPHA;

      material.setAlphaMode(state === "solid" ? "OPAQUE" : "BLEND");
      material.pbrMetallicRoughness.setBaseColorFactor([r, g, b, alpha]);
      material.pbrMetallicRoughness.setMetallicFactor(state === "solid" ? 0.35 : 0);
      material.pbrMetallicRoughness.setRoughnessFactor(0.45);
    };

    paint(PREVIEW_BLOCK_MATERIAL, "solid", blockSelected, BLOCK_COLOUR);

    PREVIEW_SEATS.forEach((seat, index) => {
      const kinds = slots[index];
      const bodies = orderedBodies(seat);

      const paintBody = (
        names: string[],
        state: PartState,
        highlighted: boolean,
        base: Rgb,
      ) => {
        for (const name of names) paint(name, state, highlighted, base);
      };

      // Seats past the block's tool count are not positions at all.
      if (kinds === undefined) {
        bodies.forEach((names) => paintBody(names, "hidden", false, EMPTY_COLOUR));
        paint(PREVIEW_SEAT_CAPS[index], "hidden", false, EMPTY_COLOUR);
        return;
      }

      bodies.forEach((names, bodyIndex) => {
        const kind = kinds[bodyIndex];

        if (kind !== undefined) {
          // Mounted: seat the nth component on the nth body, so the stack sits
          // flush against the block face and stacks outward from there.
          const highlighted =
            selected !== null &&
            selected.slotIndex === index &&
            selected.depth === bodyIndex;
          paintBody(names, "solid", highlighted, LEVEL_COLOUR[kind]);
          return;
        }

        // Empty depths keep their long adaptor body hidden — it stands proud of
        // the face like a peg, so it is never the highlight.
        paintBody(names, "hidden", false, EMPTY_COLOUR);
      });

      // Show only the active position, and show it as a lit bore: the baked
      // near-flush cap disc (see add-bore-caps.py) is coloured blue for the
      // selected empty seat and stays transparent otherwise, so the highlight
      // reads as the coloured hole rather than a protruding tool. A seat with
      // anything mounted highlights that part instead, so its cap stays hidden.
      const isEmpty = kinds.every((kind) => kind === undefined);
      const litBore = isEmpty && selectedSlotIndex === index;
      paint(PREVIEW_SEAT_CAPS[index], litBore ? "solid" : "hidden", litBore, EMPTY_COLOUR);
    });
  }, [
    canPickSeats,
    filledKey,
    slots,
    selectedKey,
    selected,
    selectedSlotIndex,
    blockSelected,
    loaded,
  ]);

  /**
   * Paint a user OD/ID dual block: the block body is always solid, and each
   * position is colour-coded to the matching Position row's chip in the grid so
   * the preview relates to the UI. The dual blocks carry no per-seat frames, so
   * a plain box baked to each position's tool volume (scripts/add-position-
   * ghosts.py) stands in for the seat. A position shows, in its own colour:
   *   • in focus + empty → the box as a translucent ghost, so the user sees
   *     exactly where the focused position sits without a tool-shaped hint;
   *   • mounted          → the real tool drawn solid;
   *   • otherwise        → nothing (both the box and the tool hidden), keeping
   *     the block clean until a position is being worked on.
   */
  useEffect(() => {
    if (odBlock === null) return;
    const materials = viewerRef.current?.model?.materials;
    if (materials === undefined) return;

    const paint = (name: string, colour: Rgb, alpha: number) => {
      const material = materials.find((m) => m.name === name);
      if (material === undefined) return;
      const [r, g, b] = toLinear(colour);
      // model-viewer reaches materials but not nodes, so state is expressed by
      // how a part is painted. Fully hidden uses MASK with a high cutoff and
      // zero alpha, which discards every fragment cleanly from all angles (BLEND
      // at alpha 0 can still ghost/occlude at grazing angles); a partial ghost
      // uses BLEND; a mounted part is OPAQUE.
      if (alpha >= 1) {
        material.setAlphaMode("OPAQUE");
        material.pbrMetallicRoughness.setBaseColorFactor([r, g, b, 1]);
        material.pbrMetallicRoughness.setMetallicFactor(0.35);
      } else if (alpha <= 0) {
        material.setAlphaMode("MASK");
        material.setAlphaCutoff(1);
        material.pbrMetallicRoughness.setBaseColorFactor([r, g, b, 0]);
        material.pbrMetallicRoughness.setMetallicFactor(0);
      } else {
        material.setAlphaMode("BLEND");
        material.pbrMetallicRoughness.setBaseColorFactor([r, g, b, alpha]);
        material.pbrMetallicRoughness.setMetallicFactor(0);
      }
      material.pbrMetallicRoughness.setRoughnessFactor(0.45);
    };

    for (const name of odBlock.body) {
      paint(name, blockSelected ? SELECTED_COLOUR : BLOCK_COLOUR, 1);
    }
    odBlock.positions.forEach((toolNames, index) => {
      const colour = positionColour(index);
      const ghost = odBlock.ghosts[index];
      const mounted = (slots[index] ?? []).some((kind) => kind !== undefined);
      const focused = selectedSlotIndex === index;

      if (mounted) {
        for (const name of toolNames) paint(name, colour, 1);
        if (ghost !== undefined) paint(ghost, colour, 0);
      } else if (focused) {
        if (ghost !== undefined) paint(ghost, colour, GHOST_SELECTED_ALPHA);
        for (const name of toolNames) paint(name, colour, 0);
      } else {
        if (ghost !== undefined) paint(ghost, colour, 0);
        for (const name of toolNames) paint(name, colour, 0);
      }
    });
  }, [odBlock, filledKey, slots, selectedSlotIndex, blockSelected, loaded]);

  /**
   * Picking a part of an OD/ID dual block selects its position (or the block).
   *
   * The block has no per-seat frames, so a click maps to the position ordinal
   * the part belongs to rather than to a mount depth.
   */
  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer === null || odBlock === null) return;

    let pressedAt: { x: number; y: number } | null = null;
    const onDown = (event: MouseEvent) => {
      pressedAt = { x: event.clientX, y: event.clientY };
    };
    const onClick = (event: MouseEvent) => {
      const start = pressedAt;
      pressedAt = null;
      if (
        start !== null &&
        (Math.abs(event.clientX - start.x) > CLICK_SLOP_PX ||
          Math.abs(event.clientY - start.y) > CLICK_SLOP_PX)
      ) {
        return;
      }

      const hit = viewer.materialFromPoint?.(event.clientX, event.clientY);
      if (hit == null) return;

      if (odBlock.body.includes(hit.name)) {
        onSelectRow("block");
        return;
      }
      const posIndex = odBlock.positions.findIndex(
        (names, i) => names.includes(hit.name) || odBlock.ghosts[i] === hit.name,
      );
      if (posIndex === -1 || posIndex >= slotCount) return;
      // Prefer the row mounted at this position; fall back to the position row.
      const id = rowIdAt(posIndex, 0) ?? (`slot-${posIndex}` as RowId);
      onSelectRow(id);
    };

    viewer.addEventListener("mousedown", onDown, true);
    viewer.addEventListener("click", onClick, true);
    return () => {
      viewer.removeEventListener("mousedown", onDown, true);
      viewer.removeEventListener("click", onClick, true);
    };
  }, [odBlock, slotCount, rowIdAt, onSelectRow]);

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-weave-viewport">
      <div
        className="relative min-h-0 flex-1"
        style={{
          backgroundImage: `
            linear-gradient(rgb(140 190 230 / 0.22) 1px, transparent 1px),
            linear-gradient(90deg, rgb(140 190 230 / 0.22) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      >
        <ViewCube theta={orbit.theta} phi={orbit.phi} orientation={orientation} />

        {modelSrc !== null ? (
          <model-viewer
            ref={viewerRef}
            key={modelSrc}
            className="absolute inset-0 h-full w-full cursor-pointer"
            src={modelSrc}
            alt="Tool block assembly"
            camera-controls
            orientation={orientation}
            camera-orbit="25deg 70deg auto"
            interaction-prompt="none"
            shadow-intensity="0.6"
            exposure="1.1"
            aria-label="Tool block assembly — drag to orbit, scroll to zoom."
          />
        ) : (
          <EmptyState
            title={blockGeometryId === null ? "No tool block chosen" : "No solid to show"}
            body={
              blockGeometryId === null
                ? "Choose a tool block to see it here."
                : "This block's solid is held in Fusion's own format, which the prototype cannot read."
            }
          />
        )}

        {/*
          When the assembly has no block mesh at all — a picked block whose
          solid the prototype cannot read — a picked component still has to
          read as picked. The inset draws it beside the empty state.
        */}
        {modelSrc === null && !blockSelected && selectedTool !== undefined && (
          <SelectedPartInset record={selectedTool} />
        )}
      </div>
    </section>
  );
}

/**
 * A small floating panel showing the currently selected extension, collet or
 * cutting tool on its own.
 *
 * The main viewer sees only the block, so the inset stands in for the seat
 * highlight the OBJ-derived block gets for free. It uses the same mesh
 * dispatch as the library preview: a 3D mesh where one exists, otherwise the
 * type-aware silhouette.
 */
function SelectedPartInset({ record }: { record: LibraryToolRecord }) {
  const preview = meshPreviewFor(record);

  return (
    <div
      className="pointer-events-auto absolute bottom-3 right-3 z-10 flex flex-col rounded-[2px] border border-weave-divider bg-weave-dialog/90 shadow-lg"
      style={{ width: 176 }}
    >
      <div className="border-b border-weave-divider px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-weave-text-active/80">
        Selected
      </div>
      <div className="relative h-32 overflow-hidden bg-weave-viewport">
        {preview !== null ? (
          <ToolLibrarySolidPreview preview={preview} />
        ) : (
          <ToolSilhouette record={record} className="h-full w-full p-2" />
        )}
      </div>
      <div
        className="truncate px-2 py-1 text-[11px] text-weave-text"
        title={displayName(record)}
      >
        {displayName(record)}
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
      <p className="text-xs font-semibold text-weave-text-active/85">{title}</p>
      <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-weave-text-active/60">
        {body}
      </p>
    </div>
  );
}

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

/** Parse a model-viewer ``orientation`` ("roll pitch yaw", degrees). */
function parseOrientation(orientation: string): { roll: number; pitch: number; yaw: number } {
  const [roll = 0, pitch = 0, yaw = 0] = orientation
    .trim()
    .split(/\s+/)
    .map((token) => Number.parseFloat(token) || 0);
  return { roll, pitch, yaw };
}

function rot(axis: "x" | "y" | "z", deg: number): Mat3 {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (axis === "x") return [[1, 0, 0], [0, c, -s], [0, s, c]];
  if (axis === "y") return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}

function matMul(a: Mat3, b: Mat3): Mat3 {
  const out: Mat3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i += 1)
    for (let j = 0; j < 3; j += 1)
      out[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
  return out;
}

/** Model→cube rotation for a given orientation, matching the CSS mount below. */
function orientationMatrix(orientation: string): Mat3 {
  const { roll, pitch, yaw } = parseOrientation(orientation);
  // Same composition as the CSS mount: rotateY(yaw) rotateX(pitch) rotateZ(roll).
  return matMul(rot("y", yaw), matMul(rot("x", pitch), rot("z", roll)));
}

/** The CSS transform that mounts the cube the way the model is oriented. */
function orientationMount(orientation: string): string {
  const { roll, pitch, yaw } = parseOrientation(orientation);
  return `rotateY(${yaw}deg) rotateX(${pitch}deg) rotateZ(${roll}deg)`;
}

/** Rᵀ · v — map a world direction back into the cube's local frame. */
function applyTranspose(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
    m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
    m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
  ];
}

/** The CSS transform placing a cube face whose outward normal is ``v``. */
function faceTransform(v: Vec3, half: number): string {
  // Snap to the dominant axis; our mounts are all axis-aligned quarter turns.
  const abs = v.map(Math.abs);
  const axis = abs[0] >= abs[1] && abs[0] >= abs[2] ? 0 : abs[1] >= abs[2] ? 1 : 2;
  const sign = v[axis] >= 0 ? 1 : -1;
  const key = `${sign > 0 ? "+" : "-"}${"xyz"[axis]}`;
  const rots: Record<string, string> = {
    "+z": "",
    "-z": "rotateY(180deg)",
    "+x": "rotateY(90deg)",
    "-x": "rotateY(-90deg)",
    "+y": "rotateX(90deg)",
    "-y": "rotateX(-90deg)",
  };
  const r = rots[key];
  return `${r ? `${r} ` : ""}translateZ(${half}px)`;
}

/**
 * A live cube reflecting the camera's orbit around the model.
 *
 * The cube is mounted with the *same* ``orientation`` the model-viewer applies
 * to the block, so it turns in lockstep with whichever block is shown — the
 * 3X block stands ``+Z`` up, the OD/ID blocks sit in their native CAD frame.
 * Face labels are pinned to world directions (TOP is up, FRONT faces the camera
 * at the default orbit) by mapping each through the inverse mount, so they stay
 * meaningful whatever the block's frame. The face the camera looks along is the
 * face the user sees on the cube. Clicking to snap to a named view would be a
 * next step.
 */
function ViewCube({
  theta,
  phi,
  orientation,
}: {
  theta: number;
  phi: number;
  orientation: string;
}) {
  // model-viewer's ``theta`` grows counter-clockwise around world +Y, so the
  // cube counter-rotates to keep the camera-facing side toward the user; the
  // vertical tilt is ``phi - 90°``, since 90° looks along the horizon.
  const yaw = (-theta * 180) / Math.PI;
  const pitch = ((phi - Math.PI / 2) * 180) / Math.PI;

  const size = 48;
  const half = size / 2;
  const faceStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    fontWeight: 600,
    color: "rgba(230, 234, 240, 0.85)",
    background: "rgba(60, 66, 76, 0.78)",
    border: "1px solid rgba(160, 168, 178, 0.55)",
    backfaceVisibility: "hidden",
  };
  const face = (transform: string, extra?: CSSProperties): CSSProperties => ({
    ...faceStyle,
    transform,
    ...extra,
  });

  // Pin labels to world directions, then push each into the cube's local frame
  // via the inverse mount so the naming follows the block, not the raw geometry.
  const mount = orientationMatrix(orientation);
  const labels: { name: string; world: Vec3 }[] = [
    { name: "TOP", world: [0, 1, 0] },
    { name: "BOTTOM", world: [0, -1, 0] },
    { name: "FRONT", world: [0, 0, 1] },
    { name: "BACK", world: [0, 0, -1] },
    { name: "RIGHT", world: [1, 0, 0] },
    { name: "LEFT", world: [-1, 0, 0] },
  ];

  return (
    <div
      className="pointer-events-none absolute right-4 top-4 z-10 select-none"
      style={{ perspective: 260 }}
    >
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          transformStyle: "preserve-3d",
          // Compose right-to-left: first mount the cube the way the block is
          // oriented, then apply the camera's yaw and pitch.
          transform: `rotateX(${pitch}deg) rotateY(${yaw}deg) ${orientationMount(orientation)}`,
        }}
      >
        {labels.map(({ name, world }) => (
          <div key={name} style={face(faceTransform(applyTranspose(mount, world), half))}>
            {name}
          </div>
        ))}
      </div>
      <AxisGnomon theta={theta} phi={phi} orientation={orientation} />
    </div>
  );
}

/**
 * The X/Y/Z triad drawn beside the cube.
 *
 * It shares the cube's rotation but sits under it as a set of coloured stubs,
 * so the axes read at a glance even when a face label is edge-on to the camera.
 */
function AxisGnomon({
  theta,
  phi,
  orientation,
}: {
  theta: number;
  phi: number;
  orientation: string;
}) {
  const yaw = (-theta * 180) / Math.PI;
  const pitch = ((phi - Math.PI / 2) * 180) / Math.PI;
  const length = 18;

  const axis = (color: string, transform: string): CSSProperties => ({
    position: "absolute",
    left: "50%",
    top: "50%",
    width: length,
    height: 2,
    transformOrigin: "0 50%",
    background: color,
    color,
    fontSize: 9,
    fontWeight: 700,
    transform,
  });

  return (
    <div
      style={{
        position: "absolute",
        right: -6,
        bottom: -6,
        width: 36,
        height: 36,
        pointerEvents: "none",
        perspective: 200,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `rotateX(${pitch}deg) rotateY(${yaw}deg) ${orientationMount(orientation)}`,
        }}
      >
        {/* +X, +Y and +Z in model space. */}
        <div style={axis("#e03030", "rotateY(0deg)")}>
          <span style={{ position: "absolute", left: length + 2, top: -6 }}>X</span>
        </div>
        <div style={axis("#30a030", "rotateY(-90deg)")}>
          <span style={{ position: "absolute", left: length + 2, top: -6 }}>Y</span>
        </div>
        <div style={axis("#3a9ad9", "rotateX(90deg)")}>
          <span style={{ position: "absolute", left: length + 2, top: -6 }}>Z</span>
        </div>
      </div>
    </div>
  );
}
