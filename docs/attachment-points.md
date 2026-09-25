# Attachment points, slots and turret stations

*What the multi-slot Turning Tool Holder design would need from Fusion, and whether
to prototype it now.*

## The short version

The design's hierarchy — a parent **Tool block** row owning indexed **Slot 1..N**
child rows, each with its own component picker and its own gauge length — is not
buildable on real data today. But the reason is not the one the field names
suggest, and the gap is narrower than it first looks.

`numberOfAttachmentPoints` is a red herring. It is not a seat count. Fusion's own
header comment describes it as the *"[t]otal number of attachment points on the
adaptive item, machine side and tool side"*, and the code sets it to exactly `2`
whenever a nested block gets 3D geometry and back to `0` when that geometry is
cleared. Fully populated it would read 2 for a block with a machine end and a
tool end — never 3 for a three-seat block. It counts the *ends of the block*, not
the things that can sit on it.

The field that means what the design means is the one next to it:
`numberOfTools`, internally `numberOfToolAttachmentPoints`, documented as
*"[n]umber of tools that can be attached to the adaptive item"*. It defaults to
`1`, it round-trips through the library JSON, the CSV exporter and the XML
importer, Fusion's own Tool Assembly prototype already reads it, and Fusion's own
test fixtures carry the values `2` and `3`. So a slot **count** is a real,
first-class, already-plumbed concept.

What does not exist is slot **identity**. There is no collection of occupants
anywhere in the model, no per-seat index, and no per-seat joint frame. A block
knows how many tools it could hold and nothing whatsoever about which ones do or
where they sit. Every layer below the count is singular: one nested block per
tool, one MCS/CSW pair per solid, three joint types with no index, one
`std::optional` per frame lookup in the STEP importer.

And on the ownership question: the inversion is real but it is not the blocker,
and it does not need a schema change to work around. Fusion's own Tool Assembly
prototype in `client-delivery` already solves it, calls the solution "Model C",
and the approach transfers directly to this prototype.

**Recommendation: prototype the hierarchy now**, faking exactly one field
(`numberOfTools`) and deriving everything else from real records. Details and
caveats in the last section.

---

## What exists today

### Two fields, two different meanings

Both fields live on `ToolGeometry`, in the block of members commented *"Turning
tool block parameters"*:

```1008:1018:/Users/jasongardner/Cursor/client-delivery/Make/IronLib/nc/nc/ToolGeometry.h
    /** Turning tool block parameters --------------------------- */
    /** Supported machine connection type. */
    std::wstring machineSideConnection;
    /** Adaptive item connection size */
    double adaptiveItemSize;
    /** Orientation of the tool held by the adaptive item. */
    OrientationType orientationType;
    /** Total number of attachment points on the adaptive item, machine side and tool side */
    int numberOfAttachmentPoints;
    /** Number of tools that can be attached to the adaptive item */
    int numberOfToolAttachmentPoints;
```

"Adaptive item" is Fusion's internal name for a tool block or holder — the thing
that adapts a cutting tool to a machine interface. The two counts are answering
different questions: how many ends does this adapter have, versus how many tools
can it carry.

The constructor defaults them apart, in
`Make/IronLib/nc/nc/ToolGeometry.cpp:59-60`: `numberOfAttachmentPoints = 0` and
`numberOfToolAttachmentPoints = 1`. And `numberOfAttachmentPoints` is maintained
automatically rather than authored:

```2804:2814:/Users/jasongardner/Cursor/client-delivery/Make/IronLib/nc/nc/ToolGeometry.cpp
void ToolGeometry::setToolBlock3DGeometry(const Tool3DGeometryBase& geometry)
{
    m_nestedItemGeometryData.toolBlock.geometry3D = geometry.clone();
    setNumberOfAttachmentPoints(2);
}

void ToolGeometry::setToolBlock3DGeometry(std::nullopt_t)
{
    m_nestedItemGeometryData.toolBlock.geometry3D.reset();
    setNumberOfAttachmentPoints(0);
}
```

