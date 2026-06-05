/**
 * Fusion-style ribbon model: workspace dropdown + contextual tabs per workspace.
 */

export type RibbonWorkspaceId = "design" | "manufacturing" | "render";

export type RibbonTabId =
  /** Design workspace */
  | "model"
  | "surface"
  | "sheet"
  | "plastic"
  | "sketch"
  | "assemble"
  | "inspect"
  | "utilities"
  | "addons"
  /** Manufacturing workspace */
  | "mfg_milling"
  | "mfg_turning"
  | "mfg_additive"
  | "mfg_inspection"
  | "mfg_fabrication"
  | "mfg_utilities"
  /** Render workspace */
  | "r_scene"
  | "r_visuals"
  | "r_output";

export const WORKSPACE_OPTIONS: readonly {
  id: RibbonWorkspaceId;
  label: string;
  hint: string;
}[] = [
  { id: "design", label: "DESIGN", hint: "Solid, surface, sketch, and assemble" },
  { id: "manufacturing", label: "MANUFACTURE", hint: "Milling, turning, additive, and fabrication" },
  { id: "render", label: "RENDER", hint: "Scene, visuals, render output" },
] as const;

export const DESIGN_TAB_ORDER: readonly { id: RibbonTabId; label: string }[] = [
  { id: "model", label: "SOLID" },
  { id: "surface", label: "SURFACE" },
  { id: "sheet", label: "SHEET METAL" },
  { id: "plastic", label: "PLASTIC" },
  { id: "sketch", label: "SKETCH" },
  { id: "assemble", label: "ASSEMBLE" },
  { id: "inspect", label: "INSPECT" },
  { id: "utilities", label: "TOOLS" },
  { id: "addons", label: "ADD-INS" },
];

export const MANUFACTURING_TAB_ORDER: readonly { id: RibbonTabId; label: string }[] = [
  { id: "mfg_milling", label: "MILLING" },
  { id: "mfg_turning", label: "TURNING" },
  { id: "mfg_additive", label: "ADDITIVE" },
  { id: "mfg_inspection", label: "INSPECTION" },
  { id: "mfg_fabrication", label: "FABRICATION" },
  { id: "mfg_utilities", label: "UTILITIES" },
];

export const RENDER_TAB_ORDER: readonly { id: RibbonTabId; label: string }[] = [
  { id: "r_scene", label: "SCENE" },
  { id: "r_visuals", label: "APPEARANCE" },
  { id: "r_output", label: "RENDER" },
];

export function ribbonTabsForWorkspace(
  ws: RibbonWorkspaceId,
): readonly { id: RibbonTabId; label: string }[] {
  switch (ws) {
    case "design":
      return DESIGN_TAB_ORDER;
    case "manufacturing":
      return MANUFACTURING_TAB_ORDER;
    case "render":
      return RENDER_TAB_ORDER;
  }
}

export function defaultTabForWorkspace(ws: RibbonWorkspaceId): RibbonTabId {
  const tabs = ribbonTabsForWorkspace(ws);
  return tabs[0] !== undefined ? tabs[0].id : "model";
}
