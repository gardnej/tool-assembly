# Model C

*Fusion's own Tool Assembly prototype: what it is, what it decided, and what of it
we should take.*

## The short version

Model C is a way of drawing a block-owns-slots hierarchy on top of a schema where
the cutting tool owns the block. Each **slot row is a view over one real library
tool**; the **parent block row is derived** by reading the tools' embedded
`tool-block` objects and grouping them by `guid`; and on OK, **nothing
block-shaped is written** — each tool gets its own station assignment saved back
to its own library. The hierarchy exists on screen and never needs to exist on
disk.

Its authority is limited and worth being blunt about. It is your own exploratory
branch, not an Autodesk team decision: three commits by `gardnej` dated
**3 August 2026** on `gardnej/tool-assembly` in the `fusionmake` submodule, plus a
substantial **uncommitted** working-tree change on top. The phrase "Model C"
appears exactly once in the whole tree, in a header comment that is part of the
uncommitted delta. It has never been pushed, never been styled, and — verifiably
— never run inside Fusion.

The single most valuable thing in it is not the code, it is the decision record:
Models A and B were considered and rejected for concrete reasons, and Model A is
the model our current design draws.

The single most important thing it does differently from our prototype is
**derive the parent row from the occupants instead of storing it**, which is the
move that makes the hierarchy saveable. The thing it does worse is gauge length:
it **sums stored nominal fields** where we compose joint frames.

**Recommendation: copy the architecture, keep our gauge maths, and adopt its
validation rules — which catch three failure modes we have not hit yet, all three
of which our real data would trigger immediately.**

---

## 1. Where it is, and what kind of artefact it is

The web bundle is four files:

```
/Users/jasongardner/Cursor/client-delivery/Make/Data/ToolAssembly/
    index.html          67 lines
    toolassembly.css   756 lines
    toolassembly.js   1499 lines   <- Model C lives here
    README.md           72 lines
```

with a native shell alongside it:

```
Make/NeuCAM/UI/NeuCAMUI/Dialogs/ToolAssembly/ToolAssemblyWebDialog.{h,cpp}   589 lines
Make/NeuCAM/UI/NeuCAMUI/Commands/CAM/ToolAssemblyCmd.{h,cpp}
Make/NeuCAM/UI/NeuCAMUI/Resources/Toolbar/TabToolbars.xml    (registers the button)
Make/Data/CMakeLists.txt                                     (CAMDataToolAssembly-Resources)
```

`Make` is a git submodule of `client-delivery` pointing at
`Fusion360CAM/fusionmake.git` (per `client-delivery/.gitmodules`).

### It is an experiment, and it is mid-flight

Its own README says so in the second paragraph — *"[t]his is exploratory
prototype code, not production"* — and the evidence in git backs that up rather
than softening it.

**The committed part.** Three commits, all authored by `gardnej`, all on
3 August 2026:

| Commit | Date | Subject |
| --- | --- | --- |
| `c6b8f7274c8` | 2026-08-03 10:35 | Tool Assembly prototype: web-based (QWebEngine) dialog with General/Assembly tabs |
| `4a0c1a2534f` | 2026-08-03 15:02 | Tool Assembly prototype: add Tool Library picker modal |
| `21620dce512` | 2026-08-03 16:06 | Tool Assembly prototype: add README for the web bundle |

Together they add 2,217 lines across 11 files. They were later rebased onto
mainline `6fbc97e28d7` (17 August), which is why the local commit dates read
18 August while the author dates stay on the 3rd. The pre-rebase state is
preserved on a local branch `gardnej/tool-assembly-pre-rebase`.

**The uncommitted part — this is where Model C is.** `git diff --stat` on the
submodule shows three modified files and nothing else:

```
 Data/ToolAssembly/toolassembly.js                        | 824 +++++++++++++++----
 .../Dialogs/ToolAssembly/ToolAssemblyWebDialog.cpp       | 346 ++++++++-
 .../Dialogs/ToolAssembly/ToolAssemblyWebDialog.h         |  37 +
 3 files changed, 1066 insertions(+), 141 deletions(-)
```