That is the whole lifecycle of the field: 2 when a block has a solid, 0 when it
does not. It is derived bookkeeping — effectively a boolean "does this block have
both a machine-side and a cutting-side frame" — wearing an integer's clothes. It
is not vestigial, in that it is read, written, compared for equality
(`ToolGeometry.cpp:1035`) and shown in Fusion's own UI, but it is vestigial *for
this purpose*: it can never express a slot count.

`numberOfTools` is the opposite. It is plumbed through every serialisation path
Fusion has, and every one of them treats it as authored data:

| Path | Evidence |
| --- | --- |
| Library JSON key | `Make/IronLib/ToolLibrary/ToolJsonKeys.h:162`; mapping at `Make/IronLib/ToolLibrary/ToolFormatConverter.cpp:1453-1454` |
| JSON key path | `Make/IronLib/tool/tool/ToolParameterJSONKeyPaths.cpp:57` → `tool-block.geometry.numberOfAttachmentPoints`, and `:116` for the top-level form |
| Direct JSON reader | `Make/IronLib/ToolLibrary/DirectJsonToolConverter.cpp:38-40` — reads both with `requireInt`, so a `0` in a file stays `0` |
| Parameter table | `Make/IronLib/core/ToolSpecification.cpp:4220-4221`, `:4299-4300` |
| CSV columns | `Tool Block Attachment points (tool_block_numberOfAttachmentPoints)` and `Tool Block Number of Tools (tool_block_numberOfTools)` in `Make/NeuCAM/UnitTest/IronLib-test/data/TestToolLibraries/CSV/3D Geometry.csv` |
| Tool XML | `Make/IronLib/core/ToolSpecification.cpp:2197-2198` writes `toolCount` and `attachmentPoints` attributes; read back at `Make/IronLib/core/ToolXMLReader.cpp:487` and `Make/IronLib/core/ToolXMLDataConverter.cpp:538-539` |

Fusion's own test fixtures exercise values greater than one. In
`Make/NeuCAM/UnitTest/IronLib-test/data/TestToolBlocks.json`, the first block has
`"numberOfAttachmentPoints": 0` with `"numberOfTools": 3`, and the second has
`"numberOfAttachmentPoints": 2` with `"numberOfTools": 2`. The spec factories do
the same in code: `TestToolSpecFactories.cpp:2462-2463` builds a block with
0 attachment points and 3 tools, and `:2780-2781` one with 1 and 2. So a
three-seat block is a shape the library format already accepts and the test suite
already round-trips.

### The ownership shape, in one struct

The nested-item model is where the hierarchy question is settled. It is two named
scalar members — no vector, no map, no index:

```40:47:/Users/jasongardner/Cursor/client-delivery/Make/IronLib/nc/nc/tool/AdaptiveItem.h
/** ToolGeometry-level data for all nested adaptive items. */
struct NestedItemGeometryData
{
    HolderGeometryData holder;
    ToolBlockGeometryData toolBlock;

    bool isSame(const NestedItemGeometryData& other) const;
};
```

The same shape repeats at the two layers above it —
`NestedItemNCData` in the same file (lines 87-93) and
`NestedItemToolSpecificationData` in `Make/IronLib/core/AdaptiveItem.h:34-40`.
A tool therefore has room for exactly one holder and exactly one block, at every
level of the model, and a block has no member in which occupants could live. The
public API mirrors this: `ToolBlock.geometry` is a single
`AssemblyComponentGeometry` property
(`Make/Build/NIDL/InDesign/CAM/Tools.cs:526-535`).

This is what the README in this repo already records as "a tool owns its block",
and it is correct. What is worth adding is that the inverse is not merely absent
but structurally absent: there is nothing to populate.

### One joint frame pair per solid

The stored-geometry container holds exactly two matrices:

```142:146:/Users/jasongardner/Cursor/client-delivery/Make/IronLib/core/tools/ToolASMGeometry.h
    /// CSW workplane
    Matrix4x4 m_csw;

    /// MCS workplane
    Matrix4x4 m_mcs;
```

