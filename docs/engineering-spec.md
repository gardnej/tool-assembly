# Engineering Spec — Tool Assembly & Turret Setup

*The build half of the specification. It turns the [Design Plan](design-plan.md)
and the Confluence requirement register into something the engineering team can
build against: the pivotal architecture decision, the target architecture, the
data model and contracts, the design patterns proven in the prototype, acceptance
criteria, and a traceability matrix.*

> **Status:** draft for review.
> **Authoritative requirements:** the Confluence FR/NFR/TR pages
> ([Tool Assembly](https://autodesk.atlassian.net/wiki/spaces/MFG/pages/1095406188),
> [Turret Setup](https://autodesk.atlassian.net/wiki/spaces/MFG/pages/1144493763)).
> This document does **not** restate all ~150 requirements — it references them by
> id and adds the engineering material that is not on the wiki.

---

## Contents

1. [Scope & the pivotal architecture decision](#1-scope--the-pivotal-architecture-decision)
2. [Target architecture](#2-target-architecture)
3. [Requirements overview](#3-requirements-overview)
4. [Data model & contracts](#4-data-model--contracts)
5. [Design patterns](#5-design-patterns)
6. [Non-functional & operational requirements](#6-non-functional--operational-requirements)
7. [Acceptance criteria & test plan](#7-acceptance-criteria--test-plan)
8. [Traceability matrix](#8-traceability-matrix)
9. [Risks, dependencies & decisions](#9-risks-dependencies--decisions)

---

## 1. Scope & the pivotal architecture decision

There is one decision that shapes everything else, and the requirement register
has effectively already made it. Engineering needs to understand it clearly to
avoid building the wrong thing.

### 1.1 Two candidate data models

The prototype and the prior Fusion experiment explored a spectrum of models (see
[`docs/model-c.md`](model-c.md) and [`docs/attachment-points.md`](attachment-points.md)):

- **Model C (occupancy-only, no schema change).** Draw a block-owns-slots
  hierarchy on top of the existing schema where a *cutting tool owns its block*.
  Each slot row is a **view over one real tool**; the parent block row is
  **derived** by grouping tools' embedded `tool-block` objects by `guid`; and on
  save, **nothing block-shaped is written** — each tool gets a per-tool station
  assignment. It needs no new Fusion structure.
- **Real hierarchical model (schema change).** A genuine assembly hierarchy of
  **component instances**, with **per-interface connection data**, **per-slot
  attachment frames**, **stable slot identity**, and **explicit empty slots**.

### 1.2 What the requirements mandate

The Confluence **technical requirements go beyond Model C**. In particular:

- **TR1–TR2 (Tool Assembly):** store connection-interface data on components,
  support *multiple* workpiece-side interfaces, associate each interface with an
  **attachment frame**, and give each interface a **stable identifier**.
- **TR3:** store assemblies as **hierarchical component instances** (instance ≠
  definition), with stable instance ids and parent-child + participating-interface
  relationships.
- **TR4:** expose each workpiece-side connection independently, **generate slots
  from interfaces**, support **empty slots** as first-class, and give each slot a
  **stable identity** (`TR4.3`, `TR4.5`).

Model C **cannot** satisfy `TR4.3`/`TR4.5` (empty slots, stable slot identity):
it derives slots from occupants, so a slot with no occupant does not exist, and
slot identity is positional. It also cannot carry **per-seat frames**, which
`TR2` requires.

### 1.3 The decision, stated for the team

> **The target is the real hierarchical model.** Model C is a faithful
> **UX/interaction proof on today's data** — copy its interaction design, its
> derivation-and-save *thinking*, and especially its **validation rules** — but
> do **not** ship Model C's occupancy-only storage as the product. The product
> requires the schema and importer changes catalogued in
> [§9](#9-risks-dependencies--decisions) and in
> [`docs/attachment-points.md`](attachment-points.md).

Because the intent is a **feature built into Fusion**, "requirements" legitimately
include asking for those platform changes (STEP importer, `.3DTool` container,
library JSON, public API). They are load-bearing for empty slots, per-seat frames
and a real containment relation.

### 1.4 What to reuse from the prototype regardless

Independent of storage, the prototype has proven design that transfers directly:

- The **interaction design** of the assembly grid, 3D viewer, and picker.
- **Gauge length measured through joint frames** (not summed) — keep this.
- The **three validation rules** from Model C (conflicting blocks, capacity
  overflow, duplicate station) — cheap and truthful.
- The **opaque-id round-trip** and **failed-save-keeps-dialog-open** bridge
  behaviours.

## 2. Target architecture

> **Assumption pending confirmation.** The prototype is React/Vite, but Fusion's
> own Tool Assembly experiment is a **QWebEngine web dialog hosted in a Qt/native
> shell** with a C++ bridge to the tool-library and CAM layers
> ([`docs/model-c.md`](model-c.md)). This spec assumes the production target is
> that in-product **web-dialog + native-bridge** shape. If the team prefers a
> fully native Qt dialog, §2 and the pattern notes in §5 change; flag it in review.

### 2.1 Layers

| Layer | Responsibility | Prototype analogue |
| --- | --- | --- |
| **Dialog UI** | Assembly grid, 3D preview, picker, Turret Setup canvas & station dropdowns | `src/components/*` |
| **Workflow/state** | In-flight assembly and turret-setup state, validation, slot mechanics kept UI-framework-free | `src/hooks/useToolAssemblyWorkflow.ts`, `src/data/assembly.ts` |
| **Domain/maths** | Rigid-transform / joint-frame maths, stack-up, gauge length | `src/data/joints.ts`, `src/data/realLibrary.ts` |
| **Native bridge** | Open the real Tool Library as a picker; return selected component JSON; persist edits transactionally | `ToolAssemblyWebDialog.cpp` (in `client-delivery`) |
| **Library / persistence** | Read/write tool records; assembly + turret-setup entities in the document | Fusion `IronLib` / CAM document |
| **CAM consumers** | Simulation, collision checking, setup sheets | downstream Fusion |

### 2.2 Key architectural constraints

- **Domain maths must be shared and duplicated deliberately** across languages if
  needed (the prototype keeps joint maths in both TypeScript and Python and
  asserts identical numbers against the same real data, so they cannot drift). Any
  production port must carry the same equivalence tests.
- **Preview transforms and simulation transforms must originate from the same
  resolved assembly representation** (Tool Assembly NFR3.2, Turret Setup NFR5.1).
  Do not compute placement twice.
- **Compatibility checking is one reusable engine** consumed by assembly
  creation, validation, suggestions and library filtering (TR5.2, NFR1.6, TR10.6).

## 3. Requirements overview

The full, authoritative lists live on Confluence. This section groups them so the
team can navigate, and marks **MVP vs Future** where the brief narrows scope.

### 3.1 Tool Assembly ([page](https://autodesk.atlassian.net/wiki/spaces/MFG/pages/1095406188))

| Group | Ids | Summary | MVP? |
| --- | --- | --- | --- |
| Connection data authoring | FR1, TR1 | Assign fixed/ranged connection codes to machine- and workpiece-side points; identify which point is being edited | **MVP** (define connection interface types) |
| Import connection data | FR2, TR9 | Import GTC/manufacturer connection data; map to attachment frames; tolerate incomplete | Partial — see §9 |
| Build/edit hierarchy | FR3.1, TR3, TR4, TR11 | Parent/child hierarchy; slots from adaptive items; empty slots; insert intermediate components | **MVP** |
| Add components | FR3.2, FR4, TR10 | Populate from suggestions or library; filter to compatible; machine context | **MVP** (intelligent filtering) |
| Remove components | FR3.3, TR11 | Remove without recreating; impact on children; preserve empty slot | **MVP** |
| Position/stickout/orientation | FR3.4, TR6, TR7 | Edit offsets/gauge/orientation; live preview; nested chains | **MVP** |
| Dimensions | FR3.5, TR7 | Assembly stickout measured & recalculated through the chain | **MVP** |
| Visualise/identify | FR3.6, TR8 | 3D preview; highlight component & connection; identify empty slots | **MVP** |
| Compatibility/validation | FR3.7, TR5, TR15 | compatible / incompatible / unverifiable; non-blocking; overrides | Override = **Future** |
| Edit components / cutting data | FR3.8, TR12 | Edit-in-library; assembly-specific cutting-data override | See cutting-data sub-page |
| Search/sort/filter | FR4, TR10 | Filter by type & connection; prioritise compatible; vendor libraries | **MVP** (granular filters) |
| Downstream consistency | NFR8, TR13, TR14 | Consistent geometry to CAM; setup-sheet completeness; multi-slot docs | **MVP** (assembly in setup sheet) |

### 3.2 Turret Setup ([page](https://autodesk.atlassian.net/wiki/spaces/MFG/pages/1144493763))

| Group | Ids | Summary | MVP? |
| --- | --- | --- | --- |
| Create/manage | FR1, TR1, TR2 | Single browser node; create/edit/name/remove; parent Setup relationship | **MVP** (single node) |
| Configure stations | FR2, TR3, TR4 | Auto-populate from operations; station dropdown; select/create/edit/clear; save | **MVP** |
| Auto reorder | FR3, TR8 | Reorder action button (prototype: randomised shuffle); collisions/clearance/neighbours; report unplaced | Button = **MVP**; full engine = **Future** |
| Flip on seat | FR (flip) | Per-station 180° seat-flip about the radial bore axis (station-independent); disabled for fixed-orientation 3X block | **MVP** |
| Canvas interaction | FR4 | Attachment points; isolate turret; highlight station; live preview | **MVP** |
| Copy/paste | FR5, TR12 | Copy/paste across documents; carry machine + tooling; preserve station map | **MVP** (per decision log) |
| Machine add/inherit | FR6, TR5 | Select/inherit machine; communicate simulation suitability | **MVP** |
| Programming integration | FR7, TR9 | Surface mounted tooling; multi-tool assembly selection; identify station | **MVP** |
| Simulation | FR8, TR10, TR11 | Turret kinematics; collision incl. inactive stations | **MVP** (foundation) |

### 3.3 Scope guardrails for MVP

- Auto-reorder ships as an **action button** with simple behaviour, not the full
  optimising engine. The prototype currently implements it as a **randomised
  (Fisher–Yates) reshuffle** of assignments across stations; the preference/
  collision-driven logic replaces the randomisation later.
- The **flip-on-seat** control ships as **MVP** (per-station 180° half-turn about
  the block's radial mounting-bore axis). The original **3X block** is
  fixed-orientation and the control is disabled for it.
- **Connection overrides** (forcing incompatible connections) are Future.
- **Up/down reordering arrows** are out; explore drag-and-drop in Qt tables.
- The **tool-offset ↔ tool-number translation table** in Machine Definition is
  Future.

## 4. Data model & contracts

The design requires structure the current schema lacks. This section states the
target contracts and points at the prototype's concrete shapes as a reference for
naming and geometry handling.

### 4.1 Component connection interface (TR1, TR2)

Each component carries zero or more **connection interfaces**:

- **direction** — machine-side or workpiece-side (TR1.3).
- **connection codes** — one or more, **fixed or ranged** (TR1.5, TR1.6).
- **attachment-frame reference** — the coordinate system defining the physical
  connection location/orientation on the component (TR2.1).
- **stable id** — so assembly relationships reference a specific interface
  independent of display name (TR1.8).
- May exist **without complete metadata** → contributes an *unverifiable* state
  (TR1.7, NFR1.3).

This is the additive change to the tool component definition. Multiple
workpiece-side interfaces (TR1.4) are what make multi-slot blocks real rather
than derived.

### 4.2 Assembly hierarchy (TR3, TR4)

- **Component instance** references a component **definition**; the same definition
  can appear as multiple independent instances (TR3.2, TR3.8).
- **Relationships** identify parent instance, child instance, and the **participating
  connection interface** (TR3.4, TR3.5).
- **Slots** are generated from an adaptive item's interfaces (TR4.2), each with a
  **stable identity** (TR4.5) and independent **occupancy** (TR4.4), including the
  **empty** state (TR4.3).
- Hierarchy operations must prevent cycles (TR3.7, TR15.2) and preserve unaffected
  branches on edit/remove (TR11.3, NFR2.3).

### 4.3 Placement, transforms & gauge (TR6, TR7)

- Child placement is **computed from participating parent/child attachment frames**
  plus any user offset (TR6.1, NFR3.1) — i.e. **measured through the joint chain**,
  matching the prototype's approach (see [`docs/EXPORT-SPEC.md`](EXPORT-SPEC.md)
  §2.8 for the MCS/CSW contract and `src/data/joints.ts`).
- Instance **offsets and orientation** are stored separately from the base
  definition (TR2.5, TR6.3, TR6.5).
- The full transform chain resolves from the root through every nested instance
  (TR6.2); parent changes recalc descendants (TR6.7).
- Assembly stickout is **derived** and **recalculated** on change (TR7.2, TR7.3),
  accounting for intermediate adapters/extensions (TR7.4).
- **No cumulative transformation error** across repeated edits (NFR3.4).

### 4.4 Turret Setup entities (Turret Setup TR1–TR6)

- A persisted **Turret Setup** entity: stable id + user name, parent-Setup
  relationship, and resolvable **machine + specific turret** context (TR1).
- A **single browser node** referencing the entity, not storing it (TR2).
- **Stations** enumerated from the machine definition, each with **stable
  identity**, ordering (for neighbour calculations), **attachment transform**, and
  mounting metadata; plus an explicit **empty** state and multi-turret
  extensibility (TR3).
- **Station assignments** reference **document tooling** (not copies), support
  assemblies and standalone tools, and can **resolve a cutting tool → assembly →
  station** (TR4). Each assignment also carries an optional **`flipped`** flag —
  the 180° seat-flip state — which travels with the assembly when it is reordered
  and is forced off for fixed-orientation blocks (the 3X block).

### 4.5 Contracts already implemented in the prototype (reference)

The prototype's data contracts (see [`docs/EXPORT-SPEC.md`](EXPORT-SPEC.md)) are a
concrete, working reference for the geometry/frame side:

- **Library JSON** — `LibraryToolRecord`, `NestedBlock`, `HolderSegment`,
  `StoredJointFrames`, joined by `geometryId` (`src/data/realLibrary.ts`).
- **Turret geometry** — seated GLB + `cadAssembly.json` frame descriptor;
  station N = station 1 rotated `(N-1)·stationStepDeg` about the fitted drum axis
  (`src/data/turretSolids.ts`).

These show *how frames and geometry tie together*; the production model adds the
per-interface identity and instance hierarchy the prototype currently derives.

### 4.6 Cutting-data overrides (TR12)

- Store cutting-data overrides at the **cutting-component-instance** level (TR12.1),
  **separate from the component default** (TR12.2), with downstream consumers able
  to resolve the **effective** value (TR12.3) and restricted to cutting components
  (TR12.4). See the Confluence sub-page for the UX.

### 4.7 Associativity (design principle → model)

Per the survey, model component instances so they can reference a definition with
a **pin/version** and support a future **Latest vs Pinned** choice per component,
plus enough version metadata to **preview/compare** incoming changes. MVP may ship
**Pinned** only, but the data model should not preclude the hybrid.

## 5. Design patterns

Patterns proven in the prototype and prior Fusion experiment, with guidance on
which to keep as-is and which are prototype-only.

| Pattern | What it is | Keep for production? |
| --- | --- | --- |
| **Single acceptance rule** | One `slotAccepts()` function gates every insert path (dropdown, insert above/below, replace) so acceptance is identical everywhere (`src/data/assembly.ts`) | **Yes** — mirrors TR5.2/NFR1.6 (one compatibility engine) |
| **Measured, not summed, gauge** | Compose MCS/CSW frames; show em-dash + missing-frame when unmeasurable | **Yes** — TR7, NFR3 |
| **Derivation (Model C)** | Derive the block row from occupants; per-tool save | **Thinking only** — superseded by real hierarchy (§1) |
| **Three validation rules** | Conflicting blocks, capacity overflow, duplicate station | **Yes** — cheap truthfulness |
| **Opaque-id round-trip** | Picker returns against a slot's opaque id; late replies dropped if the row is gone | **Yes** — robust async bridge |
| **Fail-save-keeps-dialog-open** | On persist failure, surface the error and stay on the Assembly step | **Yes** — NFR5.3 atomicity |
| **Session overlay** | In-memory edits/renames/saved-assemblies overlay | **Prototype-only** — real persistence replaces it |
| **Generated-from-source UI** | Ribbon/browser generated from Fusion's own definitions rather than transcribed | **Reference** — prototype fidelity technique |

### 5.1 Anti-patterns to avoid (learned from the experiment)

- **Do not** add a block-shaped record to state and try to persist it (Model A's
  dead end — nothing to write it to).
- **Do not** edit `numberOfTools` from the UI if it isn't persisted (a dead write
  that reads as a bug on reopen).
- **Do not** hide the station-vs-transform discrepancy — surface real
  `stationNumber` where present; say so where absent.
- **Do not** sum nominal gauge fields.

## 6. Non-functional & operational requirements

The Confluence NFR pages are authoritative. Highlights and additions the team
should hold to:

- **Compatibility behaviour** (Tool Assembly NFR1): three states; missing data →
  unverifiable; non-blocking; responsive; one consistent rule set.
- **Structural integrity** (NFR2): valid hierarchy; no cycles; independent slots;
  recoverable incomplete assemblies.
- **Geometry accuracy** (NFR3): consistent placement from frames; preview ↔ CAM
  parity; precision for collision checking; no cumulative error.
- **Performance** (NFR4): interactive edit/selection; responsive filtering over
  large libraries; graceful degradation; avoid loading full geometry for
  metadata-only operations.
- **Error handling** (NFR5): component-level isolation; actionable errors; atomic
  edits; invalid input never overwrites last valid value.
- **Turret integrity** (Turret Setup NFR2): one assignment per station; explicit
  empty stations; stable station identity; atomic changes; machine consistency.
- **Simulation fidelity** (Turret Setup NFR5): setup ↔ simulation parity; correct
  collision attribution; inactive-station tooling participates.

### 6.1 Additions not on the wiki (confirm in review)

- **Accessibility & theming.** Follow Weave defaults (LIGHT_GRAY theme, HIGH
  density, Artifakt Element fonts) and Weave/Supernova component + token usage per
  the design system, including keyboard operability of the grid and picker.
- **Internationalisation.** All user-facing strings localisable; units respect the
  document/tooling environment (aligns with NFR3.5).
- **Undo/redo.** Assembly and station edits should integrate with Fusion's
  undo stack (implied by atomicity NFRs; state explicitly).

## 7. Acceptance criteria & test plan

Gherkin-style acceptance criteria for the primary flows, plus the verification
approach. These are the pieces missing from both the wiki and the prototype docs.

### 7.1 Test levels

| Level | Scope | Basis |
| --- | --- | --- |
| **Unit** | Joint maths, stack-up/gauge, `slotAccepts()`, compatibility engine, validation rules | Prototype `tests/` (Node test runner) + Python parity suite |
| **Integration** | Bridge round-trip (picker → select → bind), transactional save, initial population | Native shell + web dialog |
| **Behavioural / E2E** | The captured walkthroughs (assembly build; turret setup) | `recordings/`, deep links |
| **Simulation parity** | Preview transforms == simulation transforms; collision attribution | CAM simulation |

### 7.2 Sample acceptance criteria

**AC-TA-1 — Build a multi-slot assembly (FR3.1, TR4)**
- *Given* a tool block exposing 3 workpiece-side slots,
- *When* the user opens the assembly, *then* 3 child slots appear, each addressable
  and initially **empty**;
- *When* the user populates slot 2 only, *then* slots 1 and 3 remain empty and
  independently editable (NFR2.3), and slot identity is stable across the edit
  (TR4.5).

**AC-TA-2 — Compatibility is non-blocking (FR3.7, NFR1.3/1.4)**
- *Given* a component with missing connection metadata,
- *When* it is added, *then* the connection shows **unverifiable** (not
  incompatible) and the user can continue building the assembly.

**AC-TA-3 — Gauge measured through the chain (FR3.5, TR7)**
- *Given* an assembly with an extension whose CSW frame is off-axis,
- *When* stickout is displayed, *then* it equals the frame-composed value (not the
  nominal sum);
- *When* a contributing offset changes, *then* stickout **recalculates** (TR7.3);
- *When* a required frame is missing, *then* the readout shows an em dash and names
  the missing frame.

**AC-TA-4 — Remove preserves the slot (FR3.3.4, TR11.4)**
- *When* a component is removed from a defined slot, *then* the slot remains as an
  **empty** slot and unrelated branches are unchanged (TR11.3).

**AC-TS-1 — Assign an assembly to a station (Turret Setup FR2)**
- *Given* an open Turret Setup with a valid turret,
- *When* the user picks an assembly from a station dropdown, *then* the assembly is
  bound to that **physical station** via its block-to-turret connection, and the
  canvas preview updates (FR4.6);
- *And* the station resolves to **exactly one** assignment (NFR2.1).

**AC-TS-2 — Initial population by tool number (FR2.1, FR2.2, TR7)**
- *Given* a parent Setup whose operations reference document tooling with tool
  numbers,
- *When* the Turret Setup is first opened, *then* stations are populated using tool
  number ↔ station heuristics; ambiguous mappings are left **unassigned** rather
  than placed arbitrarily (TR7.4), and population is **deterministic** (NFR3.1).

**AC-TS-3 — Copy/paste requires matching machine (FR5.3, FR5.4, decision log)**
- *Given* a copied Turret Setup,
- *When* pasting into a document **without** the same machine/parent Setup, *then*
  Paste is unavailable;
- *When* pasting into a valid destination, *then* required assemblies + document
  tools are carried over and the **station map is preserved** (FR5.6, NFR7.5).

**AC-TS-4 — Inactive tooling collides (FR8.6, TR11.2)**
- *Given* multiple populated stations,
- *When* simulating, *then* tooling on **non-active** stations participates in
  collision checking where geometry is available.

### 7.3 Validation-rule tests (from Model C, inherit)

- Conflicting blocks: tools referencing >1 block → error.
- Capacity overflow: assigned > `numberOfTools` → error.
- Duplicate station: two tools on the same station → error.

*(On today's real data all three fire — a useful regression fixture.)*

## 8. Traceability matrix

A living map from requirement → prototype behaviour → test. Seeded below; extend
as build proceeds. (Full FR/NFR/TR ids are on Confluence.)

| Requirement | Design Plan §| Prototype behaviour | Test / AC |
| --- | --- | --- | --- |
| TA FR3.1 (hierarchy) | [5.3](design-plan.md#53-building-the-hierarchy) | Assembly grid, insert above/below | AC-TA-1 |
| TA FR3.1.3 / TR4.3 (empty slots) | 5.3 | *Gap in prototype (Model C)* — target feature | AC-TA-1, AC-TA-4 |
| TA FR3.2 / TR10 (add + filter) | 5.4 | Picker scoped to fit; filters | integration |
| TA FR3.5 / TR7 (gauge) | 5.5 | Measured via `joints.ts`; em-dash | AC-TA-3, unit |
| TA FR3.7 / NFR1 (compatibility) | 5.6 | Three-state validation, non-blocking | AC-TA-2 |
| TA TR5.2 (one engine) | 7.5 | `slotAccepts()` single rule | unit |
| TS FR2 (station assign) | [6.4](design-plan.md#64-assigning-tooling-to-stations) | Station dropdowns; live preview | AC-TS-1 |
| TS FR2.1/2.2 (initial population) | 6.3 | Tool-number ordering | AC-TS-2 |
| TS FR3 (auto reorder) | 6.5 | Reorder action button — randomised shuffle (MVP) | integration (MVP) |
| TS (flip on seat) | 6.4 | Per-station 180° seat-flip; disabled for 3X block | integration (MVP) |
| TS FR5 / TR12 (copy/paste) | 6.7 | — (target feature) | AC-TS-3 |
| TS FR8.6 / TR11.2 (inactive collisions) | 6.8 | — (simulation) | AC-TS-4 |

## 9. Risks, dependencies & decisions

### 9.1 Platform changes required by the target model

From [`docs/attachment-points.md`](attachment-points.md), four load-bearing layers
must change to support per-seat frames and a real containment relation:

1. **STEP authoring convention + importer.** The importer today recognises only
   `MCS`/`CSW` labels and returns on first match; per-seat labelling (e.g.
   `CSW_1..N`) needs an agreed convention, a relaxed filter, and keyed getters.
2. **`.3DTool` container.** Two hardcoded `Matrix4x4` members and a scalar
   `mcs`/`csw` JSON header must become **collections** — a file-format version bump
   with migration.
3. **Library JSON.** `numberOfTools` must actually be **authored** (never >1 in
   real data today), and a **seat index** / occupant relation must exist.
4. **Public API.** `ToolJointType`/`setJointOrigin` need an **index** and to stop
   being a stub.

For a **read-mostly, occupancy-only** UX these are unnecessary (that is Model C);
for the **required** empty-slot, per-seat-frame model they are prerequisites.

### 9.2 Data realities to design around

- Real records report `stationNumber: 0` and carry `transformOverride`, so station
  is not a reliable per-occupant discriminator today (surface, don't hide).
- Only one real block solid exists with a mesh; most blocks fall back to a message.
- GTC import can be **partial** — unresolved attachment-frame mappings must be
  identified, not silently reassigned (NFR6.4, TR9.6).

### 9.3 Open decisions (owner needed)

| # | Decision | Notes |
| --- | --- | --- |
| D1 | **Production platform** — QWebEngine web-dialog + bridge vs native Qt | Assumed web-dialog (§2). Confirm. |
| D2 | **Slot labelling** — "Slot N" vs station-derived | Real data has no per-seat address. |
| D3 | **Reordering affordance** — drag-and-drop in Qt tables | Arrows out for Phase 1. |
| D4 | **Associativity** — Pinned-only MVP vs hybrid | Model must not preclude hybrid. |
| D5 | **Auto-reorder MVP behaviour** — how "simple" is the button | Prototype = randomised shuffle; full engine is Future. |
| D6 | **Schema-change appetite** — timing of the four platform changes (§9.1) | Gates empty slots / per-seat frames. |

### 9.4 Recorded decisions (from the brief's decision log)

- Up/down arrows **left out of Phase 1**; explore drag-and-drop tables.
- Copy/paste requires the **destination document to already have the same machine**;
  assemblies + their document tools are pasted too.
- The Automatic mode is an **action button**, not an always-on mode.

---

## Sources

Same register as the [Design Plan §9](design-plan.md#9-sources): the Confluence
FR/NFR/TR pages (authoritative), the two Figma files, and the repo analyses
([`README.md`](../README.md), [`prototype-guide.md`](prototype-guide.md),
[`attachment-points.md`](attachment-points.md), [`model-c.md`](model-c.md),
[`EXPORT-SPEC.md`](EXPORT-SPEC.md)) plus `recordings/turret-setup/`.
