import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import previewBlockUrl from "../assets/models/3x-spot-drill-tap.glb?url";
import {
  PREVIEW_BLOCK_GEOMETRY_ID,
  PREVIEW_BLOCK_MATERIAL,
  PREVIEW_SEATS,
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
import type { ModelViewerElement, ModelViewerMaterial } from "../model-viewer";
import type { RowId, SlotLevel } from "../types";
import type { LibraryToolRecord } from "../data/realLibrary";
import { displayName } from "../data/realLibrary";
import { meshPreviewFor, ToolLibrarySolidPreview } from "./ToolLibrarySolidPreview";
import { ToolSilhouette } from "./ToolSilhouette";

/** What one position holds, per level. */
export interface ViewerSlotFill {
  extension: boolean;
  collet: boolean;
  tool: boolean;
}

interface AssemblyViewerProps {
  /** Geometry of the chosen block; only some blocks have a mesh to show. */
  blockGeometryId: string | null;
  /** One entry per position, saying which levels of it are filled. */
  slots: ViewerSlotFill[];
  /** Position and level to pick out, or null when the block row is selected. */
  selected: { slotIndex: number; level: SlotLevel } | null;
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
   * The row a picked part belongs to.
   *
   * A position's components sit wherever the assembly put them, so which row
   * holds the collet of position 2 is the assembly's business rather than the
   * mesh's, and the caller answers it.
   */
  rowIdAt: (slotIndex: number, level: SlotLevel) => RowId | null;
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

/** The position and level a material belongs to, for picking. */
function levelOf(name: string): { slotIndex: number; level: SlotLevel } | null {
  for (const [slotIndex, seat] of PREVIEW_SEATS.entries()) {
    if (name === seat.extension) return { slotIndex, level: "extension" };
    if (name === seat.collet) return { slotIndex, level: "collet" };
    if (seat.tool.includes(name)) return { slotIndex, level: "tool" };
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
  const hasModel = mesh !== null;
  const canPickSeats = mesh?.seatable === true;
  const slotCount = slots.length;
  // Identity of the array changes every render, so compare its contents.
  const filledKey = slots
    .map((slot) => `${+slot.extension}${+slot.collet}${+slot.tool}`)
    .join("");
  const selectedKey = selected === null ? "" : `${selected.slotIndex}-${selected.level}`;

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

      const found = levelOf(hit.name);
      if (found === null || found.slotIndex >= slotCount) return;
      const id = rowIdAt(found.slotIndex, found.level);
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
      const fill = slots[index];
      const highlighted = (level: SlotLevel) =>
        selected !== null && selected.slotIndex === index && selected.level === level;

      const show = (names: string[], level: SlotLevel, state: PartState) => {
        for (const name of names) {
          paint(
            name,
            state,
            highlighted(level),
            state === "solid" ? LEVEL_COLOUR[level] : EMPTY_COLOUR,
          );
        }
      };

      // Seats past the block's tool count are not positions at all.
      if (fill === undefined) {
        show([seat.extension], "extension", "hidden");
        show([seat.collet], "collet", "hidden");
        show(seat.tool, "tool", "hidden");
        return;
      }

      // Only what a position actually holds is drawn — empty seats are hidden,
      // so the block reads on its own until something is mounted.
      show([seat.extension], "extension", fill.extension ? "solid" : "hidden");
      show([seat.collet], "collet", fill.collet ? "solid" : "hidden");
      show(seat.tool, "tool", fill.tool ? "solid" : "hidden");
    });
  }, [canPickSeats, filledKey, slots, selectedKey, selected, blockSelected, loaded]);

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
        <ViewCube theta={orbit.theta} phi={orbit.phi} />

        {mesh !== null ? (
          <model-viewer
            ref={viewerRef}
            key={mesh.src}
            className="absolute inset-0 h-full w-full cursor-pointer"
            src={mesh.src}
            alt="Tool block assembly"
            camera-controls
            orientation={PREVIEW_PINS_UP}
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
        {mesh === null && !blockSelected && selectedTool !== undefined && (
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

/**
 * A live cube reflecting the camera's orbit around the model.
 *
 * The block sits in the viewer with its ``+Z`` axis pointing up, and the cube
 * shares that convention: front, back, left and right are the model's four
 * side faces, top and bottom carry its ``±Z`` ends. The face the camera looks
 * along is the face the user sees on the cube, so orbiting the block spins
 * the cube in step. Nothing here is interactive yet — clicking to snap the
 * camera to a named view would be a next step.
 */
function ViewCube({ theta, phi }: { theta: number; phi: number }) {
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
          // Compose right-to-left: first mount the cube with the model's ``+Z``
          // up (matching ``orientation="0deg -90deg 0deg"``), then apply the
          // camera's yaw and pitch so the face nearest the camera reads front.
          transform: `rotateX(${pitch}deg) rotateY(${yaw}deg) rotateX(-90deg)`,
        }}
      >
        {/*
          Face labels are placed so the model's ``+Z`` axis reads as up: the
          face pointing along the cube's local ``+Z`` ends up on top after the
          preceding ``rotateX(-90deg)``, so that face wears the "TOP" label.
          The opposite conventions follow — the face nearest the camera at the
          default 25°/70° orbit is "FRONT", and so on.
        */}
        <div style={face(`translateZ(${half}px)`)}>TOP</div>
        <div style={face(`rotateY(180deg) translateZ(${half}px)`)}>BOTTOM</div>
        <div style={face(`rotateY(90deg) translateZ(${half}px)`)}>RIGHT</div>
        <div style={face(`rotateY(-90deg) translateZ(${half}px)`)}>LEFT</div>
        <div style={face(`rotateX(90deg) translateZ(${half}px)`)}>BACK</div>
        <div style={face(`rotateX(-90deg) translateZ(${half}px)`)}>FRONT</div>
      </div>
      <AxisGnomon theta={theta} phi={phi} />
    </div>
  );
}

/**
 * The X/Y/Z triad drawn beside the cube.
 *
 * It shares the cube's rotation but sits under it as a set of coloured stubs,
 * so the axes read at a glance even when a face label is edge-on to the camera.
 */
function AxisGnomon({ theta, phi }: { theta: number; phi: number }) {
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
          transform: `rotateX(${pitch}deg) rotateY(${yaw}deg) rotateX(-90deg)`,
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
