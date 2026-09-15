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

import axialBlockUrl from "../assets/models/3x-axial-block.glb?url";
import previewBlockUrl from "../assets/models/3x-spot-drill-tap.glb?url";
import seatableBlockUrl from "../assets/models/3x-spot-drill-tap-caps.glb?url";
import er16ColletUrl from "../assets/models/er16-collet.glb?url";
import er16ExtensionUrl from "../assets/models/er16-extension.glb?url";
import ring from "./turretStations.json";
import { sessionAssemblies } from "./libraryEdits";
import { assemblyBaseId } from "./turret";
import { toolById, type LibraryToolRecord } from "./realLibrary";
import {
  PREVIEW_BLOCK_GEOMETRY_ID,
  PREVIEW_BLOCK_MATERIAL,
  PREVIEW_SEATS,
} from "./previewGeometry";
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
  if (record.geometryId === PREVIEW_BLOCK_GEOMETRY_ID) return previewBlockUrl;
  if (record.geometryId !== null && AXIAL_BLOCK_GEOMETRY_IDS.has(record.geometryId)) {
    return axialBlockUrl;
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

/** True for blocks we can stand in with the seatable three-seat mesh. */
function isSeatableBlock(block: LibraryToolRecord): boolean {
  return (
    block.geometryId === PREVIEW_BLOCK_GEOMETRY_ID ||
    (block.geometryId !== null && AXIAL_BLOCK_GEOMETRY_IDS.has(block.geometryId))
  );
}

/** Seat bodies of one seat, machine side out: bore body, middle body, tool. */
function seatBodiesByDepth(seat: (typeof PREVIEW_SEATS)[number]): string[][] {
  return [[seat.extension], [seat.collet], seat.tool];
}

/**
 * The solid to mount for an assembly, and the parts of it to reveal.
 *
 * A block we have seat geometry for is shown with the seatable mesh, pruned to
 * the block plus the seat bodies each filled position stacks (machine side
 * out), so the tools the user mounted appear rather than a bare block. Blocks
 * we only have a plain solid for (e.g. ER16 holders) mount whole; assemblies
 * with no solid at all return null and the viewport keeps its baked template.
 */
export function assemblyMount(assemblyBase: string | null): AssemblyMount | null {
  if (assemblyBase === null || assemblyBase === "") return null;
  const record = sessionAssemblies().find((a) => assemblyBaseId(a.id) === assemblyBase);
  if (record === undefined || record.blockToolId === null) return null;
  const block = toolById(record.blockToolId);
  if (block === undefined) return null;

  if (isSeatableBlock(block)) {
    const keep = new Set<string>([PREVIEW_BLOCK_MATERIAL]);
    record.slots.forEach((slot, seatIndex) => {
      const seat = PREVIEW_SEATS[seatIndex];
      if (seat === undefined) return;
      const bodies = seatBodiesByDepth(seat);
      // A component at depth d reveals the d-th seat body, so a stack seats
      // flush against the block face and fills outward from there.
      for (let depth = 0; depth < slot.stack.length && depth < bodies.length; depth += 1) {
        for (const material of bodies[depth]) keep.add(material);
      }
    });
    return { url: seatableBlockUrl, keepMaterials: [...keep] };
  }

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
export function stationPlacementMatrix(stationNumber: number, solidUrl: string): Mat4 {
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
  /** How far the block's +Z mounting face sits off the rim facet (0 = flush). */
  mountFaceGap: number;
  /** How far the block's +X front face sits off the turret's front plane (0 = coplanar). */
  frontFaceGap: number;
}

/**
 * Measure, in millimetres, how the seatable block lands on a station — so
 * seating can be verified numerically rather than by eye. Returns the signed
 * gap of the block's mounting face from the rim facet and of its front face
 * from the turret's numbered front plane; both should be ~0 when seated.
 */
export function describeSeating(stationNumber: number, solidUrl: string): SeatingCheck {
  const frame = stationFrame(stationNumber);
  const m = stationPlacementMatrix(stationNumber, solidUrl);
  const c = CAPS_BODY_AABB;
  const mid = (d: 0 | 1 | 2): number => (c.min[d] + c.max[d]) / 2;
  const mountFaceLocal: V3 = [mid(0), mid(1), c.max[2]]; // +Z face centre (pins side)
  const frontFaceLocal: V3 = [c.max[0], mid(1), mid(2)]; // +X face centre (tools side)
  const mountWorld = applyMat(m, mountFaceLocal);
  const frontWorld = applyMat(m, frontFaceLocal);

  const center = ring.center as V3;
  const axis = normalize(ring.axis as V3);
  const frontAxial = (ring as { frontAxial: number }).frontAxial;

  return {
    mountFaceGap: dot(sub(mountWorld, frame.origin), frame.radial),
    frontFaceGap: dot(sub(frontWorld, center), axis) - frontAxial,
  };
}
