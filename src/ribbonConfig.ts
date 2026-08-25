/**
 * Fusion-style ribbon model: workspace dropdown + contextual tabs per workspace.
 *
 * The Manufacture workspace is not described here — its tabs, panels and
 * commands come from `data/ribbonManufacture`, generated from Fusion's own
 * toolbar definition. Design and Render remain hand-written stand-ins.
 */

import { MANUFACTURE_TABS } from "./data/ribbonManufacture";

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
  /** Manufacture workspace — Fusion's own tab ids, from TabToolbars.xml */
  | "MillingTab"
  | "TurningTab"
  | "AdditiveTab"
  | "FabricationTab"
  | "ProbingTab"
  | "UtilitiesTab"
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

/** Order and captions as the product declares them, not as we imagine them. */
export const MANUFACTURING_TAB_ORDER: readonly { id: RibbonTabId; label: string }[] =
  MANUFACTURE_TABS.map((tab) => ({ id: tab.id as RibbonTabId, label: tab.label }));

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
