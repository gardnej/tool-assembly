# Tool Assembly Prototype — User Guide

A single-page reference for the interactions and behaviours implemented in the
prototype. Written for a mixed audience: flows and rationale up front, code and
data-model notes in the [Appendix](#appendix--code-and-data-notes).

Prototype URL: <https://gardnej.github.io/tool-assembly/>

State is per-browser and lives in memory only. Reloading the page resets
everything. Nothing done in the prototype writes back to Fusion or to the
snapshot data on disk.

- [Opening the dialogue](#opening-the-dialogue)
- [Overall workflow](#overall-workflow)
- [The tool block row](#the-tool-block-row)
- [Positions and stacks](#positions-and-stacks)
- [Row context menu](#row-context-menu)
- [The 3D viewer](#the-3d-viewer)
- [The Tool Library dialogue](#the-tool-library-dialogue)
- [Session edits](#session-edits)
- [Saved assemblies](#saved-assemblies)
- [3X Axial validation skip](#3x-axial-validation-skip)
- [Deep links](#deep-links)
- [Appendix — code and data notes](#appendix--code-and-data-notes)

## Opening the dialogue

Two entry points, both under Manufacture:

- **Manage → Solid Holder → Tool Assembly** — mirrors where Fusion keeps the
  real command.
- **File → New Tool** and pick *Tool assembly* — opens the same dialogue.

The Tool Library dialogue opens from **Manage → Tool Library** as a standalone
browser, and from inside the assembly dialogue as a **picker** (see
[Tool Library dialogue](#the-tool-library-dialogue)).

## Overall workflow

Four steps down the left rail:

1. **General** — high-level fields (description, vendor, product id, product
   link). Filled in for you when you pick a block or a first cutting tool, so
   most users will edit this after the assembly is built.
2. **Assembly** — the grid where the block and its positions live. This is the
   step users spend most of their time on.
3. **Setup** — the block-level configuration (orientation, machine-side
   connection type, number of tools, adaptive item size, station number, half
   index).
4. **Post-processor** — read-only for now.

The footer's primary button changes to match the step:

- On Configure, it says **OK** and runs validation on the way to Review.
- On Validate, it says **OK** and re-runs validation, moving to Review on
  pass.
- On Review, it says **Save Assembly** (see [Saved assemblies](#saved-assemblies)).

## The tool block row

The first row of the assembly grid is the tool block. It is the *machine-side
root* of the assembly and the parent of every position beneath it.

- Its dropdown offers a single action, **Select from Tool Library…**, rather
  than an inline list of every block. The block's own library then scopes the
  candidates offered to the positions below it, so there is no separate
  library selector on the dialogue.
- Choosing a block pre-fills the general-info fields with the block's vendor
  and product id.
- The block row is not a position: it has no station and no gauge length. Only
  its occupants do.

### Why the block is derived, not stored

Fusion's real schema has no record that says a block *holds* a set of tools;
each tool holds its own copy of the block instead. The parent block row is
therefore derived by grouping the occupants' nested `tool-block` records by
their `guid`, so the grid can show one block above its tools even though the
data model has no such object. See
[Appendix — Data model](#data-model).

## Positions and stacks

Each position under the block is an *ordered stack* rather than a fixed
extension/collet/tool triple. What may follow what is a rule about the parts:

| Top of stack | Accepts next                    |
| ------------ | ------------------------------- |
| *(empty)*    | extension, cutting tool         |
| extension    | extension, collet, cutting tool |
| collet       | cutting tool                    |
| cutting tool | *(end of stack)*                |

Consequences:

- A position can hold a cutting tool on its own, an extension with a tool, or
  an extension + collet + tool. Extensions can also stack on extensions.
- Once a cutting tool goes into a position, the stack ends. The next row you
  add belongs to the next position.
- The picker (see [The Tool Library dialogue](#the-tool-library-dialogue)) is
  scoped by the top of the stack it opens over, so it never offers something
  that would not fit.

## Row context menu

Right-click any row for its actions. Availability depends on whether the row
is empty and whether it points at a component that can host another.

| Action                    | When it appears                                       |
| ------------------------- | ----------------------------------------------------- |
| Browse library…           | Always; opens the picker to replace this row          |
| Insert component above…   | On a filled row that can host another above it        |
| Insert component below…   | On a filled row that can host another below it        |
| Move up / Move down       | On a filled row that has a neighbour to swap with     |
| Remove                    | On any filled row                                     |

Moving a row up or down **swaps the occupants and leaves the stations where
they are**, so a tool inherits the station of the position it lands on — the
one thing about a position that Fusion can actually store.

## The 3D viewer

The right-hand panel shows the block as a solid, with each occupant drawn as
it is chosen.

- The prototype block ships with a mesh; every other block falls back to a
  message saying so.
- **Selecting a row** highlights the corresponding part of the solid.
- **Clicking a part** in the solid selects its row in the grid.
- If the selected component cannot be addressed on the main block mesh (for
  example a small extension inside a position), the viewer shows a small
  **inset preview** in the corner with just that component.
- The **view cube** in the top-right rotates in sync with the camera, with the
  Z axis pointing up. Face labels are Top / Bottom / Front / Back / Left /
  Right relative to the block, not to the world.
- Only positions with something in them are drawn. Empty positions read as
  free seats rather than as a stack of floating ghost parts.

### Why picking is by material

The prototype block is a single glTF export of the whole assembly in one
coordinate space. `<model-viewer>` can address a mesh's *materials* but not
its *nodes*, so `scripts/prepare-preview-model.py` puts each body on its own
material before conversion, and picking is hit-tested to a material and
mapped back to the position and level it stands for.

## The Tool Library dialogue

Two modes, same dialogue:

- **Browse mode** — opened from the ribbon. Read-only footer, no picking.
- **Picker mode** — opened from the assembly dialogue when a row asks for a
  library selection. Footer swaps to **Select / Cancel**. Clicking a row (or
  double-clicking) returns that tool to the row it was launched from.

### Left rail

Fusion's User Libraries tree:

- **Documents** — hosts saved assemblies (see below).
- **Cloud** — empty in the prototype, kept for parity with Fusion.
- **Local** — the exported Fusion libraries. Vendor libraries live in folders
  beneath it.

Right-click a library in the tree for:

- **Rename / Reset name** — session-only edits (see [Session edits](#session-edits)).
- **Delete** — removes the library from the tree for this session. Reload to
  bring it back.

### Right pane — tools table

Columns: Name, Type, Overall length, Station, Joint frames.

- **Search** filters the visible rows by name.
- **Filters** panel filters by type, by vendor and by whether an item is a
  tool block.
- Rows that were edited this session are tagged **EDITED**.

### Info tabs

To the right of the tools table:

- **Filters** — the filter controls described above.
- **Info** — properties for the selected tool, plus an inline 3D preview
  (silhouette for records with a segments profile, GLB for the ER16 extension
  and collet, prototype block for the axial block).

### Picker-mode nuances

- **Block picker** only offers tool blocks.
- **Tool picker** offers whatever fits on top of the current stack, using the
  rules in [Positions and stacks](#positions-and-stacks).
- Saved assemblies do not appear in the picker (they are not a plain tool the
  picker can insert).

## Session edits

Everything in this section is scoped to the current browser tab and resets on
reload. Nothing writes back to the snapshot on disk.

- **Rename a library** — right-click in the tree, choose Rename. The
  breadcrumb updates alongside. Reset name reverts it.
- **Delete a library** — right-click, choose Delete. It disappears from the
  tree and from every accessor for this session.
- **Edit a tool record** — double-click a tool, or right-click a row in the
  assembly grid and pick **Edit**. Opens the tabbed record editor. Saves are
  applied through an overlay so a record edited in the library shows up
  updated in an assembly that already uses it.
- **Assembly workflow state** — resets on reload; there is no session
  persistence of an in-progress assembly.

## Saved assemblies

The Review step is followed by **Save Assembly**, which persists the current
assembly to two libraries at once:

- **User Libraries → Documents → Saved Assemblies** (created on first save).
- **3X Axial 1**.

One record is stored per save, holding the whole chain — the block, every
position's stack, the config and the general info. Editing a saved assembly
reopens the workflow with the same state.

### The accordion

In the Tool Library dialogue, saved assemblies appear as expandable rows above
the ordinary tools. The expand chevron toggles a list of the assembly's
components (block, then each occupant of each position, in order).

### Editing a saved assembly

Right-click a saved-assembly row and choose **Edit assembly**, or double-click
the row. The library dialogue closes, the assembly dialogue reopens with the
whole chain loaded, and the Save Assembly button will *replace* the existing
record rather than mint a new one. Right-click → **Delete** removes it.

### What the two copies mean

The two library targets share a base id with per-library suffixes (`-docs`
and `-axial1`). Editing follows the base id, so a resave replaces both copies
in place rather than duplicating them.

## 3X Axial validation skip

Assemblies built entirely from the **3X Axial** and **3X Axial 1** libraries
skip joint-frame validation. Those exports don't carry MCS/CSW joint frames
yet, but Fusion itself is fine with them because they ship their own
`assemblyGaugeLength`. Without the skip, the block would never pass the
frame check even though the data is legitimate.

The check triggers when *every* occupant (block + stacks) belongs to one of
those two libraries. Any component from a different library falls back to the
usual validation.

## Deep links

Query parameters open the dialogues directly, bypassing the ribbon:

- **`?assembly=1`** — opens the Tool Assembly dialogue immediately.
- **`?toolLibrary=1`** — opens the Tool Library dialogue immediately.

Useful for pasting straight into a task or a Slack thread.

## Appendix — code and data notes

### Repository layout

| Path                                   | Role                                                       |
| -------------------------------------- | ---------------------------------------------------------- |
| `src/data/realLibrarySnapshot.json`    | Generated snapshot; carries Fusion's own schema           |
| `src/data/realLibrary.ts`              | Typed access to the snapshot, joint frames, stack-up      |
| `src/data/assembly.ts`                 | Slot mechanics and validation, kept free of React         |
| `src/data/libraryEdits.ts`             | Session overlay for edits, renames, saved assemblies      |
| `src/hooks/useToolAssemblyWorkflow.ts` | Dialogue state (local React state only)                   |
| `src/components/AssemblyViewer.tsx`    | 3D block, view cube, inset preview                         |
| `src/components/ToolLibraryDialog.tsx` | Browse + picker modes, saved-assembly accordion            |
| `src/components/ToolHolderDialog.tsx`  | The assembly dialogue itself                               |
| `.github/workflows/deploy.yml`         | Builds and publishes to GitHub Pages                       |

### Data model

Two things follow Fusion rather than convenience:

- **A cutting tool owns its block.** The block is nested inside the tool, so
  the parent block row is derived by grouping the tools that carry it rather
  than stored anywhere. Nothing block-shaped is written on save — each tool
  carries its own station.
- **Components are joined at ISO-13399 joint frames.** Machine-side `MCS` and
  cutting-side `CSW`. Gauge length is measured through that chain rather than
  summed from nominal lengths, so it accounts for frames that are rotated or
  off-axis. Adaptive items with segments carry Fusion's own
  `assemblyGaugeLength`; the prototype prefers that when it is present.

### Slot-acceptance rules

Codified in `slotAccepts()` in `src/data/assembly.ts`. Every insert path in
the UI — dropdown, insert above, insert below, replace — goes through the
same rule function, so the acceptance behaves the same everywhere.

### Saved-assembly record

Defined as `SavedAssembly` in `src/types/index.ts`. Persists:

- `blockToolId` — the chosen block's library id.
- `slots` — for each position: the ordered `stack` of library ids, plus the
  station and half-index.
- `config` and `generalInfo` — the same shapes as `WorkflowState`.
- `id`, `libraryId`, `createdAt` — housekeeping.

Session storage of these lives in `libraryEdits.ts`
(`upsertSessionAssembly`, `sessionAssemblies`, `sessionAssemblyById`,
`sessionAssembliesForLibrary`, `removeSessionAssembly`). The library dialogue
reads them via `sessionAssembliesForLibrary(id)` for the accordion; the
workflow's `loadAssembly(id)` restores state on Edit.

### Regenerating the snapshot

The snapshot is a static export of the local Fusion libraries. To refresh it
after changing a library in Fusion:

```bash
npm run snapshot   # python3 scripts/export-library-snapshot.py
```

Huge vendor catalogues are skipped so the snapshot stays a faithful sample
rather than a copy of every tool on the machine.
