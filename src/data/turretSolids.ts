/**
 * Which real solid represents a mounted assembly, and where it sits.
 *
 * When a user drops a saved assembly on a turret station we want the 3D turret
 * to show *that* assembly's real geometry rather than the baked generic tool.
 * This module answers two questions for the viewport:
 *   1. what solid GLB (if any) stands in for the assembly on a station, and
 *   2. the transform that seats that solid on the station's coupling face.
 *
 * Only a handful of components carry a solid in the prototype snapshot (the two
 * tool blocks and the ER16 holders); assemblies built from anything else return
 * no solid and the viewport keeps the baked template as a fallback.
 */

import er16ColletUrl from "../assets/models/er16-collet.glb?url";
import er16ExtensionUrl from "../assets/models/er16-extension.glb?url";
// The tool block split from the ground-truth seated CAD assembly (same world
// frame as `turret-cad.glb`). It sits on its modelled station at the identity
// transform; other stations are a pure rotation about the drum axis. This
// replaces the reconstructed-turret + bridged-seat path that mis-placed the
// block — see `scripts/split-assembly-cad.py` and `cadAssembly.json`.
import blockCadUrl from "../assets/models/block-cad.glb?url";
import cadAssembly from "./cadAssembly.json";
import ring from "./turretStations.json";
import turretJoints from "./turretJoints.json";
import { sessionAssemblies } from "./libraryEdits";
import { assemblyBaseId } from "./turret";
import { toolById, type LibraryToolRecord } from "./realLibrary";
import { PREVIEW_BLOCK_GEOMETRY_ID } from "./previewGeometry";
import type { Mat4 } from "../lib/composeGlb";

type V3 = [number, number, number];

/** Imported 3X Axial block geometry ids (mirrors ToolLibrarySolidPreview). */
const AXIAL_BLOCK_GEOMETRY_IDS = new Set(["3482e088-0690-4e9f-a4d8-4f1514f4ea90"]);

/**
 * The solid GLB standing in for a block/holder record, if we ship one.
 *
 * Kept in step with `meshPreviewFor` in ToolLibrarySolidPreview, but returns a
 * bare URL so the data layer need not depend on the preview component.
 */
function solidUrlForRecord(record: LibraryToolRecord): string | null {
  // The 3X Spot-Drill-Tap block (and the axial block, same seat layout) now
  // resolves to the CLEAN block GLB, whose mesh origin is the mounting frame
  // (MCS). It seats on any station by a single rigid MCS→UCS snap from the
  // extracted joint frames — see jointBlockPlacement — no hand calibration.
  // (The older `-real` block URL is retained above but unused.)
  if (record.geometryId === PREVIEW_BLOCK_GEOMETRY_ID) return blockCadUrl;
  if (record.geometryId !== null && AXIAL_BLOCK_GEOMETRY_IDS.has(record.geometryId)) {
    return blockCadUrl;
  }
  if (record.type === "holder" && /er16.*collet/i.test(record.description)) return er16ColletUrl;
  if (record.type === "holder" && /er16.*extension/i.test(record.description)) {
    return er16ExtensionUrl;
  }
  return null;
}

/**
 * The solid GLB for the assembly assigned to a station, addressed by the base
 * id the station stores. Demo assemblies (no saved record) return null.
 */
export function assemblySolidUrl(assemblyBase: string | null): string | null {
  if (assemblyBase === null || assemblyBase === "") return null;
  const record = sessionAssemblies().find((a) => assemblyBaseId(a.id) === assemblyBase);
  if (record === undefined || record.blockToolId === null) return null;
  const block = toolById(record.blockToolId);
  if (block === undefined) return null;
  return solidUrlForRecord(block);
}

/** What a station mounts: a solid GLB and, optionally, which parts of it to show. */
export interface AssemblyMount {
  url: string;
  /** Named materials to keep; absent means the whole solid is shown. */
  keepMaterials?: string[];
}

/**
 * The solid to mount for an assembly.
 *
 * The block resolves to the real geometry split from the seated BMT65 assembly
 * (`solidUrlForRecord`), so the mount is the authored block-and-tools shown
 * whole. It shares a coordinate frame with the turret GLB, so its seat is the
 * CAD model's own — see `realBlockPlacement`. Assemblies whose block has no
 * solid return null and the viewport keeps its baked template.
 */
export function assemblyMount(assemblyBase: string | null): AssemblyMount | null {
  if (assemblyBase === null || assemblyBase === "") return null;
  const record = sessionAssemblies().find((a) => assemblyBaseId(a.id) === assemblyBase);
  if (record === undefined || record.blockToolId === null) return null;
  const block = toolById(record.blockToolId);
  if (block === undefined) return null;

  const url = solidUrlForRecord(block);
  return url === null ? null : { url };
}

/**
 * Changes on every evaluation of this module — including a Vite HMR update.
 *
 * The viewport folds this into its placement memo so that editing a calibration
 * below recomposes the turret *live*, instead of leaving the old seating on
 * screen until a full reload — and a full reload drops the (deliberately
 * non-persistent) station assignment, forcing a re-mount. That mismatch is what
 * made calibration tweaks look like they "did nothing": the numbers were right,
 * but the composed model was stale. No effect in production.
 */
export const CALIBRATION_REVISION: number =
  typeof performance !== "undefined" ? performance.now() : Date.now();

