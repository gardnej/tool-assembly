/**
 * Scratch test of the real mount routing PLUS a visual coordinate-frame
 * diagnostic overlay. Builds a SavedAssembly that uses the preview 3X
 * Spot-Drill-Tap block (exactly what the workflow saves), runs it through
 * `assemblyMount` + `stationPlacementMatrix` + `composeTurretGlb` — the same
 * code the prototype's Viewport uses — and additionally composes RGB axis-triad
 * gizmos so the coordinate frames that drive block seating are visible:
 *   • drum-center / axis frame (turret ring): X=red radial-out, Y=green tangent,
 *     Z=blue drum axis (forward),
 *   • station-seat frame (the block MCS, from `stationPlacementMatrix`): X=red
 *     tool-forward, Y=green, Z=blue into-face,
 *   • (smaller) raw joint origin for the station, to visualise the seat offset.
 * An on-screen readout prints the composed 4×4 placement matrix, its origin and
 * axis columns, and the `describeSeating` mm gaps. Not part of the app bundle.
 *
 * URL switches: ?station=N (default 1), ?triads=0 to hide the gizmos,
 * ?labels=0 to hide the 3D coordinate hotspots (default on).
 */
import { composeTurretGlb, type Mat4 } from "./lib/composeGlb";
import { stationPlacementMatrix, assemblyMount, describeSeating } from "./data/turretSolids";
import { upsertSessionAssembly } from "./data/libraryEdits";
import { PREVIEW_BLOCK_GEOMETRY_ID } from "./data/previewGeometry";
import turretUrl from "./assets/models/turret-haas-st20y.glb?url";
import axisTriadUrl from "./assets/models/axis-triad.glb?url";
import ring from "./data/turretStations.json";
import turretJoints from "./data/turretJoints.json";
import type { SavedAssembly } from "./types";

type V3 = [number, number, number];

const params = new URLSearchParams(location.search);
const station = Number(params.get("station") ?? "1") || 1;
const showTriads = params.get("triads") !== "0";
const showLabels = params.get("labels") !== "0";

/* ------------------------------------------------------------------ vectors */
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scaleV = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: V3): V3 => {
  const m = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / m, a[1] / m, a[2] / m];
};

/** Column-major node matrix from three axis columns (world dirs) + origin. */
function frameMatrix(colX: V3, colY: V3, colZ: V3, origin: V3, scale = 1): Mat4 {
  const x = scaleV(colX, scale);
  const y = scaleV(colY, scale);
  const z = scaleV(colZ, scale);
  return [
    x[0], x[1], x[2], 0,
    y[0], y[1], y[2], 0,
    z[0], z[1], z[2], 0,
    origin[0], origin[1], origin[2], 1,
  ];
}

/* ------------------------------------------------ synthetic saved assembly */
const assembly: SavedAssembly = {
  id: "assembly-routingtest-hub",
  libraryId: "hub-team",
  name: "Routing test",
  vendor: "",
  productId: "",
  productLink: "",
  blockToolId: "preview-block-3x-spot-drill-tap",
  slots: [{ stack: ["preview-extension-6"], stationNumber: null, halfIndex: false }],
  config: {
    orientation: "axial",
    machineSideConnectionType: "Unspecified",
    numberOfTools: 3,
    numberOfAttachmentPoints: 0,
    adaptiveItemSize: 0,
    stationNumber: null,
    halfIndex: false,
  },
  createdAt: Date.now(),
};
upsertSessionAssembly(assembly);

const bar = document.getElementById("bar");
const mv = document.getElementById("mv") as (HTMLElement & { src?: string }) | null;

const mount = assemblyMount("assembly-routingtest");

/* --------------------------------------------------- drum-center triad frame */
// Origin = ring centre; Z(blue) = drum axis forward; X(red) = radial-out toward
// station 1; Y(green) = tangent = axis × radial. Uses the same ring data the
// seating math consumes (turretStations.json).
function drumCenterMatrix(): Mat4 {
  const center = ring.center as V3;
  const axis = normalize(ring.axis as V3);
  const s1 = ring.stations.find((s) => s.number === 1)?.position as V3 | undefined;
  const fromCenter = sub(s1 ?? [center[0] + 1, center[1], center[2]], center);
  const radialOut = normalize(sub(fromCenter, scaleV(axis, dot(fromCenter, axis))));
  const tangent = normalize(cross(axis, radialOut));
  // Slightly larger so the drum frame reads as the "master" frame.
  return frameMatrix(radialOut, tangent, axis, center, 1.3);
}