Its factory signature takes them as two scalars —
`make(id, tempFile, const Matrix4x4& csw, const Matrix4x4& mcs, filePath)` at
`ToolASMGeometry.h:57-62` — and the accessors `csw()` / `mcs()` return single
references. This is the class behind the `.3DTool` files, so the file format
follows: one `mcs` key, one `csw` key, both scalar 4×4s.

The API's joint vocabulary is likewise closed and unindexed. `ToolJointType` has
three values, `CuttingSideJoint`, `MachineSideJoint`, `ToolHolderJoint`
(`Make/Build/NIDL/InDesign/CAM/Tools.cs:600-617`), and the setter is
`setJointOrigin(ToolJointType jointType, Matrix3D jointOrigin)` — a type and a
matrix, no index (`:577-580`). It is also still the stub this repo's add-in README
documents; the raising implementation is at
`Make/NeuCAM/Server/CAMXLayer/Classes/CAM/Tools/XLayerAssemblyComponentGeometry.cpp:99-114`.

Note one nuance: `ToolASMGeometry` exposes both `getTransformToHolderMCS()` and
`getTransformToToolBlockMCS()` (`ToolASMGeometry.h:67-69`). Two accessors, but
both derive from the same single `m_mcs`. The same solid can be *interpreted* as
holder-side or block-side; it cannot carry two mounting frames.

### The real data on this machine

There are five tool-block objects on this machine and they are all in one file,
`~/Library/Application Support/Autodesk/CAM360/libraries/Local/Toolsand Blocks/ToolsandBlocks.json`:
one standalone `"type": "tool block"` record, and four cutting tools carrying a
nested `tool-block`. A search for `"type": "tool block"` across the whole of
`~/Library/Application Support/Autodesk` returns matches in that file and nowhere
else — not in the eleven vendor and user libraries under `Local`, not in the
archived `Local.zip`, and not in the hub library caches under
`Autodesk Fusion 360/…/NsHubLibrariesCache`, which do not emit either field at
all.

All five carry the identical geometry block:

```json
{"adaptiveItemSize": 0, "numberOfAttachmentPoints": 0, "numberOfTools": 1,
 "orientationType": "axial", "machineSideConnectionType": "Unspecified"}
```

Three details in that data are worth flagging, because they each undercut a
different thing the design would want to lean on.

**The four nested blocks all have `numberOfAttachmentPoints: 0` despite having
3D geometry.** Each points at geometry id `2495f719-9192-4668-ad03-c3a002a39a80`
(`EWS_163950_DIN4003.stp`). By the code above, a block with a solid should read 2.
It reads 0 because these records reach the model through the direct JSON reader,
which takes the stored integer verbatim
(`DirectJsonToolConverter.cpp:38-40`), rather than through
`setToolBlock3DGeometry`. So the field is not just unpopulated — on real records
it is actively inconsistent with the geometry beside it. It should not be trusted
for anything.

**All four carry `stationNumber: 0`.** This is the only per-occupant coordinate
in the schema, and in real data it is unset. Four different cutting tools all
claim station 0 of the same block.

**All four carry a `transformOverride`.** Which means, per Fusion's own
precedence rules, that their placement is manual and the joint chain is being
overridden. Any per-slot gauge length computed from the frames would disagree
with what Fusion draws.

The joint-frame side is equally clear. Ten `.3DTool` files sit under `Local`, and
every header carries at most one `mcs` and one `csw` — flat scalar keys, exactly
as `ToolASMGeometry` implies:

```json
{"csw":[[1,0,0,63],[0,1,-0,0],[0,0,1,-80],[0,0,0,1]],
 "geometryFileName":"EWS_163950_DIN4003.stp",
 "mcs":[[1,0,0,0],[0,1,-0,0],[0,0,1,0],[0,0,0,1]]}
```

One file, `ce5fdd3d-8e00-4913-ad7d-efb4d535323a.3DTool`, has a `csw` and no `mcs`
at all — the incomplete case this repo's `geometry_store.py` already handles.
This repo's snapshot reflects all of it faithfully: 223 tools across 7 libraries,
10 joint frames keyed by geometry id, 1 standalone block, 4 tools with a nested
block.

