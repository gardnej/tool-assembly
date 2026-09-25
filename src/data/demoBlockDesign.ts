/**
 * Design context for the AU Part CAM prototype: browser mirrors Fusion CAM tree (Setups / OP 10 /
 * OP 20). Recognized-body features stay in Feature Manager rows only; CAM ops here link back via
 * linkedFeatureRowId for demo sync. Replace with Fusion/Manufacturing export JSON when wired.
 */

import type { FeatureRow, MachiningFlag } from "./featureManagerTypes";
import { SETUP_OPTIONS } from "./featureManagerTypes";

/** Matches Fusion CAM browser root label for this prototype part. */
export const DEMO_BLOCK_DOCUMENT_TITLE = "AU Part 2023";

/**
 * What a node is, which decides its icon. The names follow the resource folders
 * `scripts/build-browser-icons.py` copies the artwork from.
 */
export type BrowserNodeKind =
  | "document"
  | "component"
  | "folder"
  | "camFolder"
  | "units"
  | "namedView"
  | "point"
  | "axis"
  | "plane"
  | "body"
  | "setup"
  | "stock"
  | "setupModel"
  | "opFace"
  | "opRough"
  | "opFinish"
  | "opGroove"
  | "opThread"
  | "opTrace"
  | "opToolCall"
  | "opAdaptive"
  | "opMill"
  | "opDrill"
  | "opInspect";

export type DemoBlockBrowserNode = {
  id: string;
  label: string;
  kind: BrowserNodeKind;
  /** Default: true */
  selectable?: boolean;
  defaultExpanded?: boolean;
  /** Units carries no show/hide control in Fusion; everything else does. */
  noVisibility?: boolean;
  /**
   * Node starts hidden in the canvas (eye shows "hidden"), toggleable on. Used
   * for the machine/turret so the turret geometry is off by default until the
   * user turns it on from the browser. Default: false (visible).
   */
  defaultHidden?: boolean;
  /** When set, selecting this row syncs Feature Manager to this feature id */
  linkedFeatureRowId?: string;
  children?: DemoBlockBrowserNode[];
};

/**
 * The Manufacture browser as the product builds it: Units, Named Views, Origin,
 * Analysis, the linked design model, then the CAM collections, of which Setups
 * is the only one always present. Origin children are named as Fusion names
 * them — single letters, not "X Axis" — and the home view is "HOME".
 */
