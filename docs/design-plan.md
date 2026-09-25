# Design Plan — Tool Assembly & Turret Setup

*The design half of the specification: the problem, who it is for, the workflows,
and the interactions and behaviours the engineering team needs to understand
before building. The companion document, [Engineering Spec](engineering-spec.md),
carries requirements, data model, patterns, acceptance criteria and traceability.*

> **Status:** draft for review.
> **Audience:** the Fusion engineering team building Tool Assembly and Turret Setup.
> **Authoritative requirement register:** the Confluence pages linked in
> [§8](#8-sources). This document explains *what and why*; the requirement pages
> and the Engineering Spec carry *how*.

---

## Contents

1. [Problem & context](#1-problem--context)
2. [Goals, non-goals & phasing](#2-goals-non-goals--phasing)
3. [Who it is for](#3-who-it-is-for)
4. [Domain primer](#4-domain-primer)
5. [Tool Assembly workflow](#5-tool-assembly-workflow)
6. [Turret Setup workflow](#6-turret-setup-workflow)
7. [Interaction & behaviour catalogue](#7-interaction--behaviour-catalogue)
8. [Open design questions](#8-open-design-questions)
9. [Sources](#9-sources)

---

## 1. Problem & context

Two related problems, delivered as one initiative because the second builds on the
first.

**Tool Assembly.** Currently users can only create simple assemblies by attaching
a tool block to a tool, which is not scalable to more complex turnmill and milling
assemblies. Users need a way to define complex assemblies that have multiple tools
and adaptive items (extensions, collets, etc.) in a tree hierarchy. This allows
users to build up their tool assemblies so they can simulate their turnmill machine
programs accurately, giving them greater confidence in their machining process.

**Turret Setup.** Currently, Fusion users cannot accurately represent turning
machine turret configurations with complex tool assembly geometry. As a result,
users have limited confidence that simulated turning operations reflect the real
machine, increasing the risk of collisions between the turret, tooling and the
workpiece.

**Why it matters.** Realistic turret and assembly geometry is the foundation for
accurate TurnMill simulation and collision checking. Giving users confidence that
what they simulate matches the real machine is both a safety and a competitiveness
concern for Fusion's turning workflow. This initiative is delivered in phases;
Phase 1 establishes a scalable workflow for assembly creation and turret setup
management and lays the groundwork for more advanced configuration experiences,
informing FY28 planning.

## 2. Goals, non-goals & phasing

### Goals

- Let users build **complex, hierarchical tool assemblies** (multiple tools and
  adaptive items) rather than a single tool-plus-block.
- Let users **configure a turret** by assigning assemblies to physical stations,
  and preview the result in the canvas.
- Make assembly and station geometry **flow through to simulation and collision
  checking** so what the user sees matches what the machine does.
- Establish **connection/coupling data** on components so Fusion can reason about
  what attaches to what.

### In scope for MVP (Phase 1)

Taken from the project brief's MVP column:

- Default turret setup order based on the **tool number** setting, which users can
  clear if they want.
- **Defining connection interface types** for each component in the Tool Library.
- **Intelligent tool filtering** — the library understands the machine in the
  setup and offers a filter showing only tools usable with that machine.
- Turret setup appears as a **single browser node**.
- A **flip option** in the Turret Setup dialog to flip the tool block to point
  towards main / sub spindle.
- **Assembly components added to Setup Sheet** output.

### Explicit non-goals / future scope

- **Auto-reorder logic is not in MVP.** The Automatic control is an *action
  button* that reorders stations (initially without full collision optimisation),
  not an always-on mode. Preference-driven reordering criteria are future scope.
- **Overriding incompatible connections** (forcing a connection Fusion flags as
  incompatible) is future scope.
- A **Machine Definition table translating tool-offset number ↔ tool number** by
  controller is future scope.
- **Up/down reordering arrows** are intentionally left out of Phase 1 to avoid
  confusing behaviour; drag-and-drop tables in the Qt dialogs are to be explored
  instead (decision log).

> **Note for engineering:** MVP explicitly *narrows* some behaviours the full
> requirement register describes (e.g. the auto-reorder engine, connection
> overrides). Where the Engineering Spec references those requirements, it flags
> whether they are MVP or future so the team builds the right thing first.

## 3. Who it is for

This is not segmented by job role — the same functionality is **equally useful for
Turning, Mill-Turn and Milling customers**. The design should therefore hold up
across all three contexts rather than optimising for turning alone:

| Segment | What they get from it |
| --- | --- |
| **Turning** | Accurate turret + tool-assembly geometry for turning simulation and collision avoidance. |
| **Mill-Turn** | The full turret configuration with complex multi-tool assemblies, the primary driver for TurnMill simulation fidelity. |
| **Milling** | Hierarchical assemblies (holder + extensions + collets + tool) for accurate milling assembly representation. |

Design implication: the assembly hierarchy and connection model must generalise
beyond turning-specific concepts (e.g. a turret) so a milling assembly is a
first-class citizen without a turret involved.

### What users told us (Fusion Friday feedback)

Signals that shape the design (full summary in the brief):

- Tool assembly was seen as a strong start, but users want a **manual override**
  for edge cases and non-standard setups.
- Auto-arranging turrets should prioritise **collisions, tool length and
  orientation**, with a preference option for special cases.
- Users favoured **one turret browser node** rather than every station in the
  browser.
- Users favoured the Turret Setup defaulting to stations populated **intelligently
  by tool number**, not a blank slate.
- Users want **more granular Tool Library filters** — by connection type, tool
  type, and component type (collets, holders, etc.).
- Users expect assembly components to appear in **setup sheets**.

### Associativity direction (survey)

For how assemblies consume component updates, the strongest direction is
**"associative, but user-controlled."** A **Pinned** model is the safer
foundation for an initial release (75% preference), paired with clear **version
visibility** and the ability to **preview/compare incoming changes** before
accepting them. Longer term, users want **Pinned and Latest to coexist** at the
component level. This mainly affects the Engineering Spec's data model (component
instances referencing definitions with a pin/version), but it is a design
principle worth stating up front: *control, transparency, granularity and
recoverability.*

## 4. Domain primer

Shared vocabulary, so the rest of the document (and the spec) reads consistently.
Terminology is deliberately aligned to Fusion's own usage; see
[`docs/model-c.md` §5](model-c.md) for the evidence behind these choices.

| Term | Meaning |
| --- | --- |
| **Tool block / adaptive item** | The part that adapts a cutting tool to a machine interface. Has a *machine-side* connection and one or more *workpiece-side* connections. |
| **Cutting tool** | The tool that removes material (turning insert, drill, endmill, tap, …). |
| **Adaptive components** | Extensions and collets — non-cutting parts that make a tool fit a position (an extension packs a position out; a collet grips a tool inside it). |
| **Assembly** | A hierarchy of components: a block/holder with tools and adaptive items nested beneath it. |
| **Slot / connection point** | A workpiece-side connection on an adaptive item where a child component can mount. A multi-slot block exposes several. |
| **Connection interface / coupling data** | Data on a component's connection point (machine- or workpiece-side) describing what it can connect to, via connection codes (fixed or ranged). Authored during tool import or in the library. |
| **Joint frames (MCS / CSW)** | Coordinate frames on a solid: **MCS** = machine-side mount, **CSW** = cutting/workpiece-side. Components join at these frames; gauge length is *measured* through the chain, not summed. |
| **Gauge length / stickout** | The measured distance from a reference (gauge) face to the tool tip, composed through the joint-frame chain. |
| **Turret** | The indexing component of a turning machine that holds multiple tools and rotates about an axis to bring one to the cut. Defined in the machine definition. |
| **Station** | A physical mounting position on the turret, each with its own attachment frame. |
| **Half-index** | A position *between* turret stations (from the machine's turret definition). |
| **Tool number** | The user/controller-facing tool identifier used to seed initial station order. |

A key structural fact carries through the whole design: in Fusion's current
library schema, a **cutting tool owns a copy of its block** rather than a block
owning its tools, and there is no stored per-seat identity, per-seat frame, or
occupant collection. The design calls for a real hierarchy; the Engineering Spec
sets out what the data model must gain to support it. See
[`docs/attachment-points.md`](attachment-points.md) for the detailed analysis.

## 5. Tool Assembly workflow

The user builds an assembly as a **tree hierarchy** of parent and child
components. The prototype (see [`docs/prototype-guide.md`](prototype-guide.md))
demonstrates the shape of the interaction.

### 5.1 Opening the dialogue

- **Manage → Solid Holder → Tool Assembly** — mirrors where Fusion keeps the real
  command, alongside Tool Block and Turning Tool Holder.
- **File → New Tool → Tool assembly** — opens the same dialogue.

### 5.2 The four steps

1. **General** — high-level fields (description, vendor, product id, product link),
   pre-filled from the chosen block or first cutting tool.
2. **Assembly** — the grid where the block and its positions live; where users
   spend most of their time.
3. **Setup** — block-level configuration (orientation, machine-side connection
   type, number of tools, adaptive item size, station number, half index).
4. **Post-processor** — post-related fields.

### 5.3 Building the hierarchy

- The **root** is the tool block / holder — the machine-side root and parent of
  every position beneath it. It is chosen by navigating the Tool Library.
- A block that exposes multiple workpiece-side slots shows the corresponding
  **child slots** beneath it. Slots may be left **empty** and still be represented,
  so the assembly reflects what is physically mounted.
- Each position is an **ordered stack** — a component may host another according to
  connection rules (an extension can hold a tool, or an extension + collet + tool,
  and extensions can stack). Once a cutting tool goes in, the stack ends.
- Users can **insert an intermediate component** between an existing parent and
  child (e.g. add an extension between a block and a tool).

### 5.4 Populating a slot

- From a **list of suggested compatible components** for that slot's connection
  interface, or
- From the **Tool Library** (document, Hub and vendor sources), with the library
  **filtered to compatible components** for the selected connection.
- Missing/incomplete connection data must **not block** assembly — unresolved
  connections are surfaced, not prevented.

### 5.5 Position, dimensions and preview

- Users can edit a component's **offset (X/Y/Z)**, **gauge length / stickout**, and,
  where a connection permits it, **orientation** — reflected live in the 3D
  preview.
- **Assembly stickout** is shown from the relevant gauge face and recalculates as
  contributing components change, accounting for nested adapters/extensions.
- Gauge length is **measured through the joint-frame chain**, not summed from
  nominal lengths, so rotated or off-axis frames are handled correctly. Where a
  chain is unmeasurable, the readout says which frame is missing rather than
  showing a wrong number.

### 5.6 Compatibility & validation

- Every connection is shown as **compatible, incompatible or unverifiable**, with
  an explanation available.
- **Missing data is unverifiable, not incompatible.** Warnings never block; the
  user can proceed and (future scope) override.
- Editing cutting data **as an assembly property** lets a user override speeds and
  feeds for a cutting component within a specific assembly without changing the
  component's default cutting data (see the dedicated Confluence sub-page).

## 6. Turret Setup workflow

Turret Setup is where assemblies meet the machine. It builds on Tool Assembly:
the assemblies created above become the tooling assigned to turret stations.

### 6.1 The core interaction

The intended rule is direct and simple: **the user selects tool assemblies and,
using the Turret Setup UI, directly selects a turret station to add the assembly
to.**

How the placement actually resolves:

- As part of the **tool import workflow**, the user determines **connection
  information on the 3D model** — this defines how one tool component attaches to
  another.
- The **tool block** also carries connection data that determines **where it
  mounts to a turret** and **how a tool mounts to it**.

So an assembly "knows" how it seats: the block-to-turret connection defines the
mount to the station, and the component-to-component connections define the stack
above it. Assigning an assembly to a station is therefore a matter of binding it
to that station's attachment point; the geometry follows from the connection data.

### 6.2 Creating and managing a Turret Setup

- A Turret Setup appears as a **single browser node** beneath the relevant
  Manufacture Setup (not one node per station).
- Created from the browser (right-click a Setup) or from **Manufacture → Turning →
  Manage**; when created from the toolbar, the user associates it with a parent
  Setup.
- It can be **named, edited, removed, copied and pasted**.

### 6.3 Initial population & ordering

- On first open, Fusion **populates stations with document tooling already used by
  operations** in the parent Setup.
- It makes a **sensible initial station order** using available info such as **tool
  numbers** and available station numbers. Users can clear this if they prefer to
  start fresh.
- The dialog shows **read-only turret information** (mounting interface,
  orientation relative to the spindle, etc.) from the machine definition.

### 6.4 Assigning tooling to stations

- Each station has a **dropdown** offering suitable document and Hub assemblies,
  including tooling currently on another station (to reposition it), plus **Select
  from Tool Library**, **Create an assembly**, **Edit**, and **Clear**.
- Hovering an assembly in the menu previews **the tooling it contains**.
- **Clear all** (with confirmation) empties every station.
- A **flip option** — a per-station button at the end of each station row — flips
  the mounted assembly **180° on its seat** so it points towards the main or sub
  spindle. It is a half-turn about the block's radial mounting-bore axis, so the
  block stays flush and the operation is station-independent (works identically on
  every station); only the off-axis tooling swings across.
  - **Fixed-orientation exception:** the original **3X tool block** cannot be
    flipped — its drills/taps point along the spindle axis, so a seat-flip would
    just send them rearward rather than swap the tool direction. The button is
    **disabled** when that block is assigned, and any stale flip is cleared if a
    station is switched to it.

### 6.5 Automatic reordering

- An **Automatic reorder action button** (lightning-bolt icon, in the toolbar
  cluster beneath the station list) attempts a sensible arrangement of mounted
  tooling across stations.
- The full engine (considering static collisions, tooling clearance/length, and
  neighbouring-station interference) is the target; **MVP delivers the button with
  simpler behaviour** and does not silently discard tooling — anything it cannot
  place is reported.
- **Current prototype behaviour:** the button performs a **randomised** reshuffle
  (Fisher–Yates permutation) of the assigned assemblies across the fixed station
  numbers — enough to demo the automation affordance. Each assembly carries its
  flip state with it, and the button is disabled with fewer than two assignments.
  The preference/collision-driven logic replaces this randomisation later.

### 6.6 Canvas interaction

- The turret is **isolated by default** (other machine components hidden), with the
  user able to toggle machine-component visibility via the browser.
- **Station attachment points** are visible; selecting a station **highlights its
  attachment point**; mounted tooling is previewed at its station and the preview
  updates as assignments change.

### 6.7 Copy / paste

- A Turret Setup can be **copied and pasted into another document**, but only where
  the destination already has a Manufacture Setup that can be the parent **and the
  same machine selected**.
- Paste **carries over the required assemblies and the document tools** they use,
  and **preserves which tooling was assigned to which physical station**.

### 6.8 Programming & simulation

- During programming, the tool selector **surfaces tooling already mounted on the
  turret**, communicates **which station** it is in, and lets the user pick the
  specific **cutting tool within a multi-tool assembly**.
- In simulation, mounted tooling **moves with the turret's kinematics**, and
  **all mounted stations** (not just the active one) participate in collision
  checking.

## 7. Interaction & behaviour catalogue

Concrete behaviours the prototype demonstrates, for the team to match. Full
detail in [`docs/prototype-guide.md`](prototype-guide.md).

### 7.1 Assembly grid

- **Parent block row with a disclosure triangle**; indented child rows.
- **Empty slot** shows a "Select component" affordance; **occupied vs empty** slots
  are visually distinguished.
- **Row context menu**: Browse library…, Insert component above/below…, Remove,
  (and, where meaningful, Move). Availability depends on whether the row is filled
  and can host another.
- **Per-slot gauge readout** shows a value or an em dash + the missing frame.

### 7.2 3D viewer

- The block is shown as a solid; each occupant appears as it is chosen; unchosen
  parts read as **ghosts** so free space is visible.
- **Row ↔ solid selection is bidirectional**: selecting a row highlights the part;
  clicking a part selects its row.
- A **view cube** rotates in sync with the camera (Z up); face labels are relative
  to the block.
- Where a small component can't be addressed on the main mesh, a **corner inset
  preview** shows just that component.

### 7.3 Tool Library dialogue (browse + picker)

- **Browse mode** (read-only) from the ribbon; **Picker mode** from the assembly
  or a station, with a **Select / Cancel** footer.
- The picker is **scoped to what fits** the current connection / top of stack.
- **Filters**: type, vendor, component type, and — the MVP addition — **connection
  compatibility and machine context**.
- Assemblies show as **expandable rows** listing their components; a cutting tool
  is shown in a **hierarchy under its assembly**.

### 7.4 Turret canvas

- **Turret ring** with visible station attachment points; isolate-by-default.
- **Station dropdowns** for assignment; **highlight on selection**; **live preview
  update** on assign/move/clear. (See `recordings/turret-setup/` for a captured
  walkthrough.)

### 7.5 Cross-cutting behaviours

- **Non-blocking validation** everywhere: compatible / incompatible / unverifiable,
  with missing data → unverifiable.
- **Session-scoped edits** in the prototype (rename/delete library, edit a record,
  saved assemblies) reset on reload — a prototype convenience, not a requirement.
- **Deep links** (`?assembly=1`, `?toolLibrary=1`, `?turretSetup=1`) open dialogues
  directly for demos and review.

## 8. Open design questions

Curated from the analyses and the decision log; each needs a design/product call
and is tracked in the Engineering Spec's risk/decision register.

1. **Slot labelling vs station.** In today's data every real record reports
   `stationNumber: 0`, so "Slot N" ordinals have no counterpart in the file.
   Decision needed on how slots are labelled and whether/how station numbers are
   surfaced. (See [`docs/attachment-points.md`](attachment-points.md).)
2. **Reordering affordance.** Up/down arrows are out for Phase 1; drag-and-drop in
   Qt tables is to be explored. Confirm the Phase 1 interaction for changing order.
3. **Associativity model.** Pinned vs Latest vs hybrid, plus version visibility and
   change-preview UX. Pinned is the recommended MVP foundation.
4. **Connection override UX.** Overriding an incompatible connection is future
   scope — confirm how (and whether) the MVP hints at it.
5. **Empty-slot semantics across contexts.** How empty slots read for milling
   assemblies with no turret, versus turret stations left deliberately empty.
6. **Tool number ↔ station mapping.** Initial ordering uses tool number, but the
   mapping is not always 1:1; confirm the expected behaviour for ambiguous cases.

## 9. Sources

**Confluence (authoritative requirement register)**

- Project brief — [Turret and Tool Assembly Configurations – XD](https://autodesk.atlassian.net/wiki/spaces/MFG/pages/989103076)
- [Tool Assembly requirements](https://autodesk.atlassian.net/wiki/spaces/MFG/pages/1095406188)
- [Turret Setup requirements](https://autodesk.atlassian.net/wiki/spaces/MFG/pages/1144493763)
- [Editing cutting data as an assembly property – XD](https://autodesk.atlassian.net/wiki/spaces/MFG/pages/1232366616)
- [Machine Builder Workflows](https://autodesk.atlassian.net/wiki/spaces/EC/pages/316419644)

**Figma**

- [Turret Assembly](https://www.figma.com/design/INV3NY9v8nVoIUxSdjLl6b/Turret-Assembly?node-id=563-68445)
- [Turning Tool Holder](https://www.figma.com/design/6umxPtr1MHVMqbXl6fMGXn/Turning-Tool-Holder?node-id=1887-36348)

**This repository**

- [`README.md`](../README.md) — prototype provenance, ribbon/browser/snapshot, structure
- [`docs/prototype-guide.md`](prototype-guide.md) — interactions & behaviours
- [`docs/attachment-points.md`](attachment-points.md) — data-model reality and the gaps to close
- [`docs/model-c.md`](model-c.md) — derivation/save architecture, validation rules, terminology
- [`docs/EXPORT-SPEC.md`](EXPORT-SPEC.md) — data & geometry contracts
- `recordings/turret-setup/` — captured Turret Setup walkthrough