/* Placement -------------------------------------------------------------- */

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function add(a: V3, b: V3): V3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function scaleV(a: V3, s: number): V3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: V3, b: V3): V3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function normalize(a: V3): V3 {
  const m = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / m, a[1] / m, a[2] / m];
}

/**
 * Right-handed frame on a station's coupling facet.
 *
 * Tool blocks bolt to the flats around the drum's rim, not the numbered front
 * face: each facet's outward normal is radial, its pins press in along −radial,
 * and mounted tools point forward along the turret axis. So the frame's origin
 * is the facet point — the drum's outer radius at this station's angle and
 * axial position — with `radial` its outward normal and `axis` pointing to the
 * front (where the stations sit, forward of the drum centre).
 */
function stationFrame(stationNumber: number): { origin: V3; axis: V3; radial: V3; tangent: V3 } {
  const station = ring.stations.find((s) => s.number === stationNumber);
  const center = ring.center as V3;
  const axis = normalize(ring.axis as V3);
  const pos = (station?.position as V3 | undefined) ?? center;
  // Split (pos − centre) into its along-axis part and its radial remainder.
  const fromCenter = sub(pos, center);
  const axialMount = dot(fromCenter, axis);
  let radial = sub(fromCenter, scaleV(axis, axialMount));
  radial = normalize(radial);
  const tangent = normalize(cross(axis, radial));
  // The facet sits at the drum's outer radius, at the station's axial position.
  const origin = add(add(center, scaleV(axis, axialMount)), scaleV(radial, ring.radius));
  return { origin, axis, radial, tangent };
}

/**
 * Per-solid calibration: how to seat a given solid on a station's front face.
 *
 * A BMT turret mounts tool blocks flat on the drum's front face, their locating
 * pins pressed into the face's holes. So a block is seated by two of its own
 * axes: `mountNormal`, the local axis its pins point along (which we turn to
 * press *into* the face), and `up`, the local axis we lay outward along the
 * station's radius. `recenter` moves the block onto its own centre first (its
 * modelled origin is arbitrary), `scale` brings it to the turret's millimetres
 * (the 3X Axial block is modelled in metres), and `offset` then nudges it along
 * the station frame [radial, axial, tangent]. Tuned by eye against the holes.
 */
interface Calibration {
  scale: number;
  recenter: V3;
  /** Local axis the pins point along; turned to press into the face (−axis). */
  mountNormal: V3;
  /** Local axis laid outward along the station radius. */
  up: V3;
  offset: V3;
}

const DEFAULT_CALIBRATION: Calibration = {
  scale: 1,
  recenter: [0, 0, 0],
  mountNormal: [0, 0, 1],
  up: [0, 1, 0],
  offset: [0, 5, 0],
};

/**
 * Calibrations keyed by a stable fragment of the GLB filename, so they survive
 * Vite's content hashing (dev serves `…/3x-axial-block.glb`, prod
 * `…/3x-axial-block-<hash>.glb`).
 */
const CALIBRATIONS: { match: RegExp; cal: Calibration }[] = [
  {
    // Metres → mm (×90). Pins are on the +Z face; lay the block outward along −Y.
    match: /axial-block/,
    cal: {
      scale: 90,
      recenter: [0.01, -0.03, -0.05],
      mountNormal: [0, 0, 1],
      up: [0, -1, 0],
      offset: [0, 5, 0],
    },
  },
  {
    // Already mm; carries the whole prototype assembly (and stands in as the
    // seatable mesh for the axial block). Pins on +Z press into the rim facet
    // (−radial); the tools exit the block's +X face and point forward (axis).
    //
    // Every number below is *measured*, not eyeballed — regenerate with
    // `node scripts/measure-block.mjs` (reads the GLB's POSITION accessor
    // min/max) whenever the mesh changes:
    //   • recenter = the block BODY's AABB centre (material part_0), so the
    //     block rotates about its own centre. The earlier value [4.89,…] was
    //     the whole-assembly centre including the tools that jut 8 mm out the
    //     +X face, which shifted the pivot ~4 mm along the tool/axial axis and
    //     made front-face alignment impossible to converge by hand.
    //   • offset[0] (radial) = body +Z half-extent × scale = 5.875 × 0.8 = 4.70,
    //     which seats the block's +Z mounting face flush on the rim facet.
    //   • offset[1] (axial) = frontAxial − facetAxial − (+X half × scale)
    //     = 6.951 − 7.951 − (4.5 × 0.8) = −4.60, which lands the block's +X
    //     front face co-planar with the turret's numbered front face.
    match: /spot-drill-tap/,
    cal: {
      scale: 0.8,
      recenter: [0.75, -2.52, -4.675],
      mountNormal: [0, 0, 1],
      up: [1, 0, 0],
      offset: [4.7, -4.6, 0],
    },
  },
  {
    match: /er16-collet/,
    cal: { scale: 1, recenter: [0, 0, 0], mountNormal: [0, 0, 1], up: [0, 1, 0], offset: [0, 5, 0] },
  },
  {
    match: /er16-extension/,
    cal: { scale: 1, recenter: [0, 0, 0], mountNormal: [0, 0, 1], up: [0, 1, 0], offset: [0, 5, 0] },
  },
];