I checked directly whether "Model C" exists in the committed version: it does
not. `git show HEAD:Data/ToolAssembly/toolassembly.js` has a generic header
comment with no mention of any model, and a repository-wide search for
`Model [ABC]` returns exactly one hit — `Data/ToolAssembly/toolassembly.js:8`, in
the working tree. So the naming, the derivation logic and the per-tool save are
all uncommitted.

**It has never been shared.** `origin/gardnej/tool-assembly` sits at
`736cfe659b7`, the pre-rebase 3 August tip. Nobody else has seen Model C.

**It has never run.** There is a deployed bundle at
`Make/../Output/MAC64/Release/Libraries/Applications/CAM360/ToolAssembly/`, dated
18 August 13:34. Its `toolassembly.js` is 31,648 bytes and is **byte-identical to
the committed baseline** (verified with `git show HEAD:… | diff -`). The Model C
working-tree file is 49,235 bytes. The Model C JavaScript was never copied into
the build output, so the dialog has only ever been seen running the pre-Model-C
version.

**It is visually unfinished.** `toolassembly.css` and `index.html` are unchanged
since the 3 August commits — only the JS and the C++ moved. The consequence is
concrete: `renderAssembly()` now appends **four** header cells, but the only grid
rule for the table is `grid-template-columns: 1fr 130px 120px` at
`toolassembly.css:306` — **three** columns. And five element classes Model C
introduces have no CSS at all: `.gt-total`, `.station-cell`, `.row-note`,
`.row-menu`, `.pending-label`. So the assembly grid as it currently stands would
render broken.

**Why it stopped.** Not from a design change of heart. The recorded reason is a
build blockage: the checkout was 6,536 commits behind `origin/develop` with a
`build-central` pin of `4.35.*` against a Conan cache requiring ≥ 2.21, plus a
macOS App Management permission needed before the CAM UI library could be
replaced. That is in the session record, [Turning tool holder assembly
modelling](daea44ec-9e2d-472a-9807-f5973853e35e).

**One piece of genuine prior art, for context.** There is a remote branch
`origin/feature/pim-tool-assembly` dated 26 June 2023 — an earlier Autodesk
effort in this area, three years stale and unrelated to Model C. Worth knowing it
exists; not worth treating as guidance.

### How much authority does it carry?

Treat it as a well-reasoned prior draft by the same author, not as a Fusion
decision. Nothing in it has been reviewed, merged, or run. Its value is that the
reasoning was done against the real schema and the real library data, and that
reasoning is recoverable — which is most of what we need.

---

## 2. What Model C actually is

### The problem in one sentence

The design wants a block to own indexed slots; Fusion's schema has each cutting
tool own a private copy of its block, with no field anywhere that says which seat
of a block a tool occupies.

### The mechanism, in three parts

Model C's own header comment states it:

```8:12:/Users/jasongardner/Cursor/client-delivery/Make/Data/ToolAssembly/toolassembly.js
"Model C": Fusion's schema makes a cutting TOOL own its tool block as nested
geometry and expresses position through post-process.stationNumber. The page
keeps the slot-based UX but every slot row is a view over one real tool, the
parent tool-block row is derived from the tools' embedded "tool-block" objects,
and what is saved is per-tool (key + station).
```

**Slot rows are views over real tools.** A slot is a UI record — an opaque id, a
label, a station, and a `component` slot that is either empty or holds a full
library payload (`makeSlot()`, `toolassembly.js:170-182`). Filling one goes
through the native bridge: the page calls `selectComponent` with the slot's
opaque id, gets `{"pending":true}` back immediately, and the real Fusion Tool
Library opens (`ToolAssemblyWebDialog::selectComponent`, `.cpp:347-377`, using
`FusionToolLibrary::selectToolWithCallback` with
`SelectContext::COMPONENT_SELECTION`). When the user confirms, C++ pushes a
`componentSelected` event carrying the tool's full definition JSON
(`componentJson`, `.cpp:420-467`), and the page binds it to the slot whose id it
round-tripped. The opaque id matters: `onComponentSelected` looks the slot up by
id and, if the row has gone away in the meantime, simply drops the reply
(`toolassembly.js:391-396`).