---

## What is missing

Stated as plainly as possible, the model is missing three things, in increasing
order of difficulty.

**A seat index.** Nothing anywhere identifies *which* seat of a block a tool
occupies. `numberOfTools` says how many exist; no field says which one you are
looking at. The nearest available discriminator is
`tool-block.post-process.stationNumber` plus `halfIndex`, and as discussed those
are turret coordinates, not block-local ones — and they are 0 in all real data.

**A per-seat frame.** Even given an index, there is nowhere to put the frame that
seat sits at. `ToolASMGeometry` has two matrices; the `.3DTool` header has two
keys; `ToolJointType` has three unindexed values. A three-seat block needs one
MCS and three CSWs, or three MCS/CSW pairs, and no layer of the stack can hold
them.

**A containment relation.** `NestedItemGeometryData` has no member for
occupants. A block record cannot reference the tools sitting in it, so the tree
the design draws cannot be read out of the library — it can only be inferred.

---

## What Fusion would have to emit

Four layers would have to change, and they are not independent — each one is
load-bearing for the one above.

**1. STEP authoring convention and the importer.** This is the deepest change,
and the one most likely to be underestimated. The importer recognises exactly two
coordinate-system labels and silently drops everything else:

```113:125:/Users/jasongardner/Cursor/client-delivery/Make/IronLib/ToolImport/ToolSTEPImport/ToolSTEPProducer.cpp
void ToolSTEPProducer::handleCoordinateSystem(const ICoordSys& coordinateSystem)
{
    std::string geometryLabel = getLabel(coordinateSystem);
    // Some STEP files contain lots of unlabeled coordinate systems which are useless to us, so
    // don't bother processing these.
    if (geometryLabel != "CSW" && geometryLabel != "MCS")
    {
        return;
    }

    CoordinateSystem coords{coordinateSystem.Id(), geometryLabel};
    m_partCoordinateSystems[m_currentPart].emplace_back(std::move(coords));
}
```

A vendor authoring `CSW_1`, `CSW_2`, `CSW_3` today would produce a solid with no
frames at all. And even if the labels matched, the lookup returns on first match
and discards the rest — `getCoordinateSystem` loops the vector and does
`return coordinateSystem.id;` inside the match (`ToolSTEPProducer.cpp:89-101`),
with a return type of `std::optional<ObjectId>`. Part grouping is equally closed:
only `CUT`, `NOCUT` and `NO_CUT` are recognised as part labels
(`:107`). So Fusion would need an agreed per-seat labelling convention, a relaxed
label filter, and getters returning a keyed collection rather than an optional.

**2. The `.3DTool` container.** `ToolASMGeometry`'s two `Matrix4x4` members and
its `make(...)` signature would both have to become collections, and the JSON
header schema would have to change from scalar `mcs`/`csw` to something indexed —
either arrays or per-seat keys. That is a file-format version bump for every
stored solid, with a migration path for the existing scalar form.

**3. The library JSON.** Two sub-changes. `numberOfTools` needs to actually be
populated by an authoring path — it is written by every serialiser but no real
source on this machine ever sets it above 1. And a seat index needs to exist:
either a new field on the tool's nested `tool-block.post-process` (a
`slotIndex`/`attachmentPointIndex` distinct from `stationNumber`), or a genuine
occupant collection on the block record. The first is a small additive change and
preserves the tool-owns-block direction; the second is the real schema change.

**4. The public API.** `ToolJointType` would need an index parameter on
`setJointOrigin`, and `setJointOrigin` would need to stop being a stub. Today
neither the read path nor the write path can address a seat.

For the prototype's purposes only the third item matters, and only its first
half. That is what makes the fake cheap.

---

## Are the design's slots attachment points, or turret stations?

My judgement: **the design means block attachment points, but the only per-seat
identity Fusion actually has is a turret station — so a hierarchy built on real
data today would be turret stations wearing a block's clothes.** The distinction
matters, and here is the evidence on both sides.