/** Short key from a solid URL, used for calibration lookup and live overrides. */
function solidKey(url: string): string {
  for (const { match } of CALIBRATIONS) {
    const found = url.match(match);
    if (found !== null) return found[0];
  }
  return "default";
}

function calibrationFor(url: string): Calibration {
  const base = CALIBRATIONS.find((c) => c.match.test(url))?.cal ?? DEFAULT_CALIBRATION;
  // Live-tuning hook: window.__turretCalib[key] overrides fields during dev so
  // placement can be dialled in without a rebuild. No effect in production.
  const override =
    typeof window !== "undefined"
      ? (window as unknown as { __turretCalib?: Record<string, Partial<Calibration>> })
          .__turretCalib?.[solidKey(url)]
      : undefined;
  return override === undefined ? base : { ...base, ...override };
}

/**
 * Column-major transform seating `solidUrl` on `stationNumber`'s coupling facet.
 *
 * The solid's own frame — `up` (the tool axis → turret axis, pointing forward)
 * and `mountNormal` (the pin axis → −radial, pressing into the facet) — is
 * rotated onto the station frame, so the block sits on the rim facet with its
 * pins in the holes and its tools reaching forward. The solid is recentred and
 * scaled to millimetres first, then translated to the facet plus `offset` along
 * [radial (outward), axial (forward), tangent].
 */
/**
 * Seat the real block on a station by pure rotation about the drum axis.
 *
 * The block GLB was split from the same seated assembly as the turret GLB, so
 * in its own coordinates it already sits flush on the facet the user modelled —
 * that facet is station 1 (`build-real-turret-ring.py` reads station 1 from the
 * block's own angle). Mounting on station N is then a rigid rotation of the
 * whole block about the drum axis by `(N-1)` facet steps: the drum is 12-fold
 * symmetric, so the block lands flush on every station, and station 1 is the
 * identity — no calibration, no gap. Returns a column-major glTF node matrix.
 */
/**
 * Seat the CLEAN block on a station by a single rigid MCS→UCS snap.
 *
 * The block GLB's mesh origin IS its mounting coordinate system (MCS): the
 * block's own axes are identity, with intoFaceAxis = +Z (seats INTO the turret
 * face) and toolForwardAxis = +X (tools exit forward) — see `blockMcs.json`.
 * Each station carries a joint UCS frame in turret space (`turretJoints.json`):
 * an origin `O`, an `intoFaceAxis` (radial-inward toward the drum axis) and a
 * `toolForwardAxis` (drum-axis forward).
 *
 * We build the target frame and map the block's local axes onto it:
 *   • tool-forward  block +X → tX = toolForwardAxis (w)
 *   • into-face     block +Z → tZ = intoFaceAxis (f)
 *   • block +Y      → tY = normalize(tZ × tX)   (block's own Y = Z×X convention)
 * then re-orthonormalise tX = normalize(tY × tZ) so the frame is exactly
 * orthogonal. Because the block axes are identity, the rotation R that carries
 * them onto the targets has columns [tX, tY, tZ] directly. Scale = 1 (both cm)
 * and the MCS origin is (0,0,0), so translation = O. Returns a column-major
 * glTF node matrix. det(R) ≈ +1 (proper rotation), verified at build in dev.
 *
 * SIGN CONVENTION (confirmed empirically from screenshots): the extracted axes
 * are used as-is — tX = +toolForwardAxis, tZ = +intoFaceAxis — which seats the
 * block flush on the facet with its tools pointing forward, away from the drum.
 */
/**
 * Seat parameters for the clean block, anchored to the station LOCATING HOLE.
 *
 * The reliable per-station datum is the plug-joint ORIGIN in `turretJoints.json`
 * — it is the centre of the connection-plate locating hole the block seats onto
 * (station 1: [32.361, 12.116, 71.541]; radius ≈16.3 cm, axial ≈+8.12 cm from
 * the ring centre). Measured from `turret-haas-st20y.glb` at that hole (see
 * `scripts/measure-hole-flat.mjs`), the mounting FLAT the block presses onto is
 * at that same radius (top-5% contact radius ≈16.3 cm, per-station 16.1–16.5),
 * i.e. the joint origin lies ON the flat. So we do NOT synthesise a radius — we
 * put the block's +Z mounting FACE exactly on the joint origin.
 *
 * The block's +Z mounting flange face is FACE_OFFSET_CM (=1.2 cm, blockMcs body
 * AABB max z) out along +Z from the MCS origin; +Z presses radially INWARD, so
 * the MCS origin must sit FACE_OFFSET_CM radially OUTWARD of the hole for the
 * face to land on it:  O = jointOrigin + FACE_OFFSET_CM · radialOut.
 *
 * This satisfies both of the user's constraints deterministically:
 *   1. O shares the hole's axial + tangential position, so the block's Z-axis
 *      (radial) LINE passes through the hole (no drum-axis offset), and
 *   2. the mounting face contacts the flat (mountFaceGap ≈ 0), dropping the
 *      block ~3.4 cm from the earlier synthesised radius-20.9 seat.
 *
 * `radialNudgeCm`/`axialNudgeCm` (default 0) are live-tune dials via
 * window.__turretSeat for any residual mesh-vs-datum discrepancy.
 */