The initial row count comes from `numberOfTools`. `syncSlotCount()` grows and
truncates the list to `state.toolBlock.numberOfTools`
(`toolassembly.js:207-216`), which is 3 in the current state object — and the
comment beside it is honest about what that is: *"Mock tool block, used as the
parent row only until real tools supply one."*

**The parent row is derived, never stored.** `derivedBlocks()` walks the filled
slots, pulls each tool's embedded `tool-block`, and groups by key:

```316:331:/Users/jasongardner/Cursor/client-delivery/Make/Data/ToolAssembly/toolassembly.js
  // The parent tool-block rows the current tools imply, in first-use order.
  function derivedBlocks() {
    var list = [];
    var byKey = {};
    state.slots.forEach(function (slot, i) {
      var block = toolBlockOf(slot.component);
      if (!block) return;
      var key = toolBlockKey(block, "row-" + i);
      if (!byKey[key]) {
        byKey[key] = { key: key, block: block, rows: [] };
        list.push(byKey[key]);
      }
      byKey[key].rows.push(i);
    });
    return list;
  }
```

The key is `block.guid`, falling back to `description` then a row ordinal
(`toolBlockKey`, `:296-298`). `blockRowInfo()` then names the parent row from the
first derived block, and notes the count when there is more than one
(`:619-633`). With no tools selected inside Fusion the row reads "No tool block";
in browser preview it falls back to the mock name.

**On save, nothing block-shaped is written.** `collectResult()` emits a flat list:

```433:445:/Users/jasongardner/Cursor/client-delivery/Make/Data/ToolAssembly/toolassembly.js
  function collectResult() {
    var components = [];
    state.slots.forEach(function (slot) {
      var c = slot.component;
      if (!isLibraryComponent(c) || !c.key) return;
      components.push({
        key: c.key,
        stationNumber: slot.station.number,
        halfIndex: !!slot.station.halfIndex
      });
    });
    return { name: state.name, components: components };
  }
```

The C++ side turns each entry into a tool edit. For each component it looks up
the cached `LibraryTool`, serialises its definition, applies the station, and
batches it:

```64:77:/Users/jasongardner/Cursor/client-delivery/Make/NeuCAM/UI/NeuCAMUI/Dialogs/ToolAssembly/ToolAssemblyWebDialog.cpp
/// Writes the turret station assignment the page made into a tool's definition JSON.
void applyStationAssignment(Ns::JSONNode& toolJson, int stationNumber, bool halfIndex)
{
    toolJson["post-process"]["stationNumber"] = stationNumber;
    toolJson["post-process"]["halfIndex"] = halfIndex;

    // A tool block carries its own copy of the station it sits in, so it has to agree with the
    // tool's. Only mirror into a block that is already there - never add one that isn't.
    if (toolJson.exists("tool-block") && toolJson["tool-block"].isObject())
    {
        toolJson["tool-block"]["post-process"]["stationNumber"] = stationNumber;
        toolJson["tool-block"]["post-process"]["halfIndex"] = halfIndex;
    }
}
```

The batch goes through `Iron::ToolLibraries::Factory::make(...)` and a single
`editTools(tools)` call, wrapped in a `CAMTransaction` named "Save tool assembly"
that is opened only if the document is not already in one, and aborted on failure
(`.cpp:270-318`). Failures come back to the page as `{"error": …}` and the page
keeps the dialog open on the Assembly tab (`toolassembly.js:422-431`). Two
defensive skips produce warnings rather than errors: a component the dialog did
not itself select, and a second assignment for a key already in the batch —
because *"editTools() requires that a tool appears at most once in the batch"*
(`.cpp:244-249`).

Read that save path carefully and note what is absent. No `numberOfTools`. No
`transformOverride`. No block record. Two fields per tool, and that is the whole
persistence surface. **That is the trick**: the hierarchy is presentation, so the
schema never has to grow.

### One block, several tools — our exact case

This is the case we care most about, and Model C handles it by design rather than
by accident. It also turns out our data is a slightly sharper version of the case
than I expected, so it is worth stating what I verified directly in
`~/Library/Application Support/Autodesk/CAM360/libraries/Local/Toolsand Blocks/ToolsandBlocks.json`.