**Turret stations are a fully modelled, fully populated concept — in the machine
model, not the tool library.** `TurretDefinition` is explicit about the
multiplicity:

```18:26:/Users/jasongardner/Cursor/client-delivery/Make/IronLib/machine/machine/TurretDefinition.h
/**
 * Class that contains the setup for a turret on a machine. A turret can hold multiple tools and
 * will change tools by rotating about an axis.
 */
class IRON_MACHINE_API machine::TurretDefinition
{
  public:
    /// Constructor
    explicit TurretDefinition(unsigned indexCount);
```

and its private comment ties stations to attach frames and to half-indexing:
*"[t]his should in most cases be equal or larger than the number of station
attach frames, since each station should be indexable but there may be 'half
index' positions between each station"* (`:61-66`).

Each station is a distinct part node with its own frame. MachineBuilder
classifies a part as a turret station precisely when it is a `HEAD` whose parent
carries a turret definition
(`Make/NeuCAM/Server/MachineBuilder/Utils/MachineBuilderUtils.cpp:560-565`, with
the enum at `MachineBuilderUtils.h:45`), and there is dedicated UI for it in
`Make/NeuCAM/UI/MachineBuilderUI/Inputs/ModelTreeRow.cpp`.

And there is real data. `~/Library/Application Support/Autodesk/CAM360/machines/New Folder/Generic dual spindle Y axis lathe with live tooling.mch`
contains a rotary part `turret_0` named "Turret" with `"turret": {"index_count": 24}`
and **twelve** `head` children, `turret_0_station_1` through
`turret_0_station_12`, each with its own `attach_frame`. That is exactly the
structure the design draws — a parent owning N indexed children, each with its
own coordinate frame — sitting one layer away, populated, in the machine model.

**Block seats are a real concept too, but only as a count.**
`numberOfToolAttachmentPoints` is documented as the number of tools attachable to
the adaptive item, and Fusion's fixtures set it to 2 and 3. A twin- or
triple-seat bolt-on block that presents several tool positions at a *single*
turret station is a real thing in the world and a real number in the schema.

**The two are conflated in the only place it matters.** A block occupies one
turret station; its seats are block-local. But the schema gives a block's
occupants no block-local address — the only per-occupant fields on the nested
`tool-block` are `post-process.stationNumber` and `post-process.halfIndex`, which
are turret coordinates. `halfIndex` is the tell: it is the same half-index
concept `TurretDefinition` describes as positions *between* turret stations. Its
presence on a tool block's post-process data means those fields exist to say
where the block sits in the turret, not where a tool sits in the block.

So: the design's Slot 1/2/3 are not turret stations conceptually — if they were,
the parent row would be the turret, not a tool block. But there is no block-local
seat address to bind them to, and the field that would come closest,
`stationNumber`, is a turret index that reads 0 on every real record. Anyone
building the hierarchy on real data will end up grouping rows by station number,
and should say so in the UI rather than inventing a "Slot N" ordinal that has no
counterpart in the file.

There is also a design consequence worth surfacing. If the parent row is a block
at one station, the up/down arrows in the bottom toolbar have no meaning —
order in an assembly is fixed by the joint chain, as this repo's README already
argues, and seats within a block are addressed, not ordered. If instead the
parent is understood as a turret and the rows are stations, then reordering means
re-indexing a machine, which is a different and much larger command.

---

## Is the ownership inversion reconcilable?

Yes, and without a schema change — for a read-mostly UI. The proof already
exists in the Fusion tree.

`client-delivery/Make/Data/ToolAssembly/` is a prototype of the manufacturing
Tool Assembly dialog: a web bundle hosted in a Qt shell, on branch
`gardnej/tool-assembly`. Its opening comment names the problem and the fix:

```8:12:/Users/jasongardner/Cursor/client-delivery/Make/Data/ToolAssembly/toolassembly.js
"Model C": Fusion's schema makes a cutting TOOL own its tool block as nested
geometry and expresses position through post-process.stationNumber. The page
keeps the slot-based UX but every slot row is a view over one real tool, the
parent tool-block row is derived from the tools' embedded "tool-block" objects,
and what is saved is per-tool (key + station).
```

