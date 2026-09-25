# Export spec: seating a Fusion turret + assemblies in the prototype

*What data and geometry the Tool Assembly / Turret Setup prototype needs in order
to (a) list individual tools in the library, (b) let a user build an assembly from
them, and (c) seat those assemblies on the turret — reproducing a turret that was
configured in Fusion with up to twelve tool assemblies.*

This document is self-contained so it can be shared with an Autodesk / Fusion
assistant. It describes two data contracts and the export recipe that produces
them. Everything here is already implemented in the prototype; the field names
and shapes are taken from the running code, not invented.

---

## 0. Why not just send the `.f3d` (or an OBJ/STEP of the seated turret)?

- **`.f3d`** contains everything conceptually (component tree, per-assembly
  occurrences, joints/MCS frames, tool identities) but it is a proprietary
  Autodesk container — the prototype's toolchain cannot read it. It must be
  turned into the neutral exports below **from inside Fusion**. One `.f3d` is a
  sufficient *source*; it still needs one export pass.
- **A baked OBJ/STEP of the assembled turret** (already provided earlier) is a
  single merged mesh with generic body names (`Body1`, `Body1:3`, …), no tool
  identities, no per-assembly grouping, and no MCS/joint frames. It can be used
  to *show* a static turret, but not to drive the library → assembly → turret
  workflow. That workflow needs the **structured data** in Contract 1.

So the goal of this spec is to get, out of Fusion, the two things the prototype
actually consumes: a **library JSON** (Contract 1) and a **seated turret GLB +
frame metadata** (Contract 2).

---

## 1. Units, axes, conventions (read first)

- **Library dimensions** (`geometry`, `holder`, `segments`, `gaugeLength`): **millimetres**.
- **Joint frames** (`mcs`, `csw`): **row-major 4×4**, translation in **millimetres**.
- **Turret geometry GLB** (Contract 2): world units **metres** (the frame
  metadata records `"units": "meters"`).
- **Station numbering**: 1..12 around the drum; step is **30°** about the drum axis.
- **The join key between data and geometry is `geometryId`** (a Fusion GUID). The
  same `geometryId` must appear on the tool/block record, in `jointFrames`, and
  (for a rendered solid) map to a GLB. `stepFileName` is provenance only.

---

## 2. Contract 1 — Library JSON

### 2.1 The easy path (preferred): let the existing exporter build it

The prototype already ships `scripts/export-library-snapshot.py`, which reads
Fusion's **on-disk Local tool libraries** and emits this JSON verbatim, including
the MCS/CSW joint frames it lifts from each `.3DTool` geometry header:

```
python3 scripts/export-library-snapshot.py \
  --root "~/Library/Application Support/Autodesk/CAM360/libraries/Local" \
  --out  src/data/realLibrarySnapshot.json
```

**Therefore the lowest-effort route is:** ensure the twelve assemblies and their
component tools exist as records in a Fusion **Local** tool library (each assembly
= a cutting tool carrying a nested tool-block; each component = its own tool),
then run the script. No hand-authoring of JSON.

The schema below is for verification, or for the case where the data is generated
directly from the `.f3d` rather than from the on-disk library.

### 2.2 Top-level shape

```json
{
  "generatedAt": "2026-08-25T08:44:57Z",
  "source": "Fusion local tool libraries",
  "libraries":  [ /* LibraryRef */ ],
  "tools":      [ /* LibraryToolRecord */ ],
  "jointFrames": { "<geometryId>": { /* StoredJointFrames */ } }
}
```

### 2.3 `LibraryRef` (one per library)

```json
{
  "id": "3x-axial",
  "name": "3X Axial",
  "folder": null,
  "breadcrumb": "Local > 3X Axial",
  "version": 37,
  "toolCount": 1,
  "blockCount": 1,
  "assemblyCount": 0
}
```

- `id` — slug of the library path.
- `blockCount` — records of `type: "tool block"`.
- `assemblyCount` — records whose `block` (nested tool-block) is non-null.

