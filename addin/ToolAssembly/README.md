# Tool Assembly add-in

A Fusion add-in that builds tool assemblies against the real tool library
framework: it reads and writes the same libraries the Tool Library dialog shows,
with no mock data.

## Install

```bash
./scripts/install-addin.sh          # symlink, so edits are picked up in place
./scripts/install-addin.sh --copy   # copy instead, if Fusion won't load a link
./scripts/install-addin.sh --remove
```

Then in Fusion: switch to the Manufacture workspace, open **Utilities > Add-Ins >
Scripts and Add-Ins** (Shift+S), select **ToolAssembly** and click **Run**. The
command appears as **Build Tool Assembly**.

After editing the source, stop and re-run the add-in; it clears its own modules
on stop so the new code is picked up.

## Tests

The joint maths and the library parsing run without Fusion, against stubbed
`adsk` modules:

```bash
python3 -m unittest discover -s addin/ToolAssembly/tests
```

## How Fusion actually models a tool assembly

Worth reading before changing anything here, because two details are surprising.

A **tool block** is a first-class library item type (`"type": "tool block"`),
and a cutting tool carries its block *inline* under a `tool-block` key. The tool
owns the block; a block does not own a list of child tools. Turret placement sits
in `post-process` as `stationNumber`, `halfIndex`, `live` and
`maximumRotationalSpeed`.

Components are joined at **joint origins**, following ISO-13399:

| Frame | Meaning |
| --- | --- |
| `MCS` | Mounting coordinate system, the machine-side face |
| `CSW` | Workpiece-side coordinate system, the cutting-side face |
| `THWCS` | Tool holder coordinate system |

An assembly is a chain from the machine datum to the cutting edge, where each
component's machine-side frame is seated on its predecessor's cutting-side frame.
`joints.py` implements that composition, and the real stack-up (the true gauge
length) is the distance from the datum to the last cutting-side frame — not a sum
of nominal component lengths.

### Joint origins cannot be written through the API

`AssemblyComponentGeometry.setJointOrigin` looks available in the Python and
TypeScript APIs, but the implementation is a stub that always raises:

> setJointOrigin() is not yet implemented. Please set joint origins in your STEP
> file and use use_joints=true in setGeometry().

So this add-in never calls it. Joint frames have to be authored into the STEP
file as coordinate systems labelled exactly `MCS` and `CSW`; the importer ignores
unlabelled ones, and groups them by parts labelled `CUT` and `NOCUT`, taking the
machine-side frame from the non-cut part. `step_inspect.py` checks a STEP file for
those labels up front, since a missing one is the usual reason an assembly does
not come together.

Note also that `isValidGeometry` reports only whether a solid is attached. Its
docstring claims both end joints are required, but the shipping implementation
returns `geometry != nullptr`, so it is not a joint check.

### Where the joint frames really live

Once a STEP file is imported, Fusion stores the extracted frames next to the
library in a `.3DTool` file: a small JSON header followed by an ASM binary body.

```json
{"csw": [[1,0,0,63],[0,1,-0,0],[0,0,1,-80],[0,0,0,1]],
 "geometryFileName": "EWS_163950_DIN4003.stp",
 "mcs": [[1,0,0,0],[0,1,-0,0],[0,0,1,0],[0,0,0,1]]}
```

`geometry_store.py` reads those headers, which is the only way to get at real
joint origins. It is how the dialog reports a measured stack-up rather than a
nominal one.

### Manual placement wins over the joint chain

Fusion's own UI positions a nested block with `3DGeometry.transformOverride`
(`userTransformOverride` internally): Euler XYZ rotation plus translation. When
present it overrides the joint chain, and it is not exposed in the public API, so
it can only be set through the UI or by editing library JSON directly. The dialog
reports it when a tool has one, so a measured stack-up that disagrees with what
is on screen has a visible explanation.

## Layout

| File | Role |
| --- | --- |
| `ToolAssembly.py` | Add-in entry point (`run`/`stop`) |
| `toolassembly/joints.py` | Rigid-transform maths; no Fusion imports, fully tested |
| `toolassembly/library_access.py` | Real `ToolLibraries` access and library JSON fields |
| `toolassembly/geometry_store.py` | Reads `mcs`/`csw` frames from `.3DTool` files |
| `toolassembly/step_inspect.py` | Pre-flight check for `MCS`/`CSW`/`CUT`/`NOCUT` labels |
| `toolassembly/assembly.py` | Applies solids to library items, builds the plan |
| `toolassembly/command.py` | The Manufacture workspace dialog |