const CLEAN_SEAT = {
  /**
   * Radial offset of the MCS origin from the locating hole (cm, +out).
   *
   * Value = the EXACT seat read from the Fusion rigid joint (ground truth),
   * not a heuristic. The block's design origin coincides with its MCS (proven:
   * in `Haas ST-20Y-25 (Turret Assembly TBMCS).step` the GLB body AABB, frame B,
   * is contained in the assembly body AABB, frame A, sharing the +x/+z corner —
   * so frame A origin == frame B origin == MCS). The joint's block-in-turret
   * transform therefore places the MCS at radial 17.769 cm from the drum axis,
   * on the locating-hole plane (axial offset 0). The station holes sit at radius
   * 16.302 cm, so the MCS is 1.467 cm radially OUTWARD of the hole:
   *     faceOffsetCm = 17.769 − 16.302 = 1.467.
   * (Supersedes the earlier 0/0.99 guesses — 0 seated the block ~1 cm too deep,
   * 0.99 was ~0.5 cm too deep. Recompute with
   * `python3 scripts/compute-block-seat-from-assembly.py` helpers if the joint
   * changes.) The MCS's off-plane bridge is unreliable (near-planar plug ring),
   * so this is derived in the ring frame as radial/axial, which is robust.
   */
  faceOffsetCm: 1.467,
  /** extra radial standoff for dial-in (cm, +out); 0 = face on the flat. */
  radialNudgeCm: 0,
  /** axial nudge along the drum axis for dial-in (cm, +forward); 0 = through hole. */
  axialNudgeCm: 0,
  /** block mesh scale (cm↔cm). */
  scale: 1,
};

// (origin-on-hole: faceOffsetCm=0 per user request)
function cleanSeatParams(): typeof CLEAN_SEAT {
  const override =
    typeof window !== "undefined"
      ? (window as unknown as { __turretSeat?: Partial<typeof CLEAN_SEAT> }).__turretSeat
      : undefined;
  return override === undefined ? CLEAN_SEAT : { ...CLEAN_SEAT, ...override };
}

/** Drum frame (centre, axis, and outward radial) at a station's locating hole. */
function holeFrame(stationNumber: number): { hole: V3; radialOut: V3; axis: V3 } | null {
  const station = turretJoints.stations.find((s) => s.station === stationNumber);
  if (station === undefined) return null;
  const center = turretJoints.ringCenterGlb as V3;
  const axis = normalize(turretJoints.ringAxisGlb as V3); // drum axis, +ve = forward/front
  const hole = station.origin as V3;
  const dO = sub(hole, center);
  const radialOut = normalize(sub(dO, scaleV(axis, dot(dO, axis))));
  return { hole, radialOut, axis };
}

/**
 * Seat the CLEAN block so its mounting face sits on the station locating hole.
 *
 * Orientation (verified against the Fusion rigid-joint ground truth in
 * `turretBlockSeat.json`, unchanged — position-only fix): the block-local axes
 * map onto the drum frame as
 *   • block +X (toolForwardAxis) → drum axis pointing FORWARD (toward the
 *     numbered front / spindle), so the drills/taps cantilever past the front,
 *   • block +Z (intoFaceAxis)    → radially INWARD, pressing the mounting face
 *     onto the flat,
 *   • block +Y                   → cross(+Z, +X), completing the frame.
 * Its columns are [-1,0,0], [0,0.5736,0.8192], [0,0.8192,-0.5736] in the drum
 * frame — matching ground truth. det(R)=+1.
 *
 * Position: O = jointOrigin + faceOffset·radialOut (+ nudges). Because O sits
 * radially outward of the hole on the SAME radial line, the block's Z-axis
 * passes through the hole and the +Z mounting face lands exactly on it.
 * Returns a column-major glTF node matrix.
 */