Three mechanics implement it, and all three are directly portable:

- **Slot count comes from `numberOfTools`.** `state.toolBlock.numberOfTools` is
  3 in that prototype and `syncSlotCount()` grows and truncates the row list to
  match (`toolassembly.js:207-224`). The state comment is honest about its status:
  *"Mock tool block, used as the parent row only until real tools supply one."*
- **The parent row is derived, not stored.** `derivedBlocks()` walks the filled
  slots, reads each tool's embedded `tool-block`, and groups them by `guid`
  (falling back to description), producing the parent rows the current tools
  imply (`:316-331`). `renderDerivedBlockProps()` then shows the block's real
  properties read-only — including both counts side by side, `"Attachment points"`
  and `"Number of tools"` (`:854-855`) — plus the rotation and translation
  overrides when a `transformOverride` is present (`:859-863`).
- **What is saved is per-tool.** `collectResult()` emits a flat list of
  `{key, stationNumber, halfIndex}` (`:433-445`). Nothing block-shaped is
  written, so nothing needs a schema that does not exist.

The inversion is therefore a *presentation* problem, not a storage one, as long
as the dialogue's job is to choose tools and their stations. It becomes a genuine
schema change only if the block must own state that no tool can carry — a
per-seat frame, a seat that is deliberately empty and must stay empty, or an
assembly identity that outlives its occupants. Those are the three things to
watch for as the design develops; each one crosses the line from Model C into
needing Fusion to emit new structure.

---

## Recommendation

**Prototype the hierarchy now, on real records, with exactly one faked field.**

Set `numberOfTools` on the block to 3 and let the row count follow from it.
That is not inventing a field: it exists in the schema, it is documented as the
number of tools attachable to the item, it round-trips through JSON, CSV and XML,
Fusion's own test fixtures carry 2 and 3, and Fusion's own prototype already
displays it. The fake is populating a real field, which is the cheapest kind —
when authoring catches up, the fake is deleted and nothing else moves.

Derive everything else from the snapshot the way Model C does: parent row from
the tools' embedded `tool-block` objects grouped by `guid`, slot rows as views
over real tools, and a save payload that is per-tool. This repo's snapshot has
four tools with a nested block, all pointing at the same block geometry, which is
exactly the input that exercise needs.

Three things should *not* be faked, because faking them teaches the wrong lesson:

- **Per-slot gauge length.** Only one real block solid exists, and all four
  nested blocks carry a `transformOverride`, so any per-slot number would be
  wrong twice over. Show the per-slot readout in its unmeasurable state, naming
  the missing frame, exactly as the grid already does for the two-row case. A
  visibly empty readout is honest and still validates the layout.
- **Reordering.** The up/down arrows have no referent. Either leave them
  disabled with a tooltip explaining that order comes from the joint chain, or
  drop them from the prototype and raise the question in review.
- **Slot labels as invented ordinals.** If a row's occupant has a real
  `stationNumber`, show it. Where it is 0 or absent — which is all of the real
  data — say so rather than silently numbering rows 1, 2, 3. This is the one
  place the design and the schema genuinely disagree, and hiding it in the
  prototype removes the only chance to notice.

**Do not wait for real data.** Waiting means waiting on all four layers above:
a STEP labelling convention that does not exist, an importer that discards
anything but `MCS` and `CSW` and returns on first match, a `.3DTool` format with
two hardcoded matrices, an API enum with three unindexed values, and an
authoring pipeline that has never written `numberOfTools` above 1 anywhere on this
machine. That is not a data-availability wait, it is a schema-change wait, and the
prototype's job is partly to establish whether the change is worth asking for.

What the prototype should produce, alongside the UI, is the answer to one
question: does the design need per-seat *frames*, or only per-seat *occupancy*?
Occupancy is Model C and needs nothing new. Frames need every layer in the
"What Fusion would have to emit" section. Everything expensive hangs off that
distinction, so it is the thing worth being sure about before anyone asks Fusion
to emit anything.
