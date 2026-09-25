# Turning Tool Holder — Tool Assembly

Two pieces of work against Fusion's real tool library framework:

- **`addin/ToolAssembly/`** — a Fusion Python add-in that reads and writes the
  real tool libraries. See [its README](addin/ToolAssembly/README.md) for how
  Fusion actually models an assembly, including two API traps worth knowing.
- **`src/`** — a React prototype of the **Turning Tool Holder** dialogue, running
  on a snapshot of the real libraries. Aligned with the
  [Figma design](https://www.figma.com/design/6umxPtr1MHVMqbXl6fMGXn/Turning-Tool-Holder?node-id=1896-61951)
  and the **[My Prototype](/Users/jasongardner/Cursor/My Prototype)** Fusion
  shell, with the Fusion Dark Blue tool library dialogue (Artifakt Element).

## Run the prototype

```bash
npm install
npm run dev
```

Deep links: `?toolLibrary=1` opens the Tool Library browser, `?assembly=1` opens
the assembly dialogue directly.

```bash
npm test        # joint maths and library model, via Node's test runner
npm run build   # typecheck and production build
```

## Share the prototype with colleagues

Two ways, pick whichever suits the person on the other end:

### Send a link (GitHub Pages)

The repo carries a workflow at `.github/workflows/deploy.yml` that builds the
bundle and publishes it to GitHub Pages on every push to `main`. Once enabled,
colleagues open the prototype in the browser at:

**<https://gardnej.github.io/tool-assembly/>**

First-time setup (once per repo):

1. Push the current branch to `main` (merge the sandbox branch, or push a
   feature branch and trigger the workflow manually — see below).
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`, or open **Actions → Deploy prototype to GitHub Pages → Run
   workflow** to publish an arbitrary branch on demand.

The deploy job posts the live URL in its summary. State is per-browser and
lives in memory only — the snapshot on Pages is read-only, so nothing a tester
does affects the deployed data.

### Ask them to run it locally

For anyone happy in a terminal:

```bash
git clone https://github.com/gardnej/tool-assembly.git
cd tool-assembly
npm install
npm run dev
```

Then open the URL Vite prints (typically <http://127.0.0.1:5174>).

Prerequisites: Node 20 or newer. Nothing else — the snapshot is checked in.

### What to try

- Ribbon **Manage → Solid Holder → Tool Assembly** opens the dialogue.
- Pick a tool block, mount an extension / collet / tool in each position.
- The **3X Axial** and **3X Axial 1** libraries skip validation, so an OK
  reaches Review without joint-frame errors.
- **Save Assembly** stores the whole chain in *User Libraries → Documents →
  Saved Assemblies* and in *3X Axial 1*; right-click a saved assembly in the
  Tool Library to Edit it back into the workflow.

## Real data, not a mock catalogue

The prototype reads `src/data/realLibrarySnapshot.json`, exported from the local
Fusion libraries. It carries Fusion's own schema — real `type` strings, the
nested `tool-block` a cutting tool owns, `post-process` fields such as
`stationNumber` and `halfIndex` — plus the MCS/CSW joint frames Fusion extracted
from each STEP file. Regenerate it after changing a library in Fusion:

```bash
npm run snapshot   # python3 scripts/export-library-snapshot.py
```

Huge vendor catalogues are skipped, so the snapshot stays a faithful sample
rather than a copy of every tool on the machine.

## How this shapes the UI

Four consequences of following the real model, each visible in the dialogue:

**A tool owns its block, so the parent row is derived.** Nothing in the schema
records that a block holds a set of tools; each tool holds a copy of the block
instead. The grid still shows a block with slots beneath it, but that parent row
is read back out of the occupants by grouping their nested `tool-block` objects
by `guid`. Nothing block-shaped would ever be written on save — each tool would
carry its own station. The slot ordinals exist only on screen.

**The tool block is the root, and it is chosen by navigating the library.** The
block row is the first row of the table and its dropdown offers a single action,
"Select from Tool Library…", rather than an inline list of every block. The
block's own library then scopes the candidates offered to the slots below it, so
there is no separate library selector.

**Slot count comes from the block, and reordering is a real edit.** The number of
slot rows follows the block's `numberOfTools` field, exposed as an editable
property. Moving a row up or down swaps the occupants and leaves the stations
where they are, so a tool inherits the station of the position it lands on —
which is the one thing about a position that Fusion can actually store.

**Gauge length is measured, not summed.** The stack-up comes from composing the
MCS and CSW frames, so it accounts for frames that are rotated or off-axis. Each
slot is measured through its own chain, from the block's cutting face to that
tool's tip. A component missing a frame makes its chain unmeasurable, and the
grid shows an em dash and says which frame is missing rather than quietly showing
a wrong number.

Joint frames are authored in the STEP file as coordinate systems labelled `MCS`
and `CSW`; they cannot be set through the API. The add-in README explains why.

## The solid view

The right-hand panel shows the block as a solid, with each part appearing as it is
chosen. A position holds a stack rather than a single component, and the grid
nests it the way the steel does: block, then extension, then collet, then cutting
tool. The extension and the collet are adaptive items — they exist to make a tool
fit a position, the extension by packing the position out and the collet by
gripping the tool inside it. The collet is optional, because an extension can hold
a tool on its own.

Anything not yet chosen is drawn as a faint ghost so the free space can be seen
and aimed at, and clicking any part selects its row in the grid, which is where
that part is then chosen. A ghost only appears once there is something to mount
it in, so an empty position reads as one free seat rather than a stack of
floating parts. Only one block has a mesh behind it. The library's own
solids live in `.3DTool` files as Autodesk Shape Manager B-rep, which nothing
outside Autodesk reads, so that block was exported from CAD as OBJ instead and
converted to glTF; every other block falls back to a message saying so.

Two things about it are worth knowing before trusting what it shows. The export
is a whole assembly in one coordinate space, so seating a part reveals it rather
than placing it — the arrangement is the CAD model's, not something composed from
joint frames, and that block carries no frames to check it against. And parts are
shown and hidden by material, because `<model-viewer>` reaches materials but not
nodes, which is why `scripts/prepare-preview-model.py` puts each body on a
material of its own before conversion. Picking works off the same materials: a
click is hit-tested to a material and mapped back to the position and level it
stands for.

Which body is which had to be read off the geometry, since the export names them
all `Body1`, `Body1:1` and so on: `scripts/inspect-obj.py` reports each body's
size and position, from which the parts cluster into three seats and, within a
seat, stack along the tool axis. The records are nominal — every seat holds the
bodies the export put there whichever record is picked for it, so choosing a
different extension changes the label and not the solid.

## The ribbon behind the dialogue

The Manufacture ribbon is not a drawing of Fusion's — it is generated from it.
`scripts/build-ribbon.py` reads the product's own toolbar definition and writes
`src/data/ribbonManufacture.ts`, so the tabs, the panels within each tab and the
commands within each panel are the ones the product ships, in its order:

```bash
python3 scripts/build-ribbon.py   # --fusion <path> if client-delivery is elsewhere
```

Four files in the Fusion tree between them hold everything the ribbon needs, and
the script reads all four rather than anyone transcribing them:

| Source | What it gives |
| --- | --- |
| `Resources/Toolbar/TabToolbars.xml` | Tab order, panel order, and which commands are promoted onto the bar as against held in the panel's dropdown |
| `NeuCAMUI.cpp` | Tab and panel captions, which the XML deliberately leaves out, and the captions for split buttons |
| `cmdID_TransID_map.json` | Command captions, and the file that defines each command |
| `Resources/Icons/…` | The artwork, copied into `src/assets/manufacture-icons/` |

Milling and Turning carry their full command set; the other tabs keep the
product's panels but show only the promoted buttons, which is enough to read the
shape of a tab nobody is prototyping against. A command whose caption or icon is
chosen at runtime rather than declared cannot be resolved by reading the source,
so it falls back to a caption derived from its id and a plain glyph.

This is also why the assembly dialogue opens from **Manage ▸ Solid Holder ▸ Tool
Assembly**: that is where the product keeps it, alongside Tool Block and Turning
Tool Holder, rather than under the tool library where an invented ribbon had put
it.

## The browser

The tree has no layout file to generate it from — Fusion builds it out of
whatever the document holds — so the tree here is written by hand, but against
the product rather than against a memory of it. `NeuCAMComponentInstanceBrowserEntry`
fixes the order under the document (Units, Named Views, Origin, Analysis, the
linked design model, then the CAM collections, of which Setups is the only one
always present), and each node is named as the product names it: `Units: mm`,
`HOME` rather than Home, and origin children as the single letters `O`, `X`,
`Y`, `Z`, `XY`, `XZ`, `YZ` rather than "X Axis". Every setup carries its Stock
and Setup Model; there is no "Models" folder, which the earlier tree invented.

It is also drawn as the product draws it, which is not as a panel. The palette
is transparent — the shell layout marks it so, and the toolbar skips its
background fill entirely when floating — so nothing is painted behind the tree.
What paints is each row: a chip as wide as its own contents, holding the
show/hide control, the icon and the label, with the expander outside it painting
nothing at all. The canvas shows through the gaps between rows and to the right
of every short label, and that, rather than any translucency, is what makes the
browser read as a HUD. Above it sits the palette's 25px title, over the canvas
like everything else, and the palette is the 300px the layout gives it.

Selection composites over the row colour rather than replacing it, the way the
theme map's `combineColors` does, so a translucent accent still reads as opaque
against the model behind it.

The artwork is the product's own, copied by a second script:

```bash
python3 scripts/build-browser-icons.py
```

Its table maps each kind of node to the resource folder Fusion draws it with, so
an icon that is renamed upstream fails loudly rather than quietly showing the
wrong picture. The row metrics come from the same place: 24px rows, 18px of
indent per level, 16px icons. The show/hide control is the Eye/EyeOff pair the
product uses — despite everyone, the API included, calling it the light bulb —
and like the product's it appears on hover and stays put once a node is hidden.

## Structure

| Path | Role |
| --- | --- |
| `src/data/joints.ts` | Rigid-transform maths; a port of the add-in's `joints.py` |
| `src/data/realLibrary.ts` | Typed access to the snapshot, joint frames, stack-up, block derivation |
| `src/data/assembly.ts` | Slot mechanics and validation, kept free of React so tests can reach it |
| `src/data/realLibrarySnapshot.json` | Generated; do not edit by hand |
| `src/data/previewGeometry.ts` | Prototype-only records for the one block that has a mesh |
| `src/data/ribbonManufacture.ts` | Generated; do not edit by hand |
| `src/hooks/useToolAssemblyWorkflow.ts` | Dialogue state (local React state only) |
| `src/components/` | Fusion shell, assembly grid, library browser, panels |
| `src/components/AssemblyViewer.tsx` | Solid view of the block and the stacks seated on it |
| `geometry-source/` | CAD exports the viewer's glTF is built from |
| `scripts/export-library-snapshot.py` | Snapshot exporter |
| `scripts/build-ribbon.py` | Generates the Manufacture ribbon from Fusion's toolbar definition |
| `scripts/build-browser-icons.py` | Copies the browser tree's artwork out of Fusion |
| `scripts/prepare-preview-model.py` | Puts each body of an OBJ on its own material |
| `scripts/inspect-obj.py` | Reports body sizes and positions, to work out which part is which |
| `tests/` | Node test-runner suites, bundled with esbuild |

The joint maths exists twice, in TypeScript and in Python, deliberately: the
prototype needs it in the browser and the add-in needs it in Fusion. Both suites
assert the same numbers against the same real data, so they cannot drift
silently.
