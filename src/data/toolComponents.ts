import type { ToolComponent } from "../types";

/** Placeholder catalog — future: Fusion Tool Library API / Autodesk HSM tool data service */
export const TOOL_CATALOG: ToolComponent[] = [
  {
    id: "holder-ews-222115",
    name: "12 - EWS_222115_DIN4003",
    category: "tool-holder",
    type: "Tool block",
    vendor: "EWS Tool Technologies",
    productId: "EWS-222115",
    stickOut: 42,
    totalLength: 57,
    compatibleWith: ["insert-cnmg-120408", "clamp-vdi-16", "screw-m4x12"],
    model: "01-0368 SDJ-ER16",
    connectionType: "ER16 MF",
    size: "16 mm",
    orientation: "axial",
  },
  {
    id: "holder-wnt-16",
    name: "WNT 16 DIN4003 Turning Block",
    category: "tool-holder",
    type: "Tool block",
    vendor: "WNT",
    productId: "WNT-16-DIN4003",
    stickOut: 38,
    totalLength: 52,
    compatibleWith: ["insert-cnmg-120408", "adapter-er16"],
    model: "WNT-16-STD",
    connectionType: "VDI 16",
    size: "16 mm",
    orientation: "radial",
  },
  {
    id: "insert-cnmg-120408",
    name: "CNMG 12 04 08 — Carbide Insert",
    category: "insert",
    type: "Insert",
    vendor: "Sandvik Coromant",
    productId: "CNMG-120408-PM",
    stickOut: 4,
    totalLength: 12,
    compatibleWith: ["holder-ews-222115", "holder-wnt-16", "clamp-vdi-16"],
    cuttingParameters: {
      surfaceSpeed: 220,
      feedPerRev: 0.25,
      depthOfCut: 2.0,
      material: "P15 — Steel",
    },
  },
  {
    id: "insert-dnmg-150608",
    name: "DNMG 15 06 08 — Carbide Insert",
    category: "insert",
    type: "Insert",
    vendor: "Iscar",
    productId: "DNMG-150608-TF",
    stickOut: 5,
    totalLength: 15,
    compatibleWith: ["holder-wnt-16"],
    cuttingParameters: {
      surfaceSpeed: 180,
      feedPerRev: 0.2,
      depthOfCut: 1.5,
      material: "M20 — Stainless",
    },
  },
  {
    id: "clamp-vdi-16",
    name: "VDI 16 Top Clamp",
    category: "clamp",
    type: "Clamp",
    vendor: "EWS Tool Technologies",
    productId: "VDI-16-CLAMP",
    stickOut: 0,
    totalLength: 18,
    compatibleWith: ["holder-ews-222115", "insert-cnmg-120408", "screw-m4x12"],
  },
  {
    id: "screw-m4x12",
    name: "M4 × 12 Torx Clamp Screw",
    category: "screw",
    type: "Screw",
    vendor: "EWS Tool Technologies",
    productId: "SCR-M4X12-T20",
    stickOut: 0,
    totalLength: 12,
    compatibleWith: ["holder-ews-222115", "clamp-vdi-16"],
  },
  {
    id: "adapter-er16",
    name: "ER16 MF Collet Adapter",
    category: "adapter",
    type: "Adapter",
    vendor: "Rego-Fix",
    productId: "ER16-MF-ADP",
    stickOut: 22,
    totalLength: 35,
    compatibleWith: ["holder-ews-222115", "holder-wnt-16"],
    connectionType: "ER16 MF",
    size: "16 mm",
  },
];

export const INITIAL_SLOTS: { id: string; label: string }[] = [
  { id: "slot-1", label: "Slot 1" },
  { id: "slot-2", label: "Slot 2" },
  { id: "slot-3", label: "Slot 3" },
];

export function getComponentById(id: string): ToolComponent | undefined {
  return TOOL_CATALOG.find((c) => c.id === id);
}

export function getComponentsByCategory(
  category: ToolComponent["category"],
): ToolComponent[] {
  return TOOL_CATALOG.filter((c) => c.category === category);
}