Four cutting tools carry a nested `tool-block`, and **all four share the same
block guid, `0511440e-ca98-4bfb-b4d4-78edcf188d95`** — which is also the guid of
the standalone `"type": "tool block"` record at index 0 in the same file. So the
nested objects are per-tool copies of one master block record, linked by guid.
All four also point at the same geometry id
`2495f719-9192-4668-ad03-c3a002a39a80` (`EWS_163950_DIN4003.stp`).

Because the grouping key is that guid, `derivedBlocks()` collapses all four tools
into exactly one parent row, with `rows: [0,1,2,3]` — which
`renderDerivedBlockProps()` surfaces as a `"Used by"` property reading
"4 row(s)" (`toolassembly.js:857`). That is precisely the hierarchy the design
draws, produced from real records with no invented structure.

What actually distinguishes the four occupants is not the station number. Every
one of them has `stationNumber: 0`. It is `transformOverride`:

| Tool | guid (short) | translation | rotation Z |
| --- | --- | --- | --- |
| `Thread LH` (turning threading) | `c964fc7c` | `0, 0, -10` | 0 |
| `General Turining  Test 2 RH` | `4282e896` | `125, -25, -30` | π |
| `Test 3 LH` | `7026f1f8` | `0, 0, -20` | 0 |
| `General Turining  Test 2 RH` | `ca8efa77` | `125, -25, -30` | π |

Note the last two rows: distinct guids, identical description, identical
override. Two separate tools claiming the same physical position. That is real
data being messy, and it is the kind of thing the prototype should surface rather
than smooth over.

Model C reads `stationNumber` and not `transformOverride` for slot position
(`stationFromComponent`, `toolassembly.js:300-310`), so on this data every row
would come back station 0 and its duplicate-station validation would fire three
times. The transforms are shown, but only as read-only text on the properties
panel when a `transformOverride` is present (`:859-863`). **This is the one place
where Model C's chosen discriminator and our real data disagree** — a gap worth
inheriting knowingly rather than rediscovering.

### Were Models A and B considered, and why C?

Yes, and the comparison is the most valuable thing here. It is not in the code —
the names A and B appear nowhere in the tree — but it is recorded in the session
[Turning tool holder assembly modelling](daea44ec-9e2d-472a-9807-f5973853e35e).
I am reporting it as a decision record, distinct from the code claims above.

**Model A — the block owns N slots.** This is what our current design draws. Its
properties are not invented: `numberOfTools`, `numberOfAttachmentPoints`,
`orientationType`, `machineSideConnectionType` and `adaptiveItemSize` are all
genuine fields on a real tool block. What does not exist is storage for the slot
map — nothing in the schema says "slot 2 of block X holds tool Y", because
`numberOfTools` is a capacity declaration and nothing more. The rejection is
blunt and worth quoting: *"If you build on Model A as drawn, OK can't save,
because there's no record to write it to. That's the same dead end as before,
just inside real Fusion."*

**Model B — strictly tool-owns-block.** Saveable today, through the same
`ToolLibraryInterface::editTools` path `TurningToolHolderExportCmd` already uses.
Rejected not for correctness but for scope: *"it's not much of an 'assembly' UI —
it's one tool and its block, so the multi-tool picture you want disappears."*
This is essentially what our prototype's two-row grid does now.

**Model C — the reconciliation.** *"A 'slot' in the UI is really 'a tool whose
embedded block is this block'… so the slot list is a view assembled by querying
which tools reference this block."* Chosen because every row maps to something
Fusion can write, while the screen keeps the block-with-several-tools
arrangement. The clinching observation was that the tool's own
`post-process.stationNumber` and `halfIndex` give occupancy somewhere to live
without a schema change.

Read as a decision tree the conclusion is: A is undeliverable, B is deliverable
but not the product, C is both. That framing transfers to us unchanged. It is
also worth noting that our earlier attachment-points investigation reached the
same conclusion from the C++ side — `NestedItemGeometryData` has two scalar
members and no occupant collection, so there is nowhere for Model A's slot map to
go. Two independent routes, same answer.