/* -------------------------------------------------- raw joint-origin triad */
// Smaller triad at the station's raw plug-joint origin (radius ≈16.3 cm), to
// visualise the ~3.4 cm offset from the seated MCS on the outer flat (≈19.7 cm).
function jointOriginMatrix(): Mat4 | null {
  const j = turretJoints.stations.find((s) => s.station === station);
  if (j === undefined) return null;
  const center = turretJoints.ringCenterGlb as V3;
  const axis = normalize(turretJoints.ringAxisGlb as V3);
  const dO = sub(j.origin as V3, center);
  const radialOut = normalize(sub(dO, scaleV(axis, dot(dO, axis))));
  const tangent = normalize(cross(axis, radialOut));
  return frameMatrix(radialOut, tangent, axis, j.origin as V3, 0.6);
}

/* -------------------------------------------------------------- readout text */
const fmt = (n: number, dp = 4): string => n.toFixed(dp).padStart(9);
const fmtV = (v: V3, dp = 4): string => `[${fmt(v[0], dp)},${fmt(v[1], dp)},${fmt(v[2], dp)} ]`;
/** Compact `[x.xx, y.xx, z.xx]` for the 3D hotspot labels. */
const fmtC = (v: V3): string => `[${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)}]`;

/**
 * Pin labeled `<model-viewer>` hotspots at world points, in the model's own
 * coordinate units. The composed GLB carries raw CENTIMETRE coordinates, so
 * `data-position` uses those raw cm numbers directly (verified on screen — a
 * label lands exactly on the block origin, confirming model-viewer is NOT
 * reinterpreting the units as metres, i.e. no ÷100 needed).
 */
interface HotspotSpec {
  key: string;
  pos: V3;
  text: string;
  cls: string;
}

function renderHotspots(specs: HotspotSpec[]): void {
  if (mv === null) return;
  // Clear any previous hotspot buttons (harness may hot-reload).
  mv.querySelectorAll("[slot^='hotspot-']").forEach((el) => el.remove());
  for (const { key, pos, text, cls } of specs) {
    const btn = document.createElement("button");
    btn.setAttribute("slot", `hotspot-${key}`);
    btn.setAttribute("data-position", `${pos[0]} ${pos[1]} ${pos[2]}`);
    btn.setAttribute("data-normal", "0 0 1");
    btn.className = `hs ${cls}`;
    const dot = document.createElement("span");
    dot.className = "hs-dot";
    const label = document.createElement("span");
    label.className = "hs-label";
    label.textContent = text;
    btn.append(dot, label);
    mv.appendChild(btn);
  }
}

function matrixReadout(url: string): string {
  const m = stationPlacementMatrix(station, url);
  const O: V3 = [m[12], m[13], m[14]];
  const cX: V3 = [m[0], m[1], m[2]];
  const cY: V3 = [m[4], m[5], m[6]];
  const cZ: V3 = [m[8], m[9], m[10]];
  const seat = describeSeating(station, url);
  // Row-major display of the column-major matrix.
  const row = (r: 0 | 1 | 2 | 3): string =>
    `[ ${fmt(m[r])} ${fmt(m[r + 4])} ${fmt(m[r + 8])} ${fmt(m[r + 12])} ]`;
  return [
    `── station ${station} · seat placement matrix (column-major glTF) ──`,
    row(0),
    row(1),
    row(2),
    row(3),
    ``,
    `O (seat origin, cm)   ${fmtV(O)}`,
    `X axis (red,  col0)   ${fmtV(cX)}`,
    `Y axis (green,col1)   ${fmtV(cY)}`,
    `Z axis (blue, col2)   ${fmtV(cZ)}`,
    ``,
    `mountFaceGap  ${seat.mountFaceGap.toFixed(3)} mm  (block +Z face vs rim facet)`,
    `frontFaceGap  ${seat.frontFaceGap.toFixed(3)} mm  (block +X face vs front plane)`,
    ``,
    deltaReadout(url),
  ].join("\n");
}

