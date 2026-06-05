/**
 * Design context for the AU Part CAM prototype: browser mirrors Fusion CAM tree (Setups / OP 10 /
 * OP 20). Recognized-body features stay in Feature Manager rows only; CAM ops here link back via
 * linkedFeatureRowId for demo sync. Replace with Fusion/Manufacturing export JSON when wired.
 */

import type { FeatureRow, MachiningFlag } from "./featureManagerTypes";
import { SETUP_OPTIONS } from "./featureManagerTypes";

/** Matches Fusion CAM browser root label for this prototype part. */
export const DEMO_BLOCK_DOCUMENT_TITLE = "AU Part 2023";

export type DemoBlockBrowserNode = {
  id: string;
  label: string;
  /** Default: true */
  selectable?: boolean;
  defaultExpanded?: boolean;
  /** When set, selecting this row syncs Feature Manager to this feature id */
  linkedFeatureRowId?: string;
  children?: DemoBlockBrowserNode[];
};

export const DEMO_BLOCK_BROWSER_ROOT: DemoBlockBrowserNode = {
  id: "design-root",
  label: DEMO_BLOCK_DOCUMENT_TITLE,
  selectable: false,
  defaultExpanded: true,
  children: [
    { id: "cam-units", label: "Units: mm", selectable: false },
    {
      id: "cam-named-views",
      label: "Named Views",
      selectable: false,
      defaultExpanded: false,
      children: [{ id: "cam-nv-home", label: "Home", selectable: false }],
    },
    {
      id: "cam-origin",
      label: "Origin",
      selectable: false,
      defaultExpanded: false,
      children: [
        { id: "origin-x", label: "X Axis" },
        { id: "origin-y", label: "Y Axis" },
        { id: "origin-z", label: "Z Axis" },
        { id: "origin-xy", label: "XY Plane" },
      ],
    },
    {
      id: "cam-analysis",
      label: "Analysis",
      selectable: false,
      defaultExpanded: false,
      children: [{ id: "cam-analysis-prepare", label: "Prepare", selectable: false }],
    },
    {
      id: "cam-models",
      label: "Models",
      selectable: false,
      defaultExpanded: false,
      children: [{ id: "body1", label: "Body1" }],
    },
    {
      id: "cam-setups",
      label: "Setups",
      selectable: false,
      defaultExpanded: false,
      children: [
        {
          id: "cam-op10",
          label: "[(0:12:26)] OP 10",
          selectable: false,
          defaultExpanded: false,
          children: [
            {
              id: "cam-op10-op01",
              label: "[T1 (0:00:17)] Face Rough (Rough OD — P clamp)",
              linkedFeatureRowId: "p1",
            },
            {
              id: "cam-op10-op02",
              label: "[T1 (0:02:47)] OD Rough (Rough OD — P clamp)",
            },
            {
              id: "cam-op10-op03",
              label: "[T11 (0:00:13)] Groove Front Rough (4mm wide)",
              linkedFeatureRowId: "g1",
            },
            {
              id: "cam-op10-op04",
              label: "[T4 (0:01:46)] Adaptive Roughing1 (OD groove)",
              linkedFeatureRowId: "s1",
            },
            {
              id: "cam-op10-op05",
              label: "[T7 (0:00:12)] Drill 22mm c/line (22 mm)",
              linkedFeatureRowId: "h1",
            },
            {
              id: "cam-op10-op06",
              label: "[T10 (0:00:35)] Mill Hex Rough (12mm flat)",
              linkedFeatureRowId: "s2",
            },
            {
              id: "cam-op10-op07",
              label: "[T10 (0:00:27)] Mill Hex Finish (12mm flat)",
              linkedFeatureRowId: "p2",
            },
            {
              id: "cam-op10-op08",
              label: "[T2 (0:00:06)] Face Finish (Finishing — P clamp)",
            },
            {
              id: "cam-op10-op09",
              label: "[T2 (0:00:47)] OD Finish (Finishing — P clamp)",
              linkedFeatureRowId: "sh1",
            },
            {
              id: "cam-op10-op10",
              label: "[T11 (0:00:10)] OD Finish Groove (4mm wide)",
            },
            {
              id: "cam-op10-op11",
              label: "[T6 (0:00:31)] Face Drill × 6 C axis (5mm)",
              linkedFeatureRowId: "h2",
            },
            {
              id: "cam-op10-op12",
              label: "[T5 (0:00:22)] ID Rough (16mm rough boring)",
              linkedFeatureRowId: "h3",
            },
            {
              id: "cam-op10-op13",
              label: "[T8 (0:00:10)] ID U/Cut Rough (20mm boring)",
            },
            {
              id: "cam-op10-op14",
              label: "[T8 (0:00:19)] ID Finish (20mm boring bar)",
            },
            {
              id: "cam-op10-op15",
              label: "[T9 (0:00:08)] INT Thread (metric)",
              linkedFeatureRowId: "t1",
            },
            {
              id: "cam-op10-op16",
              label: "[T10 (0:00:27)] Deburr Hex (12mm flat)",
            },
            {
              id: "cam-op10-op17",
              label: "[T7 (0:00:00)] Tool Call1 (22 mm)",
            },
            {
              id: "cam-op10-manual-insp",
              label: "Manual Inspections2",
              selectable: false,
              defaultExpanded: false,
              children: [{ id: "cam-op10-insp-item", label: "Inspection · pending", selectable: false }],
            },
          ],
        },
        {
          id: "cam-op20",
          label: "OP 20",
          selectable: false,
          defaultExpanded: false,
          children: [
            {
              id: "cam-op20-op01",
              label: "[T8] Profile Roughing6 (20mm boring bar)",
            },
            {
              id: "cam-op20-op02",
              label: "[T1 (0:00:27)] Face (Sub — roughing steel)",
            },
            {
              id: "cam-op20-op03",
              label: "[T1 (0:01:30)] OD Rough Sub (Sub — roughing)",
            },
            {
              id: "cam-op20-op04",
              label: "[T12 (0:00:14)] OD SEMI Rough Sub (Sub — finish)",
            },
            {
              id: "cam-op20-op05",
              label: "[T12 (0:00:17)] Face Finish (Sub — finishing)",
            },
            {
              id: "cam-op20-op06",
              label: "[T12 (0:00:24)] OD Finish (Sub — finishing steel)",
            },
            {
              id: "cam-op20-op07",
              label: "[T3 (0:00:09)] EXT Thread (SUB ext thread)",
              linkedFeatureRowId: "t2",
            },
            {
              id: "cam-op20-op08",
              label: "[T12 (0:00:05)] Profile Finishing3 (2) (Sub)",
            },
            {
              id: "cam-op20-op09",
              label: "[T12 (0:00:10)] Profile Finishing3 (3) (Sub)",
            },
            {
              id: "cam-op20-op10",
              label: "[T12] Profile Roughing7 (Sub — finishing steel)",
            },
            {
              id: "cam-op20-op11",
              label: "[T10 (0:00:25)] Trace1 (12mm flat)",
            },
            {
              id: "cam-op20-op12",
              label: "[T1 (0:01:14)] Profile Roughing9 (Rough OD)",
            },
            {
              id: "cam-op20-op13",
              label: "[T1 (0:01:12)] Profile Roughing13 (Rough OD)",
            },
          ],
        },
      ],
    },
  ],
};

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