---

## 3. What its UI looks like, against ours

The layout is a four-tab dialog — General, Assembly, Setup, Post processor — with
a graphics pane on the right and an OK/Cancel footer (`index.html:23-59`). Setup
and Post processor are stubs. The Assembly tab holds a grid table, a row toolbar
beneath it, a properties panel, and a validation status area
(`renderAssembly()`, `toolassembly.js:570-617`).

### Where the two designs agree

More than I expected, and the agreements are structural rather than cosmetic.

- **A parent block row with a disclosure triangle.** `renderBlockRow()` builds a
  `▾` toggle that flips `state.expanded` and re-renders, rotating `-90°` when
  collapsed (`:641-646`, CSS `:351-364`). Same affordance as ours.
- **Indented child rows.** Slot rows carry `gt-row is-child`, and the CSS
  indents their name cell by 34px (`:664`, CSS `:340-342`).
- **"Slot N" label plus a "Select component" dropdown on empty rows.** The empty
  branch appends a `slot-label` span and a `slot-select` trigger with a `▾`
  caret, opening a component menu on click (`:690-704`). This is our design's
  control, essentially identically.
- **A bottom row toolbar with four icon buttons** (`:594-610`).
- **Three of our four columns**: Name, Type, Gauge length.

### Where they diverge

**Model C adds a Station column.** The header is Name, **Station**, Type, Gauge
length (`:577-580`). The station cell shows the number plus a `½` suffix for a
half-index (`stationText`, `:312-314`) and carries an explanatory tooltip — either
"Follows row order" or "From the tool's post-process settings" depending on
whether the value was inferred or read from the tool (`:672-675`). This is the
most consequential visual difference, and it is a direct consequence of Model C:
once a row is a view over a real tool, that tool's station is the row's actual
identity and hiding it makes the row ambiguous.

**Gauge length is a cell, not a row.** Our design puts a per-slot gauge readout
on its own row after each slot; Model C puts it in the fourth cell of the slot row
itself (`:681-683`). Emptiness is shown as `-` with a muted style.

**Model C adds a "Total gauge length" footer row** (`renderTotalRow()`,
`:732-760`), outside the scrolling body. When some rows lack a measurement it
appends a note — "N row(s) have no measurement, so the total is incomplete" — and
marks the number with a trailing `*`. Our design has no total.

**The toolbar semantics differ from the icons' apparent meaning.** Ours reads as
up / down / remove / delete. Model C's four are ↑ "Move up", ↓ "Move down",
✕ **"Clear component"**, and 🗑 **"Remove slot"** (`:596-609`). Those last two are
genuinely different operations, and the distinction is a good one:
`clearSelectedComponent()` nulls the row's component and leaves the row
(`:1407-1415`), while `removeSelectedSlot()` splices the row out, refuses to go
below one row, and reassigns
`state.toolBlock.numberOfTools = state.slots.length` (`:1417-1425`).

**Up/down means station reassignment, not chain reordering.** This is worth
correcting against what I wrote in `attachment-points.md`, where I argued the
arrows have no referent. In Model C they do, and the code says why:

```1396:1400:/Users/jasongardner/Cursor/client-delivery/Make/Data/ToolAssembly/toolassembly.js
    // Stations belong to the position, not to the tool, so the moved tool takes
    // over the station its new row represents.
    var station = state.slots[i].station;
    state.slots[i].station = state.slots[j].station;
    state.slots[j].station = station;
```

Moving a row swaps both the rows and their stations, so the tool inherits the
station of its new position — and since station is what gets saved, the arrows
are a real edit. Both statements hold at different levels: order within a joint
chain is fixed by the frames, but which station a tool is assigned to is
genuinely user-editable. Ours has no equivalent because we have no station column
to edit.

**Model C adds a per-row overflow menu.** Filled rows get a `⋯` button
("Component actions", `:720-730`) which opens a menu including an "Edit in
library…" action that calls the bridge's `editComponent` and opens the real Tool
Library edit page for that tool (`.cpp:402-418`).