function jointBlockPlacement(stationNumber: number): Mat4 {
  const f = holeFrame(stationNumber);
  if (f === null) {
    // Missing station: fall back to identity so composition still succeeds
    // (block sits at the turret origin) rather than throwing.
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  const seat = cleanSeatParams();
  const { hole, radialOut, axis } = f;

  // Drum-frame target axes for the block's local axes.
  const tX = axis; // block +X (tool-forward) → drum axis forward
  const tZ = scaleV(radialOut, -1); // block +Z (into-face) → radially inward
  const tY = normalize(cross(tZ, tX)); // block +Y = Z × X

  // MCS origin = locating hole + mounting-face offset radially outward, so the
  // +Z face lands on the hole/flat and the Z-axis passes through the hole.
  const O: V3 = add(
    add(hole, scaleV(radialOut, seat.faceOffsetCm + seat.radialNudgeCm)),
    scaleV(axis, seat.axialNudgeCm),
  );

  const s = seat.scale;
  return [
    tX[0] * s, tX[1] * s, tX[2] * s, 0,
    tY[0] * s, tY[1] * s, tY[2] * s, 0,
    tZ[0] * s, tZ[1] * s, tZ[2] * s, 0,
    O[0], O[1], O[2], 1,
  ];
}

/**
 * Column-major transform that rotates a solid — already modelled flush on its
 * base station (station 1) — onto `stationNumber` by a rigid rotation of
 * `(stationNumber-1)·step` about the drum `axis` through `center`. Station 1 is
 * the identity, so a solid split from the seated assembly lands exactly where
 * the CAD put it, and the drum's 12-fold symmetry carries it flush to any other.
 */
function axisRotationPlacement(
  axis: V3,
  center: V3,
  step: number,
  stationNumber: number,
): Mat4 {
  const k = normalize(axis);
  const angle = (stationNumber - 1) * step;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const [kx, ky, kz] = k;
  const t = 1 - c;
  const col0: V3 = [c + kx * kx * t, ky * kx * t + kz * s, kz * kx * t - ky * s];
  const col1: V3 = [kx * ky * t - kz * s, c + ky * ky * t, kz * ky * t + kx * s];
  const col2: V3 = [kx * kz * t + ky * s, ky * kz * t - kx * s, c + kz * kz * t];
  const rc: V3 = [
    col0[0] * center[0] + col1[0] * center[1] + col2[0] * center[2],
    col0[1] * center[0] + col1[1] * center[1] + col2[1] * center[2],
    col0[2] * center[0] + col1[2] * center[1] + col2[2] * center[2],
  ];
  const tr = sub(center, rc);
  return [
    col0[0], col0[1], col0[2], 0,
    col1[0], col1[1], col1[2], 0,
    col2[0], col2[1], col2[2], 0,
    tr[0], tr[1], tr[2], 1,
  ];
}

// The CAD block (`block-cad.glb`) now seats through the attach-point engine
// below (registered in ATTACH_POINTS with baseStation 1), which composes the
// same drum rotation about the CAD axis — see `drumRotation` /
// `attachPointPlacement`. The previous standalone `cadBlockPlacement` helper is
// therefore folded into that engine with no change in the resulting matrix.

function realBlockPlacement(stationNumber: number): Mat4 {
  const axis = normalize(ring.axis as V3);
  const center = ring.center as V3;
  const step = (ring as { stationStep: number }).stationStep;
  const angle = (stationNumber - 1) * step;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const [kx, ky, kz] = axis;
  const t = 1 - c;
  // Rodrigues rotation R about the unit drum axis; columns are R·x, R·y, R·z.
  const col0: V3 = [c + kx * kx * t, ky * kx * t + kz * s, kz * kx * t - ky * s];
  const col1: V3 = [kx * ky * t - kz * s, c + ky * ky * t, kz * ky * t + kx * s];
  const col2: V3 = [kx * kz * t + ky * s, ky * kz * t - kx * s, c + kz * kz * t];
  // Rotate about the axis *through the drum centre*: translation = C − R·C.
  const rc: V3 = [
    col0[0] * center[0] + col1[0] * center[1] + col2[0] * center[2],
    col0[1] * center[0] + col1[1] * center[1] + col2[1] * center[2],
    col0[2] * center[0] + col1[2] * center[1] + col2[2] * center[2],
  ];
  const tr = sub(center, rc);
  return [
    col0[0], col0[1], col0[2], 0,
    col1[0], col1[1], col1[2], 0,
    col2[0], col2[1], col2[2], 0,
    tr[0], tr[1], tr[2], 1,
  ];
}

/* Attach-point contract (Path B) ---------------------------------------------
 *
 * A reusable way to seat ANY tool assembly on ANY station, generalising the
 * proven CAD-block path without changing it. The whole drum (turret + every
 * seated block) is 12-fold symmetric, so a block that sits flush on ONE station
 * lands flush on all the others by a pure rigid rotation about the drum axis.
 *
 * We therefore describe each assembly by a single `seatBase` transform: where
 * the block's own frame sits in the CAD world when mounted on STATION 1. The
 * station-N placement is then always
 *
 *     placement(N) = drumRotation(N) · seatBase
 *
 * where `drumRotation(N)` rotates station 1 → N about the CAD drum axis. The
 * existing CAD block is exactly the special case `seatBase = identity` (it was
 * split from the seated assembly already sitting on station 1), so routing it
 * through this engine reproduces `cadBlockPlacement` bit-for-bit — no existing
 * behaviour changes. New assemblies just supply their own `seatBase`, obtained
 * either from the split pipeline (`baseStation`) or from an authored mount datum
 * / MCS (`seatBaseFromDatum`). See the ATTACH_POINTS registry below for the
 * step-by-step of onboarding a new assembly.
 */

const IDENTITY4: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Column-major 4×4 product a·b (b applied first, then a). */
function mul4(a: Mat4, b: Mat4): Mat4 {
  const out = new Array(16).fill(0) as unknown as Mat4;
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      let s = 0;
      for (let k = 0; k < 4; k += 1) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

/**
 * Inverse of a RIGID transform (rotation R + translation t): Rᵀ and −Rᵀ·t.
 *
 * Used to turn "the block is modelled seated on station k" into a station-1
 * `seatBase`, i.e. seatBase = drumRotation(k)⁻¹, so that placement(k) lands the
 * block exactly as the CAD modelled it and every other station follows by the
 * drum rotation. Assumes the upper-left 3×3 is orthonormal (it always is here —
 * these are rigid drum rotations).
 */
function invRigid(m: Mat4): Mat4 {
  // Rᵀ (transpose the rotation block).
  const r00 = m[0], r01 = m[4], r02 = m[8];
  const r10 = m[1], r11 = m[5], r12 = m[9];
  const r20 = m[2], r21 = m[6], r22 = m[10];
  const tx = m[12], ty = m[13], tz = m[14];
  // −Rᵀ·t
  const itx = -(r00 * tx + r01 * ty + r02 * tz);
  const ity = -(r10 * tx + r11 * ty + r12 * tz);
  const itz = -(r20 * tx + r21 * ty + r22 * tz);
  return [
    r00, r10, r20, 0,
    r01, r11, r21, 0,
    r02, r12, r22, 0,
    itx, ity, itz, 1,
  ];
}

/** Rigid rotation of the drum carrying station 1 → `stationNumber`. */
function drumRotation(stationNumber: number): Mat4 {
  const axis = cadAssembly.drumAxis as V3;
  const center = cadAssembly.drumCenter as V3;
  const step = ((cadAssembly.stationStepDeg as number) * Math.PI) / 180;
  return axisRotationPlacement(axis, center, step, stationNumber);
}

/**
 * General seater (Path B): place a block whose station-1 seat is `seatBase` onto
 * `stationNumber` by the drum rotation. With `seatBase = identity` this is
 * exactly `cadBlockPlacement`, so the proven block is unchanged.
 */
export function attachPointPlacement(stationNumber: number, seatBase: Mat4): Mat4 {
  return mul4(drumRotation(stationNumber), seatBase);
}

/**
 * A block's mount datum (MCS) for an independently-authored assembly — i.e. a
 * block GLB in its OWN local frame that has not been through the split pipeline.
 *
 * It names the block-local axes that mate to the station and the local point
 * that lands on the plug: `intoFaceAxis` presses INTO the coupling facet (turns
 * to radially-inward at the seat), `toolForwardAxis` is the direction the tools
 * point (turns to drum-axis forward), and `mcsOrigin` is the block-local point
 * that sits on the station-1 plug origin. `scale` converts the block's units to
 * the CAD metre frame. This mirrors the axis convention `jointBlockPlacement`
 * uses for the clean block, so an MCS authored there transfers directly.
 */
export interface MountDatum {
  intoFaceAxis: V3;
  toolForwardAxis: V3;
  mcsOrigin: V3;
  /** Block units → CAD metres (default 1). */
  scale?: number;
}

/** The turret's station-1 plug/mount frame, expressed in the CAD world frame. */
interface PlugFrame {
  origin: V3;
  /** Radially-inward at the facet (block `intoFaceAxis` maps onto this). */
  intoFace: V3;
  /** Drum-axis forward (block `toolForwardAxis` maps onto this). */
  toolForward: V3;
}

/**
 * Station-1 plug frame in the CAD world frame, derived from `cadAssembly.json`.
 *
 * `toolForward` is the drum axis (tools cantilever forward); `intoFace` is the
 * inward radial at the seated block's facet (the block presses onto the flat);
 * `origin` is the plug point on the plug ring at the block's facet — the drum
 * centre carried out to the plug-ring radius along the block's radial, at the
 * block's axial station. This is the datum an MCS block mates to and is only
 * consulted for datum-based assemblies (the CAD block never touches it), so it
 * cannot affect existing seating. Validate/refine it against the first real MCS
 * assembly; the split pipeline (`baseStation`) path needs no plug frame at all.
 */
function stationOnePlugFrame(): PlugFrame {
  const center = cadAssembly.drumCenter as V3;
  const axis = normalize(cadAssembly.drumAxis as V3);
  const radialOut = normalize(cadAssembly.blockRadialDir as V3);
  const blockCenter = cadAssembly.blockCenter as V3;
  const radius = cadAssembly.plugRingRadiusMean as number;
  // Plug origin: drum centre pushed to the block's axial position, then out to
  // the plug-ring radius along the block's radial direction.
  const axialOffset = dot(sub(blockCenter, center), axis);
  const onAxis = add(center, scaleV(axis, axialOffset));
  const origin = add(onAxis, scaleV(radialOut, radius));
  return { origin, intoFace: scaleV(radialOut, -1), toolForward: axis };
}

/**
 * Build the station-1 `seatBase` that carries a block's MCS onto the plug frame.
 *
 * Maps the block-local mount axes onto the plug-frame axes (tool-forward and
 * into-face) and translates the (scaled) MCS origin onto the plug origin. The
 * result is a rigid block-local → CAD-world transform seating the block on
 * station 1; `attachPointPlacement` then rotates it to any station.
 */
export function seatBaseFromDatum(datum: MountDatum, plug: PlugFrame = stationOnePlugFrame()): Mat4 {
  const scale = datum.scale ?? 1;
  // Orthonormal local basis [forward, up, into] from the datum's two axes.
  const lF = normalize(datum.toolForwardAxis);
  const lIraw = normalize(datum.intoFaceAxis);
  const lU = normalize(cross(lIraw, lF));
  const lI = normalize(cross(lF, lU)); // re-orthogonalise into-face
  // Matching target basis in the plug frame.
  const tF = normalize(plug.toolForward);
  const tIraw = normalize(plug.intoFace);
  const tU = normalize(cross(tIraw, tF));
  const tI = normalize(cross(tF, tU));
  // Rotation R mapping local→world: R·lF = tF, R·lU = tU, R·lI = tI, so
  // R = [tF tU tI]·[lF lU lI]ᵀ. Column k of R is Σ_j t_j · (local_j)_k.
  const ls = [lF, lU, lI];
  const ts = [tF, tU, tI];
  const rotCol = (k: number): V3 => {
    let acc: V3 = [0, 0, 0];
    for (let j = 0; j < 3; j += 1) acc = add(acc, scaleV(ts[j], ls[j][k]));
    return acc;
  };
  const col0 = rotCol(0);
  const col1 = rotCol(1);
  const col2 = rotCol(2);
  // Translation so the scaled MCS origin lands on the plug origin.
  const so = scaleV(datum.mcsOrigin, scale);
  const rso: V3 = [
    col0[0] * so[0] + col1[0] * so[1] + col2[0] * so[2],
    col0[1] * so[0] + col1[1] * so[1] + col2[1] * so[2],
    col0[2] * so[0] + col1[2] * so[1] + col2[2] * so[2],
  ];
  const t = sub(plug.origin, rso);
  return [
    col0[0] * scale, col0[1] * scale, col0[2] * scale, 0,
    col1[0] * scale, col1[1] * scale, col1[2] * scale, 0,
    col2[0] * scale, col2[1] * scale, col2[2] * scale, 0,
    t[0], t[1], t[2], 1,
  ];
}

/**
 * The attach-point contract: how each seatable assembly mounts on a station.
 *
 * Keyed by a stable fragment of the block GLB URL (surviving Vite hashing, like
 * CALIBRATIONS). Provide exactly one of:
 *   • `baseStation` — the station the block GLB is modelled/seated on after the
 *     split pipeline (`scripts/split-assembly-cad.py`). seatBase is then a pure
 *     drum rotation, needing NO calibration. The CAD block uses baseStation 1
 *     (identity), so it is byte-for-byte the previous `cadBlockPlacement`.
 *   • `datum` — an authored MCS for a block in its own local frame; seatBase is
 *     `seatBaseFromDatum`.
 *
 * To add a new assembly: ship its block GLB, map its geometryId to that URL in
 * `solidUrlForRecord`, and add one entry here. Existing entries are untouched.
 */
interface AttachPoint {
  match: RegExp;
  baseStation?: number;
  datum?: MountDatum;
}

const ATTACH_POINTS: AttachPoint[] = [
  // Ground-truth CAD block: split from the seated assembly on station 1, so its
  // station-1 seat is the identity. This is the exact previous behaviour.
  { match: /block-cad/, baseStation: 1 },

  // ── How to add ANOTHER assembly on a DIFFERENT station ──────────────────
  // 1. Ship its block GLB under src/assets/models and import it (like
  //    `blockCadUrl`), then map its geometryId → that URL in `solidUrlForRecord`.
  // 2. Add ONE entry here describing how it seats, choosing a source:
  //
  //  (a) PIPELINE (recommended, no calibration): export the assembly seated on
  //      any plug in Fusion in the SAME frame as turret-cad.glb, run it through
  //      `scripts/split-assembly-cad.py`, and note which station it sits on.
  //        { match: /my-block/, baseStation: 4 },
  //      Its seat is then a pure drum rotation and it lands flush on all 12.
  //
  //  (b) MCS DATUM (block authored in its own local frame): give the block-local
  //      axes that mate to the plug and the local point that sits on it. Units
  //      are converted to metres via `scale`.
  //        {
  //          match: /my-block/,
  //          datum: {
  //            toolForwardAxis: [1, 0, 0], // local axis the tools point along
  //            intoFaceAxis: [0, 0, 1],    // local axis pressed INTO the facet
  //            mcsOrigin: [0, 0, 0],       // local point seated on the plug
  //            scale: 1,                   // block units → metres
  //          },
  //        },
  //      The datum mates to `stationOnePlugFrame()`; validate the first MCS block
  //      visually and refine that frame if needed. Neither form touches the CAD
  //      block or any other existing path.
];

/** The station-1 `seatBase` for a solid URL, or null if it has no attach point. */
function seatBaseFor(solidUrl: string): Mat4 | null {
  const entry = ATTACH_POINTS.find((a) => a.match.test(solidUrl));
  if (entry === undefined) return null;
  if (entry.datum !== undefined) return seatBaseFromDatum(entry.datum);
  const base = entry.baseStation ?? 1;
  // seatBase = drumRotation(base)⁻¹, so placement(base) reproduces the modelled
  // seat and every other station follows by the drum rotation. base 1 → identity.
  return base === 1 ? IDENTITY4 : invRigid(drumRotation(base));
}

export function stationPlacementMatrix(stationNumber: number, solidUrl: string): Mat4 {
  // The real block shares the turret's coordinate frame, so it seats by rotation
  // about the drum axis alone (flush by construction). Other solids still use
  // the per-solid calibration below.
  if (/toolblock-3x-real/.test(solidUrl)) return realBlockPlacement(stationNumber);

  // Attach-point contract (Path B): any assembly registered in ATTACH_POINTS
  // seats via placement(N) = drumRotation(N) · seatBase. The CAD block is
  // registered with baseStation 1 (seatBase = identity), so this reproduces the
  // previous cadBlockPlacement exactly; new assemblies plug in here without
  // touching any other path.
  const seatBase = seatBaseFor(solidUrl);
  if (seatBase !== null) return attachPointPlacement(stationNumber, seatBase);

  // The clean block seats by a single rigid MCS→UCS snap from the extracted
  // per-station joint frames (turretJoints.json) — flush and correctly oriented
  // with no calibration.
  if (/toolblock-3x-clean/.test(solidUrl)) return jointBlockPlacement(stationNumber);

  const frame = stationFrame(stationNumber);
  const cal = calibrationFor(solidUrl);

  // Local orthonormal frame from the calibrated axes: e1 = up, e2 = mountNormal.
  const e1 = normalize(cal.up);
  const e2 = normalize(cal.mountNormal);
  const e3 = normalize(cross(e1, e2));

  // World targets: tool axis → forward (axis), pins → into the facet (−radial).
  const t1 = frame.axis;
  const t2 = scaleV(frame.radial, -1);
  const t3 = normalize(cross(t1, t2));

  // Rotation R = [t1 t2 t3]·[e1 e2 e3]ᵀ; its columns are the images of local x,y,z.
  const es = [e1, e2, e3];
  const ts = [t1, t2, t3];
  const rotCol = (k: number): V3 => {
    let c: V3 = [0, 0, 0];
    for (let j = 0; j < 3; j += 1) c = add(c, scaleV(ts[j], es[j][k]));
    return c;
  };
  const col0 = scaleV(rotCol(0), cal.scale);
  const col1 = scaleV(rotCol(1), cal.scale);
  const col2 = scaleV(rotCol(2), cal.scale);

  // Where the solid's (recentred) origin lands: on the face, offset along frame.
  const origin = add(
    add(
      add(frame.origin, scaleV(frame.radial, cal.offset[0])),
      scaleV(frame.axis, cal.offset[1]),
    ),
    scaleV(frame.tangent, cal.offset[2]),
  );

  // translation = origin − M3·recenter, so the recentred solid sits at origin.
  const m3r: V3 = [
    col0[0] * cal.recenter[0] + col1[0] * cal.recenter[1] + col2[0] * cal.recenter[2],
    col0[1] * cal.recenter[0] + col1[1] * cal.recenter[1] + col2[1] * cal.recenter[2],
    col0[2] * cal.recenter[0] + col1[2] * cal.recenter[1] + col2[2] * cal.recenter[2],
  ];
  const t = sub(origin, m3r);

  return [
    col0[0], col0[1], col0[2], 0,
    col1[0], col1[1], col1[2], 0,
    col2[0], col2[1], col2[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

/**
 * Block-body AABB in the caps mesh's own space, measured (not eyeballed) with
 * `node scripts/measure-block.mjs`. Feeds the seating self-check below so we can
 * prove alignment in millimetres instead of comparing screenshots.
 */
const CAPS_BODY_AABB: { min: V3; max: V3 } = {
  min: [-3.75, -8.79, -10.55],
  max: [5.25, 3.75, 1.2],
};

function applyMat(m: Mat4, p: V3): V3 {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

/** Signed millimetre gaps between the seated block's faces and the turret. */
export interface SeatingCheck {
  /** How far the block's +Z mounting face sits off the flat (0 = flush; + = proud). */
  mountFaceGap: number;
  /** How far the block's +X front face sits off the turret's front plane (0 = coplanar). */
  frontFaceGap: number;
}

/**
 * Measure, in millimetres, how the seatable block lands on a station — so
 * seating can be verified numerically rather than by eye. Returns the signed
 * gap of the block's mounting face from the rim facet and of its front face
 * from the turret's numbered front plane; both should be ~0 when seated.
 *
 * For the CLEAN block the reference is the station LOCATING HOLE (joint origin):
 * mountFaceGap is the block's +Z mounting-face radius minus the hole radius (so
 * 0 = face on the flat), and frontFaceGap is the +X body face's axial position
 * relative to the drum's front plane.
 */
export function describeSeating(stationNumber: number, solidUrl: string): SeatingCheck {
  const m = stationPlacementMatrix(stationNumber, solidUrl);
  const c = CAPS_BODY_AABB;
  const mid = (d: 0 | 1 | 2): number => (c.min[d] + c.max[d]) / 2;
  const mountFaceLocal: V3 = [mid(0), mid(1), c.max[2]]; // +Z face centre (pins side)
  const frontFaceLocal: V3 = [c.max[0], mid(1), mid(2)]; // +X body face centre (tools side)
  const mountWorld = applyMat(m, mountFaceLocal);
  const frontWorld = applyMat(m, frontFaceLocal);

  const clean = /toolblock-3x-clean/.test(solidUrl);
  const f = clean ? holeFrame(stationNumber) : null;
  if (clean && f !== null) {
    const { hole, radialOut, axis } = f;
    const holeRadius = dot(sub(hole, turretJoints.ringCenterGlb as V3), radialOut);
    const faceRadius = dot(sub(mountWorld, turretJoints.ringCenterGlb as V3), radialOut);
    const frontAxial = (ring as { frontAxial: number }).frontAxial;
    const center = turretJoints.ringCenterGlb as V3;
    return {
      // cm → mm; + means the face is radially proud of (outside) the flat.
      mountFaceGap: (faceRadius - holeRadius) * 10,
      frontFaceGap: (dot(sub(frontWorld, center), axis) - frontAxial) * 10,
    };
  }

  const frame = stationFrame(stationNumber);
  const center = ring.center as V3;
  const axis = normalize(ring.axis as V3);
  const frontAxial = (ring as { frontAxial: number }).frontAxial;

  return {
    mountFaceGap: dot(sub(mountWorld, frame.origin), frame.radial),
    frontFaceGap: dot(sub(frontWorld, center), axis) - frontAxial,
  };
}