### 2.4 `LibraryToolRecord` (one per tool)

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Fusion GUID, stable & unique. |
| `libraryId` | string | Owning library `id`. |
| `type` | string | Fusion type string: `"tool block"`, `"holder"`, `"drill"`, `"turning general"`, `"tap right hand"`, etc. |
| `description` | string | Display name. |
| `vendor` | string | May be `""`. |
| `productId` | string | May be `""`. |
| `productLink` | string | May be `""`. |
| `unit` | string | Usually `"millimeters"`. |
| `geometry` | object | Whitelisted dimension keys (see 2.6). Numbers/strings. |
| `holder` | object \| null | Turning-holder dims (`OAL,CW,H,W,LH,HAND,MTP,THSC`), else `null`. |
| `geometryId` | string \| null | **Join key** to `jointFrames` + rendered geometry. `null` = no solid. |
| `stepFileName` | string \| null | Source STEP/`.stp` filename (provenance). |
| `segments` | HolderSegment[] \| null | Adaptive profile (extensions/collets); drives a mesh-free 2D silhouette. `null` for cutters. |
| `gaugeLength` | number \| null | Fusion gauge length (mm) for adaptive items. |
| `postProcess` | object | `{ number, turret, compensationOffset, stationNumber, halfIndex }`. `stationNumber` = turret station. |
| `block` | NestedBlock \| null | Present when this cutting tool **carries an assembly**. This is what makes a record an "assembly". |

### 2.5 `NestedBlock` (the assembly a cutting tool carries)

```json
{
  "guid": "0511440e-ca98-4bfb-b4d4-78edcf188d95",
  "description": "Test Assembly",
  "vendor": "",
  "productId": "",
  "geometry": {
    "adaptiveItemSize": 0,
    "numberOfAttachmentPoints": 0,
    "numberOfTools": 1,
    "orientationType": "axial",
    "machineSideConnectionType": "Unspecified"
  },
  "geometryId": "2495f719-9192-4668-ad03-c3a002a39a80",
  "stepFileName": "EWS_163950_DIN4003.stp",
  "transformOverride": {
    "rotation":    { "x": 0, "y": 0, "z": 0 },
    "translation": { "x": 0, "y": 0, "z": -10 }
  },
  "postProcess": {
    "stationNumber": 0,
    "halfIndex": false,
    "live": true,
    "maximumRotationalSpeed": 1000
  }
}
```

- `numberOfTools` = seat count of the block (1, 2, 3…). This is the real,
  round-tripping "how many tools sit on this block" field.
- `postProcess.stationNumber` on the block = the turret station this assembly is
  seated on. **This is the field that expresses "which of the twelve".**
- `transformOverride` = optional rigid nudge of the block relative to its frame.

### 2.6 `geometry` keys carried through

`OAL, RE, SC, SCTY, TC, INSD, S, EPSR, RA, LH, DC, LCF, NOF, TP, SIG, LB, SFDM,`
`CSP, HAND, assemblyGaugeLength, shoulder-length, shoulder-diameter,`
`tip-diameter, tip-length, tip-offset, adaptiveItemSize, numberOfAttachmentPoints,`
`numberOfTools, orientationType, machineSideConnectionType`.

`holder` keys: `OAL, CW, H, W, LH, HAND, MTP, THSC`.

### 2.7 `HolderSegment` (adaptive profile, machine-side first, mm)

```json
{ "height": 15.5, "lower-diameter": 22.0, "upper-diameter": 22.0 }
```

An extension/collet is a stack of frusta. Used to draw a real 2D silhouette with
no mesh at all — handy for tools you don't want to export solids for.

### 2.8 `StoredJointFrames` (per `geometryId`) — the seating/gauge datum

```json
{
  "3482e088-0690-4e9f-a4d8-4f1514f4ea90": {
    "stepFileName": "3X Axial",
    "mcs": [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
    "csw": [0,0,-1,52, 0,-1,0,0, -1,0,0,-85, 0,0,0,1]
  }
}
```

- `mcs` — **machine-side** mounting frame (row-major 4×4, mm). How the item bolts
  to the station.
- `csw` — **cutting/workpiece-side** frame (row-major 4×4, mm). Its translation is
  the gauge point relative to the mount (here the tip is 52 mm, −85 mm out).
- These are what make gauge length and seating **measured**, not guessed. The
  exporter lifts them from the `.3DTool` header (`mcs`/`csw` matrices +
  `geometryFileName`); only frames referenced by an exported tool are kept.

---

## 3. Contract 2 — Turret geometry + frame metadata

This is what actually seats a solid on the drum. It is produced by
`scripts/split-assembly-cad.py` from **one seated assembly GLB**, and it emits the
split meshes plus a small `cadAssembly.json` frame descriptor.

### 3.1 What you export from Fusion

**One GLB of the turret with the assemblies seated on it**, in a single
consistent world frame (metres), with parts named so the turret can be told apart
from the mounted tools:

- **Turret parts** must be named with a prefix in `{ "Plug", "Faceplate", "SOLID" }`
  — e.g. `Plug_01 … Plug_12`, `Faceplate`, `SOLID_drum`.
- **Everything else** is treated as a mounted block/tool.
- All **twelve `Plug*`** parts should be present: the script fits the drum axis and
  centre from the twelve plug ring centres, so no axis/centre needs to be measured
  by hand.

If you can additionally export **each block seated on its known station** (or the
whole seated turret) keeping the same world frame, the block lands flush on every
station by pure 30° drum rotation — **no hand calibration**.

### 3.2 `cadAssembly.json` (generated — for reference)

```json
{
  "source": "haas-assembly.glb",
  "units": "meters",
  "turretGlb": "turret-cad.glb",
  "blockGlb": "block-cad.glb",
  "drumCenter": [0.405203, -0.020034, 0.783129],
  "drumAxis":   [0.0, 0.000115, -1.0],
  "plugRingRadiusMean": 0.185281,
  "plugRingRadiusStd":  0.000876,
  "blockCenter":    [0.164668, -0.045232, 0.734206],
  "blockRadialDir": [-0.994555, -0.104212, -1.2e-05],
  "stationStepDeg": 30.0,
  "turretBounds": { "min": [0.211418,-0.213819,0.728519],
                    "max": [0.598988, 0.173751,0.877871] }
}
```

- `drumCenter` / `drumAxis` — fit from the twelve plug centres.
- `stationStepDeg` — 30° (12-fold symmetry); station N = station 1 rotated
  `(N-1)·30°` about `drumAxis` through `drumCenter`.
- `blockCenter` / `blockRadialDir` — where the modelled block sits (its station phase).

### 3.3 Per-station seating (how the prototype places a block)

A block modelled/seated on **station 1** in the turret's own frame lands flush on
any station N by the pure drum rotation above. Alternatively a block authored in
its **own** local frame supplies a mount datum (MCS): the block-local axis that
presses into the coupling face (`intoFaceAxis`), the axis the tools point along
(`toolForwardAxis`), the local origin that lands on the plug (`mcsOrigin`), and a
`scale` to metres. Either way, only one entry per assembly is needed.

---

## 4. The keys that tie data ↔ geometry

1. `LibraryToolRecord.geometryId` (or `NestedBlock.geometryId`)
2. → `jointFrames[geometryId]` (mcs/csw, mm)
3. → a rendered solid (GLB) for that geometry.

All three must share the same `geometryId`. `stepFileName` is traceability back to
CAD and is not used for matching.

---

## 5. Recommended export set for the twelve-assembly turret

To reproduce the seated twelve-up turret **and** the interactive workflow, export
from the `.f3d`:

1. **Library data** — ideally have the twelve assemblies + their component tools in
   a Fusion **Local** tool library, then run `export-library-snapshot.py`. Each
   assembly = a cutting-tool record with a non-null `block`; each component
   (block, holder, extension, collet, cutter) = its own record; include
   `geometryId` + joint frames. `NestedBlock.postProcess.stationNumber` gives the
   station (1..12) for each assembly.
2. **Geometry** — one **seated turret GLB** in a single world frame (metres) with
   turret parts named `Plug*` / `Faceplate*` / `SOLID*` and everything else being
   the mounted tools. Optionally per-block STEP/GLB in that same frame.

Deliver those two and they slot into the prototype with no guessing.

### Minimal vs. full

| Goal | Needs |
|---|---|
| **Static picture** of the seated twelve-up turret | Contract 2 only (seated GLB + naming). Tools are opaque; not individually selectable. |
| **Interactive**: browse tools → build assembly → seat on turret | Contract 1 (library JSON with per-component records, `geometryId`s, joint frames) **and** Contract 2 for the solids you want rendered. |
| **Lightweight tool preview** (no solids) | `segments` on the adaptive records → 2D silhouette, no mesh. |

---

## 6. Source of truth (in this repo)

- Library schema (TypeScript interfaces): `src/data/realLibrary.ts`
  (`LibraryToolRecord`, `NestedBlock`, `HolderSegment`, `ToolPostProcess`,
  `StoredJointFrames`, `LibraryRef`).
- Library generator: `scripts/export-library-snapshot.py`.
- Turret frame generator + naming convention: `scripts/split-assembly-cad.py`;
  output `src/data/cadAssembly.json`.
- Seating logic: `src/data/turretSolids.ts`.