**Its properties panel is richer and explicitly read-only.** When a block is
derived, `renderDerivedBlockProps()` titles the panel "Tool block properties
(from the selected tools)" and lists description, vendor, product id,
orientation, machine connection, **"Attachment points"**, **"Number of tools"**,
size, and a `"Used by"` count — plus rotation and translation overrides when a
`transformOverride` exists (`:843-864`). When no block is derived it says so:
*"The tool block is read from the selected tools. Select a tool that references
one."* (`:834`).

---

## 4. What to copy, and what not to

### Copy: the derivation and save architecture

This is the whole point of the exercise. Derive the parent block row from the
occupants' embedded `tool-block` objects grouped by `guid`; keep slot rows as
views over real tools; make the save payload a flat per-tool list. Our snapshot
already has the input this needs — four tools sharing one block guid — and the
grouping logic is about fifteen lines.

The corollary matters as much as the mechanism: **do not add a block-shaped
record to our state**. Model C keeps `state.toolBlock` around only as a
browser-preview fallback and labels it as mock. Everything real flows upward from
the occupants.

### Copy: the three validation rules

These are the clearest thing Model C has that we do not, and all three fire on
our real data — which is exactly why they are worth having.
`validateAssembly()` (`toolassembly.js:461-515`) produces:

1. **Conflicting blocks.** If the selected tools reference more than one block
   guid: *"The selected tools reference N different tool blocks (…). An assembly
   can only use one."* Our four tools share a guid so this stays quiet, but it is
   the failure that turns a derived hierarchy from a fiction into a lie, and
   without the check nothing would notice.
2. **Capacity overflow.** If more tools are assigned than the block's
   `numberOfTools` allows: *"The tool block holds N tool(s) but M are
   assigned."* On our data `numberOfTools` is 1 and four tools reference the
   block, so this fires immediately — a real inconsistency in real data that our
   prototype currently says nothing about.
3. **Duplicate station.** *"Station X is used by more than one tool."* All four
   of our tools are station 0, so this fires three times. That is the honest
   report of the state of the data.

Each of those is a genuine problem our two-row grid has simply never been able to
express. Adopting them is cheap and makes the prototype more truthful, not less.

### Copy: the read-only framing of derived properties

Titling the panel "from the selected tools", showing `-` for the block row's own
station and gauge, and stating plainly when no block is derived. All of it
communicates "this row is a summary, not a thing you own", which is exactly the
idea a designer needs the UI to carry.

### Do not copy: its gauge length

This is the important reservation. Model C's per-row gauge is the first populated
value out of three stored scalars:

```268:285:/Users/jasongardner/Cursor/client-delivery/Make/Data/ToolAssembly/toolassembly.js
  var GAUGE_SOURCES = ["assemblyGaugeLength", "holderGaugeLength", "overallLength"];

  // {value, unit, field} or null when the tool carries no usable measurement.
  function componentGauge(c) {
    if (!c) return null;
    if (!isLibraryComponent(c)) {
      return typeof c.length === "number"
        ? { value: c.length, unit: "millimeters", field: "length" }
        : null;
    }
    for (var i = 0; i < GAUGE_SOURCES.length; i++) {
      var v = c[GAUGE_SOURCES[i]];
      if (typeof v === "number" && isFinite(v)) {
        return { value: v, unit: c.unit, field: GAUGE_SOURCES[i] };
      }
    }
    return null;
  }
```

and `totalGauge()` adds them up (`:333-356`). That is a **sum of nominal
fields** — precisely what this repo's README rejects when it says gauge length is
"measured, not summed", and what `src/data/joints.ts` and the add-in's
`joints.py` exist to avoid. Our approach composes MCS and CSW frames, so it
accounts for frames that are rotated or off-axis; Model C's cannot, and would
report a confident number for a chain it has not actually measured. On our data
that is not academic: all four tools carry a `transformOverride`, which overrides
the joint chain entirely, so a summed figure would be wrong twice over.

Keep our maths. Borrow only the presentation ideas around it: the `-` for
unmeasurable, and the "N row(s) have no measurement" caveat, which is a good
pattern for partial data.

### Do not copy: editing `numberOfTools` from the UI

