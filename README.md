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

Three consequences of following the real model, each visible in the dialogue:

**A tool owns its block.** There is no tree of parent and child slots. The
assembly is a cutting tool plus the one block nested inside it, which is why the
grid has exactly two component rows.

**Order is fixed by the joints.** Components run machine side to cutting side,
seated frame to frame, so there is nothing to reorder by hand and no up/down
arrows.

**Gauge length is measured, not summed.** The stack-up comes from composing the
MCS and CSW frames, so it accounts for frames that are rotated or off-axis. A
component missing a frame makes the chain unmeasurable, and the grid says which
frame is missing rather than quietly showing a wrong number.

Joint frames are authored in the STEP file as coordinate systems labelled `MCS`
and `CSW`; they cannot be set through the API. The add-in README explains why.

## Structure

| Path | Role |
| --- | --- |
| `src/data/joints.ts` | Rigid-transform maths; a port of the add-in's `joints.py` |
| `src/data/realLibrary.ts` | Typed access to the snapshot, joint frames, stack-up |
| `src/data/realLibrarySnapshot.json` | Generated; do not edit by hand |
| `src/hooks/useToolAssemblyWorkflow.ts` | Dialogue state (local React state only) |
| `src/components/` | Fusion shell, assembly grid, library browser, panels |
| `scripts/export-library-snapshot.py` | Snapshot exporter |
| `tests/` | Node test-runner suites, bundled with esbuild |

The joint maths exists twice, in TypeScript and in Python, deliberately: the
prototype needs it in the browser and the add-in needs it in Fusion. Both suites
assert the same numbers against the same real data, so they cannot drift
silently.