export const DEMO_BLOCK_BROWSER_ROOT: DemoBlockBrowserNode = {
  id: "design-root",
  label: DEMO_BLOCK_DOCUMENT_TITLE,
  kind: "document",
  selectable: false,
  defaultExpanded: true,
  children: [
    { id: "cam-units", label: "Units: mm", kind: "units", selectable: false, noVisibility: true },
    {
      id: "cam-named-views",
      label: "Named Views",
      kind: "folder",
      selectable: false,
      children: [{ id: "cam-nv-home", label: "HOME", kind: "namedView", selectable: false }],
    },
    {
      id: "cam-origin",
      label: "Origin",
      kind: "folder",
      selectable: false,
      children: [
        { id: "origin-o", label: "O", kind: "point" },
        { id: "origin-x", label: "X", kind: "axis" },
        { id: "origin-y", label: "Y", kind: "axis" },
        { id: "origin-z", label: "Z", kind: "axis" },
        { id: "origin-xy", label: "XY", kind: "plane" },
        { id: "origin-xz", label: "XZ", kind: "plane" },
        { id: "origin-yz", label: "YZ", kind: "plane" },
      ],
    },
    { id: "cam-analysis", label: "Analysis", kind: "folder", selectable: false },
    {
      id: "cam-model",
      label: DEMO_BLOCK_DOCUMENT_TITLE,
      kind: "component",
      selectable: false,
      children: [
        {
          id: "cam-bodies",
          label: "Bodies",
          kind: "folder",
          selectable: false,
          children: [{ id: "body1", label: "Body1", kind: "body" }],
        },
      ],
    },
    {
      id: "cam-setups",
      label: "Setups",
      kind: "setup",
      selectable: false,
      defaultExpanded: true,
      children: [
        {
          id: "cam-op10",
          label: "[(0:12:26)] OP 10",
          kind: "setup",
          selectable: false,
          children: [
            { id: "cam-op10-stock", label: "Stock", kind: "stock", selectable: false },
            {
              id: "cam-op10-model",
              label: "Setup Model",
              kind: "setupModel",
              selectable: false,
            },
            {
              id: "cam-op10-op01",
              label: "[T1 (0:00:17)] Face Rough (Rough OD — P clamp)",
              kind: "opFace",
              linkedFeatureRowId: "p1",
            },
            {
              id: "cam-op10-op02",
              label: "[T1 (0:02:47)] OD Rough (Rough OD — P clamp)",
              kind: "opRough",
            },
            {
              id: "cam-op10-op03",
              label: "[T11 (0:00:13)] Groove Front Rough (4mm wide)",
              kind: "opGroove",
              linkedFeatureRowId: "g1",
            },
            {
              id: "cam-op10-op04",
              label: "[T4 (0:01:46)] Adaptive Roughing1 (OD groove)",
              kind: "opAdaptive",
              linkedFeatureRowId: "s1",
            },
            {
              id: "cam-op10-op05",
              label: "[T7 (0:00:12)] Drill 22mm c/line (22 mm)",
              kind: "opDrill",
              linkedFeatureRowId: "h1",
            },
            {
              id: "cam-op10-op06",
              label: "[T10 (0:00:35)] Mill Hex Rough (12mm flat)",
              kind: "opMill",
              linkedFeatureRowId: "s2",
            },
            {
              id: "cam-op10-op07",
              label: "[T10 (0:00:27)] Mill Hex Finish (12mm flat)",
              kind: "opMill",
              linkedFeatureRowId: "p2",
            },
            {
              id: "cam-op10-op08",
              label: "[T2 (0:00:06)] Face Finish (Finishing — P clamp)",
              kind: "opFace",
            },
            {
              id: "cam-op10-op09",
              label: "[T2 (0:00:47)] OD Finish (Finishing — P clamp)",
              kind: "opFinish",
              linkedFeatureRowId: "sh1",
            },
            {
              id: "cam-op10-op10",
              label: "[T11 (0:00:10)] OD Finish Groove (4mm wide)",
              kind: "opGroove",
            },
            {
              id: "cam-op10-op11",
              label: "[T6 (0:00:31)] Face Drill × 6 C axis (5mm)",
              kind: "opDrill",
              linkedFeatureRowId: "h2",
            },
            {
              id: "cam-op10-op12",
              label: "[T5 (0:00:22)] ID Rough (16mm rough boring)",
              kind: "opRough",
              linkedFeatureRowId: "h3",
            },
            {
              id: "cam-op10-op13",
              label: "[T8 (0:00:10)] ID U/Cut Rough (20mm boring)",
              kind: "opRough",
            },
            {
              id: "cam-op10-op14",
              label: "[T8 (0:00:19)] ID Finish (20mm boring bar)",
              kind: "opFinish",
            },
            {
              id: "cam-op10-op15",
              label: "[T9 (0:00:08)] INT Thread (metric)",
              kind: "opThread",
              linkedFeatureRowId: "t1",
            },
            {
              id: "cam-op10-op16",
              label: "[T10 (0:00:27)] Deburr Hex (12mm flat)",
              kind: "opMill",
            },
            {
              id: "cam-op10-op17",
              label: "[T7 (0:00:00)] Tool Call1 (22 mm)",
              kind: "opToolCall",
            },
            {
              id: "cam-op10-manual-insp",
              label: "Manual Inspections2",
              kind: "camFolder",
              selectable: false,
              children: [
                {
                  id: "cam-op10-insp-item",
                  label: "Inspection · pending",
                  kind: "opInspect",
                  selectable: false,
                },
              ],
            },
          ],
        },
        {
          id: "cam-op20",
          label: "OP 20",
          kind: "setup",
          selectable: false,
          children: [
            { id: "cam-op20-stock", label: "Stock", kind: "stock", selectable: false },
            {
              id: "cam-op20-model",
              label: "Setup Model",
              kind: "setupModel",
              selectable: false,
            },
            {
              id: "cam-op20-op01",
              label: "[T8] Profile Roughing6 (20mm boring bar)",
              kind: "opRough",
            },
            {
              id: "cam-op20-op02",
              label: "[T1 (0:00:27)] Face (Sub — roughing steel)",
              kind: "opFace",
            },
            {
              id: "cam-op20-op03",
              label: "[T1 (0:01:30)] OD Rough Sub (Sub — roughing)",
              kind: "opRough",
            },
            {
              id: "cam-op20-op04",
              label: "[T12 (0:00:14)] OD SEMI Rough Sub (Sub — finish)",
              kind: "opRough",
            },
            {
              id: "cam-op20-op05",
              label: "[T12 (0:00:17)] Face Finish (Sub — finishing)",
              kind: "opFace",
            },
            {
              id: "cam-op20-op06",
              label: "[T12 (0:00:24)] OD Finish (Sub — finishing steel)",
              kind: "opFinish",
            },
            {
              id: "cam-op20-op07",
              label: "[T3 (0:00:09)] EXT Thread (SUB ext thread)",
              kind: "opThread",
              linkedFeatureRowId: "t2",
            },
            {
              id: "cam-op20-op08",
              label: "[T12 (0:00:05)] Profile Finishing3 (2) (Sub)",
              kind: "opFinish",
            },
            {
              id: "cam-op20-op09",
              label: "[T12 (0:00:10)] Profile Finishing3 (3) (Sub)",
              kind: "opFinish",
            },
            {
              id: "cam-op20-op10",
              label: "[T12] Profile Roughing7 (Sub — finishing steel)",
              kind: "opRough",
            },
            {
              id: "cam-op20-op11",
              label: "[T10 (0:00:25)] Trace1 (12mm flat)",
              kind: "opTrace",
            },
            {
              id: "cam-op20-op12",
              label: "[T1 (0:01:14)] Profile Roughing9 (Rough OD)",
              kind: "opRough",
            },
            {
              id: "cam-op20-op13",
              label: "[T1 (0:01:12)] Profile Roughing13 (Rough OD)",
              kind: "opRough",
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Browser id PREFIX for turret-setup nodes. Each saved turret setup renders its
 * own node under the machine, id = `cam-turret:<setupId>`, so multiple setups
 * can coexist in the tree (see `turretNodeId`). The bare value is kept for
 * backwards-compatible checks.
 */
export const TURRET_BROWSER_NODE_ID = "cam-turret";
/** Browser id PREFIX for machine nodes (one per turret setup). */
export const MACHINE_BROWSER_NODE_ID = "cam-machine";
/** Browser id PREFIX for turret-authored OP Setup nodes. */
export const OP_SETUP_BROWSER_NODE_ID = "cam-op";

/** Browser node id for a specific turret setup (one node per saved setup). */
export function turretNodeId(setupId: string): string {
  return `${TURRET_BROWSER_NODE_ID}:${setupId}`;
}

/** True for the turret node prefix or any per-setup turret node. */
export function isTurretNode(nodeId: string): boolean {
  return nodeId === TURRET_BROWSER_NODE_ID || nodeId.startsWith(`${TURRET_BROWSER_NODE_ID}:`);
}

/** The setup id carried by a per-setup turret node, or null for the bare id. */
export function setupIdFromTurretNode(nodeId: string): string | null {
  const prefix = `${TURRET_BROWSER_NODE_ID}:`;
  return nodeId.startsWith(prefix) ? nodeId.slice(prefix.length) : null;
}

/** Browser node id for the machine nested under a given turret setup. */
export function machineNodeId(setupId: string): string {
  return `${MACHINE_BROWSER_NODE_ID}:${setupId}`;
}

/** True for the machine node prefix or any per-setup machine node. */
export function isMachineNode(nodeId: string): boolean {
  return (
    nodeId === MACHINE_BROWSER_NODE_ID || nodeId.startsWith(`${MACHINE_BROWSER_NODE_ID}:`)
  );
}

/** The setup id carried by a per-setup machine node, or null for the bare id. */
export function setupIdFromMachineNode(nodeId: string): string | null {
  const prefix = `${MACHINE_BROWSER_NODE_ID}:`;
  return nodeId.startsWith(prefix) ? nodeId.slice(prefix.length) : null;
}

/** Browser node id for a turret-authored OP Setup (top-level, per setup). */
export function opSetupNodeId(setupId: string): string {
  return `${OP_SETUP_BROWSER_NODE_ID}:${setupId}`;
}

/** The existing OP-10 Setup node the seeded turret is pinned under. */
const OP10_BROWSER_NODE_ID = "cam-op10";
/** The Setups folder new OP Setup nodes are appended to. */
const SETUPS_FOLDER_NODE_ID = "cam-setups";

/** One turret setup as the browser needs it: id, display name and OP number. */
export type BrowserTurretSetup = { id: string; name: string; opNumber: number };

/**
 * The machine → turret subtree Fusion pins inside a manufacturing Setup. The
 * machine and its single turret start hidden in the canvas; the user toggles
 * them on from the eye control. Ids are keyed by setup so multiple Setups can
 * coexist, each owning exactly one turret.
 */
function machineSubtree(
  machineName: string,
  turret: BrowserTurretSetup,
): DemoBlockBrowserNode {
  return {
    id: machineNodeId(turret.id),
    label: machineName,
    kind: "component",
    selectable: true,
    defaultExpanded: true,
    // Machine (and its turret) start hidden; the user toggles visibility on.
    defaultHidden: true,
    children: [
      {
        id: turretNodeId(turret.id),
        label: turret.name,
        kind: "body",
        selectable: true,
        // Turret geometry is off in the canvas until toggled on here.
        defaultHidden: true,
      },
    ],
  };
}

/**
 * The document tree with each turret setup rendered as a manufacturing Setup.
 *
 * The seeded turret (OP 10) is pinned inside the existing OP 10 node, matching
 * how Fusion nests a machine under the Setup that runs on it. Every other
 * turret setup becomes its OWN top-level Setup node (OP 30, OP 40, …), a
 * sibling of OP 10 / OP 20 under the Setups folder, carrying its own machine →
 * turret subtree (one turret per Setup) plus Stock / Setup Model to mirror the
 * demo Setups. Node ids are stable so right-clicking a turret enters Turret
 * Setup for that Setup.
 */
export function browserRootWithTurret(
  machineName: string,
  turrets: BrowserTurretSetup[],
  root: DemoBlockBrowserNode = DEMO_BLOCK_BROWSER_ROOT,
): DemoBlockBrowserNode {
  // OP 10 hosts the seeded turret; everything else is a fresh top-level Setup.
  const op10Turret = turrets.find((t) => t.opNumber <= 10);
  const newSetups = turrets.filter((t) => t !== op10Turret);

  const newOpNodes: DemoBlockBrowserNode[] = newSetups.map((turret) => {
    const opId = opSetupNodeId(turret.id);
    return {
      id: opId,
      label: `OP ${turret.opNumber}`,
      kind: "setup",
      selectable: false,
      defaultExpanded: true,
      children: [
        { id: `${opId}-stock`, label: "Stock", kind: "stock", selectable: false },
        { id: `${opId}-model`, label: "Setup Model", kind: "setupModel", selectable: false },
        machineSubtree(machineName, turret),
      ],
    };
  });

  const nest = (node: DemoBlockBrowserNode): DemoBlockBrowserNode => {
    // Pin the seeded machine + turret as the first child of OP 10.
    if (node.id === OP10_BROWSER_NODE_ID && op10Turret !== undefined) {
      return {
        ...node,
        defaultExpanded: true,
        children: [machineSubtree(machineName, op10Turret), ...(node.children ?? [])],
      };
    }
    // Append the turret-authored Setups as siblings of OP 10 / OP 20.
    if (node.id === SETUPS_FOLDER_NODE_ID) {
      return {
        ...node,
        defaultExpanded: true,
        children: [...(node.children ?? []).map(nest), ...newOpNodes],
      };
    }
    if (node.children === undefined) return node;
    return { ...node, children: node.children.map(nest) };
  };

  return nest(root);
}

function collectPropertyLabels(
  node: DemoBlockBrowserNode,
  acc: Record<string, string>,
): Record<string, string> {
  acc[node.id] = node.label;
  if (node.children !== undefined) {
    for (const c of node.children) {
      collectPropertyLabels(c, acc);
    }
  }
  return acc;
}

export const DEMO_BLOCK_PROPERTY_LABELS = collectPropertyLabels(DEMO_BLOCK_BROWSER_ROOT, {});

/** Reverse map: Feature Manager row id → CAM browser operation row (table ↔ tree sync). */
export const FEATURE_ROW_TO_BROWSER_ID: Record<string, string> = {
  g1: "cam-op10-op03",
  h1: "cam-op10-op05",
  h2: "cam-op10-op11",
  h3: "cam-op10-op12",
  s1: "cam-op10-op04",
  s2: "cam-op10-op06",
  p1: "cam-op10-op01",
  p2: "cam-op10-op07",
  sh1: "cam-op10-op09",
  t1: "cam-op10-op15",
  t2: "cam-op20-op07",
};

export const DEMO_BLOCK_FEATURE_ROWS: FeatureRow[] = [
  {
    id: "h1",
    kind: "hole",
    diameterSide: "ID",
    name: "Counterbore Ø12 — top face",
    sameTypeCount: 6,
    camOrdinal: 1,
    status: "warning",
    orientation: "0°, 90°",
    flags: new Set<MachiningFlag>(["machined", "issues"]),
    unmatched: false,
    defaultTemplate: "Template Name",
    defaultSetup: SETUP_OPTIONS[1],
  },
  {
    id: "h2",
    kind: "hole",
    diameterSide: "ID",
    name: "Through Ø6 — wall",
    sameTypeCount: 14,
    camOrdinal: 2,
    status: "ok",
    orientation: "0°, 0°",
    flags: new Set<MachiningFlag>(["machined"]),
    unmatched: false,
    defaultTemplate: "Template Name",
    defaultSetup: SETUP_OPTIONS[1],
  },
  {
    id: "h3",
    kind: "hole",
    diameterSide: "ID",
    name: "Blind Ø8 — partition",
    sameTypeCount: 1,
    camOrdinal: 3,
    status: "error",
    orientation: "90°, 45°",
    flags: new Set<MachiningFlag>(["notMachined", "issues"]),
    unmatched: true,
    defaultTemplate: "Manual",
    defaultSetup: SETUP_OPTIONS[0],
  },
  {
    id: "s1",
    kind: "slot",
    diameterSide: "ID",
    name: "Linear slot 24×8 — floor",
    sameTypeCount: 3,
    camOrdinal: 1,
    status: "ok",
    orientation: "0°, 90°",
    flags: new Set<MachiningFlag>(["machined"]),
    unmatched: false,
    defaultTemplate: "Template Name",
    defaultSetup: SETUP_OPTIONS[1],
  },
  {
    id: "s2",
    kind: "slot",
    diameterSide: "ID",
    name: "T-slot segment — rail",
    sameTypeCount: 2,
    camOrdinal: 2,
    status: "warning",
    orientation: "0°, 45°",
    flags: new Set<MachiningFlag>(["machined"]),
    unmatched: true,
    defaultTemplate: "Manual",
    defaultSetup: SETUP_OPTIONS[2],
  },
  {
    id: "p1",
    kind: "pocket",
    diameterSide: "ID",
    name: "Rect pocket 48×24 — interior",
    sameTypeCount: 2,
    camOrdinal: 1,
    status: "ok",
    orientation: "0°, 90°",
    flags: new Set<MachiningFlag>(["machined", "userApproved"]),
    unmatched: false,
    defaultTemplate: "Create Operation",
    defaultSetup: SETUP_OPTIONS[1],
  },
  {
    id: "p2",
    kind: "pocket",
    diameterSide: "ID",
    name: "Floor fillet pocket — corner",
    sameTypeCount: 4,
    camOrdinal: 2,
    status: "error",
    orientation: "0°, 180°",
    flags: new Set<MachiningFlag>(["issues"]),
    unmatched: false,
    defaultTemplate: "Manual",
    defaultSetup: SETUP_OPTIONS[0],
  },
  {
    id: "sh1",
    kind: "shoulder",
    diameterSide: "OD",
    name: "Step shoulder Ø40 — boss",
    sameTypeCount: 8,
    camOrdinal: 1,
    status: "ok",
    orientation: "0°, 90°",
    flags: new Set<MachiningFlag>(["machined"]),
    unmatched: false,
    defaultTemplate: "Create Operation",
    defaultSetup: SETUP_OPTIONS[1],
  },
  {
    id: "g1",
    kind: "groove",
    diameterSide: "OD",
    name: "Floor profile groove — 2D section",
    sameTypeCount: 1,
    camOrdinal: 1,
    status: "warning",
    orientation: "90°, 0°",
    flags: new Set<MachiningFlag>(["notMachined"]),
    unmatched: false,
    defaultTemplate: "Manual",
    defaultSetup: SETUP_OPTIONS[2],
  },
  {
    id: "t1",
    kind: "thread",
    diameterSide: "ID",
    name: "M6 × 1.0 — clearance",
    sameTypeCount: 2,
    camOrdinal: 1,
    status: "ok",
    orientation: "0°, 0°",
    flags: new Set<MachiningFlag>(["machined"]),
    unmatched: false,
    defaultTemplate: "Create Operation",
    defaultSetup: SETUP_OPTIONS[1],
  },
  {
    id: "t2",
    kind: "thread",
    diameterSide: "ID",
    name: "M8 × 1.25 blind — mount",
    sameTypeCount: 6,
    camOrdinal: 2,
    status: "error",
    orientation: "0°, 270°",
    flags: new Set<MachiningFlag>(["issues", "notMachined"]),
    unmatched: true,
    defaultTemplate: "Manual",
    defaultSetup: SETUP_OPTIONS[0],
  },
];

const rowById = Object.fromEntries(DEMO_BLOCK_FEATURE_ROWS.map((r) => [r.id, r])) as Record<
  string,
  FeatureRow
>;

export function getDemoBlockFeatureRow(id: string): FeatureRow | undefined {
  return rowById[id];
}

export function getViewportEmphasis(
  browserId: string,
  pinnedFeatureRowId: string | null,
): { subtitle: string; blockClass: string } {
  if (pinnedFeatureRowId !== null && pinnedFeatureRowId !== "") {
    const row = getDemoBlockFeatureRow(pinnedFeatureRowId);
    if (row !== undefined) {
      return {
        subtitle: `Highlight · ${row.kind} · ${row.name}`,
        blockClass: `viewport__block--emph-${row.kind}`,
      };
    }
  }
  if (browserId === "body1") {
    return {
      subtitle: `Solid · Body1 — ${DEMO_BLOCK_DOCUMENT_TITLE}`,
      blockClass: "viewport__block--emph-body",
    };
  }
  return {
    subtitle: `Selection · ${DEMO_BLOCK_PROPERTY_LABELS[browserId] ?? browserId}`,
    blockClass: "",
  };
}