`removeSelectedSlot()` writes `state.toolBlock.numberOfTools = state.slots.length`,
but `collectResult()` never sends `numberOfTools` and the C++ save never writes
it. So the UI mutates a block property that cannot be persisted — a dead write
that will read as a bug the first time someone removes a row, closes, and
reopens. If row count needs to be editable, either persist it properly or make
it explicitly session-only.

### Do not copy: hiding the station-versus-transform gap

Model C positions rows from `stationNumber` and shows `transformOverride` only as
read-only text. On real data `stationNumber` is 0 everywhere and the transforms
are the only real discriminator. Inheriting the choice is fine; inheriting it
silently is not. Surface it.

### Also inherit: the finished bits of the bridge design

Two details are worth lifting even though we have no native shell. The **opaque
slot id round-trip** makes a late reply safe — if the row vanished while the
library was open, the reply is dropped rather than misapplied
(`toolassembly.js:391-396`). And the **failed-save-keeps-the-dialog-open**
behaviour, with the error surfaced in the status area and the Assembly tab
re-selected (`:422-431`), is the right shape for any real persistence we add.

---

## 5. Terminology

Fusion is not consistent, so this needs care. What I found, counted in the
current `toolassembly.js`:

| Term | Uses | Where it is user-visible |
| --- | --- | --- |
| slot / Slot | 103 | `"Slot N"` row labels; `"Remove slot"` tooltip |
| station / Station | 37 | `"Station"` column header; `"Station number"` property; `"Station X is used by more than one tool."` |
| attachment | 1 | `"Attachment points"` — the read-only property row only |
| seat / occupant | 0 | never used |

So **Model C says "slot" for the row and "station" for the position**, and treats
"attachment points" as nothing but a passthrough label for the raw field.

The important signal is which term the *C++* uses, because that is closer to
Fusion proper than a prototype's JavaScript. It calls it a **turret station**
without hedging — the doc comment on the save helper reads *"[w]rites the turret
station assignment the page made into a tool's definition JSON"*
(`ToolAssemblyWebDialog.cpp:64`), and the field it writes is
`post-process.stationNumber`. That matches what the wider codebase does:
`machine::TurretDefinition` describes station attach frames and half-index
positions, and MachineBuilder classifies parts as
`AttachFramePartKind::TurretStation`.

My recommendation on labels: use **"Slot N"** as the placeholder text on an
*empty* row, because it names a gap in the UI rather than asserting anything
about the data — which is what Model C does. Use **"Station"** for the column and
for anything persisted, because that is the field's real name in both the schema
and the C++. Avoid "attachment point" in UI copy entirely: as established in
`attachment-points.md`, `numberOfAttachmentPoints` counts the block's two ends
and never its seats, so using the phrase for a seat would entrench a
misreading — and note that Model C's own properties panel puts "Attachment
points" and "Number of tools" on adjacent lines, where they read as if they were
the same kind of thing. And do not introduce "seat": it appears nowhere in
Fusion, and inventing vocabulary is the opposite of what we are trying to do
here.

---

## What I verified versus what I am inferring

**Verified in code and data**, all read directly: the file inventory and line
counts; the three commits, their author, dates and diffstat; that "Model C"
exists only in the uncommitted working tree; that `origin` is at the pre-rebase
tip; that the deployed bundle is byte-identical to the committed baseline; that
the CSS defines three columns while the JS renders four and that five Model C
classes are unstyled; the derivation, save, validation, gauge, reorder and
toolbar logic quoted above; the C++ bridge contract and `editTools` path; the four
real tools' shared block guid, shared geometry id, `stationNumber: 0`, and
distinct `transformOverride` values.

**From the recorded session** rather than code: the names "Model A" and
"Model B", the reasoning that rejected each, and the build blockage that stopped
the work. Cited to [Turning tool holder assembly
modelling](daea44ec-9e2d-472a-9807-f5973853e35e).

**Inference, flagged as such**: that the work stopped because of the build rather
than a change of design direction — the timing and the unstyled state are
consistent with it, but nobody wrote that down. And that the nested `tool-block`
objects are copies of the standalone block record rather than references to it —
the shared guid and shared geometry id make this near-certain, but I did not find
the code that establishes the copy.