/**
 * Block origin O vs the station hole (joint origin): the raw delta vector, its
 * magnitude, and its decomposition along the drum axis, the radial-out, and the
 * tangent — so the seat discrepancy is quantified along meaningful directions.
 */
function deltaReadout(url: string): string {
  const m = stationPlacementMatrix(station, url);
  const O: V3 = [m[12], m[13], m[14]];
  const j = turretJoints.stations.find((s) => s.station === station);
  if (j === undefined) return "hole: n/a for this station";
  const hole = j.origin as V3;
  const center = ring.center as V3;
  const axis = normalize(ring.axis as V3);
  const dFromCenter = sub(hole, center);
  const radialOut = normalize(sub(dFromCenter, scaleV(axis, dot(dFromCenter, axis))));
  const tangent = normalize(cross(axis, radialOut));
  const delta = sub(O, hole);
  const mag = Math.hypot(delta[0], delta[1], delta[2]);
  return [
    `── block origin O vs station hole (Δ = O − hole) ──`,
    `hole (cm)             ${fmtV(hole)}`,
    `Δ vector (cm)         ${fmtV(delta)}`,
    `|Δ| magnitude         ${mag.toFixed(3)} cm  (${(mag * 10).toFixed(2)} mm)`,
    `Δ·axis  (forward)     ${dot(delta, axis).toFixed(3)} cm`,
    `Δ·radial(outward)     ${dot(delta, radialOut).toFixed(3)} cm`,
    `Δ·tangent             ${dot(delta, tangent).toFixed(3)} cm`,
  ].join("\n");
}

/* ------------------------------------------------------------------- compose */
if (mount === null) {
  if (bar !== null) bar.textContent = "no solid resolved for assembly — nothing to compose";
} else {
  const isClean = /toolblock-3x-clean/.test(mount.url);
  const blockMatrix = stationPlacementMatrix(station, mount.url);

  const placements = [
    { url: mount.url, matrix: blockMatrix, keepMaterials: mount.keepMaterials },
  ];

  if (showTriads) {
    // Station-seat triad — identical matrix to the block, so it shows the block
    // MCS axes exactly where the block lands.
    placements.push({ url: axisTriadUrl, matrix: blockMatrix, keepMaterials: undefined });
    // Drum-center / axis frame.
    placements.push({ url: axisTriadUrl, matrix: drumCenterMatrix(), keepMaterials: undefined });
    // Raw joint origin (smaller), if available.
    const jm = jointOriginMatrix();
    if (jm !== null) {
      placements.push({ url: axisTriadUrl, matrix: jm, keepMaterials: undefined });
    }
  }

  const header =
    `geometryId ${PREVIEW_BLOCK_GEOMETRY_ID}\n` +
    `block: ${mount.url.split("/").pop()}  (clean=${isClean})\n` +
    `triads: ${showTriads ? "on" : "off"}  labels: ${showLabels ? "on" : "off"}\n`;

  composeTurretGlb(turretUrl, placements)
    .then((src) => {
      if (mv !== null) mv.src = src;
      if (bar !== null) bar.textContent = header + "\n" + matrixReadout(mount.url);
      if (showLabels) {
        const O: V3 = [blockMatrix[12], blockMatrix[13], blockMatrix[14]];
        const j = turretJoints.stations.find((s) => s.station === station);
        const specs: HotspotSpec[] = [
          { key: "block", pos: O, cls: "hs-block", text: `Block origin  ${fmtC(O)} cm` },
        ];
        if (j !== undefined) {
          const hole = j.origin as V3;
          specs.push({ key: "hole", pos: hole, cls: "hs-hole", text: `Hole  ${fmtC(hole)} cm` });
        }
        specs.push({ key: "drum", pos: ring.center as V3, cls: "hs-drum", text: `Drum center  ${fmtC(ring.center as V3)} cm` });
        // Hotspots must be children of <model-viewer> after its model loads.
        if (mv !== null) {
          const attach = (): void => renderHotspots(specs);
          if ((mv as unknown as { loaded?: boolean }).loaded === true) attach();
          else mv.addEventListener("load", attach, { once: true });
        }
      }
    })
    .catch((err: unknown) => {
      if (bar !== null) bar.textContent = header + `\ncompose failed: ${String(err)}`;
    });
}
