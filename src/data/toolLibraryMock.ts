export type LibraryTreeNode = {
  id: string;
  label: string;
  selectable?: boolean;
  defaultExpanded?: boolean;
  children?: LibraryTreeNode[];
};

export type LibraryTool = {
  id: string;
  libraryId: string;
  name: string;
  cornerRadius: string;
  overallLength: string;
  type: string;
  description: string;
  vendor: string;
  shape: string;
  reliefAngle: string;
  tolerance: string;
  crossSection: string;
  insertSize: string;
  thickness: string;
};

export type CuttingPreset = {
  id: string;
  toolId: string;
  name: string;
  filterBySearch: string;
  spindleSpeed: string;
  surfaceSpeed: string;
  cuttingFeedrate: string;
  feedPerRev: string;
  coolant: string;
};

export const TOOL_LIBRARY_TREE: LibraryTreeNode[] = [
  {
    id: "user-libraries",
    label: "User Libraries",
    selectable: false,
    defaultExpanded: true,
    children: [
      { id: "documents", label: "Documents", selectable: false },
      { id: "hub-libraries", label: "Hub Libraries", selectable: false },
      { id: "cloud", label: "Cloud", selectable: false },
      {
        id: "local",
        label: "Local",
        selectable: false,
        defaultExpanded: true,
        children: [
          {
            id: "local-toolsand-blocks",
            label: "Toolsand Blocks",
            selectable: false,
            defaultExpanded: true,
            children: [
              { id: "lib-frontleft-hub", label: "FrontleftHub v5 v1", selectable: true },
              { id: "lib-sample-mill", label: "Sample Mill Tools", selectable: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "fusion-library",
    label: "Fusion Library",
    selectable: false,
    defaultExpanded: false,
    children: [
      { id: "fus-turning", label: "Turning", selectable: true },
      { id: "fus-milling", label: "Milling", selectable: true },
    ],
  },
];

export const LIBRARY_TOOLS: LibraryTool[] = [
  {
    id: "1",
    libraryId: "lib-frontleft-hub",
    name: "1 - CNMG120408-PM4325 (Turning general)",
    cornerRadius: "0.8 mm",
    overallLength: "12 mm",
    type: "turning",
    description: "1 - CNMG120408-PM4325 (Turning general)",
    vendor: "Sandvik Coromant",
    shape: "C",
    reliefAngle: "0 degrees",
    tolerance: "M",
    crossSection: "T",
    insertSize: "12.7 mm",
    thickness: "4.76 mm",
  },
  {
    id: "2",
    libraryId: "lib-frontleft-hub",
    name: "2 - DNMG150608-TF (Turning general)",
    cornerRadius: "0.4 mm",
    overallLength: "15 mm",
    type: "turning",
    description: "2 - DNMG150608-TF (Turning general)",
    vendor: "Iscar",
    shape: "D",
    reliefAngle: "0 degrees",
    tolerance: "M",
    crossSection: "T",
    insertSize: "15.5 mm",
    thickness: "6.35 mm",
  },
  {
    id: "3",
    libraryId: "lib-frontleft-hub",
    name: "3 - CNMT09T308 - DCLN-R (Turning general)",
    cornerRadius: "0.8 mm",
    overallLength: "9.67194 mm",
    type: "turning",
    description: "3 - CNMT09T308 - DCLN-R (Turning general)",
    vendor: "Kennametal",
    shape: "C",
    reliefAngle: "0 degrees",
    tolerance: "M",
    crossSection: "T",
    insertSize: "9.67194 mm",
    thickness: "3.96875 mm",
  },
  {
    id: "4",
    libraryId: "lib-frontleft-hub",
    name: "4 - WNMG080408-MA (Finishing)",
    cornerRadius: "0.8 mm",
    overallLength: "8 mm",
    type: "turning",
    description: "4 - WNMG080408-MA (Finishing)",
    vendor: "Walter",
    shape: "W",
    reliefAngle: "0 degrees",
    tolerance: "M",
    crossSection: "T",
    insertSize: "8.35 mm",
    thickness: "4.76 mm",
  },
  {
    id: "5",
    libraryId: "lib-frontleft-hub",
    name: "5 - VNMG160408 (Profiling)",
    cornerRadius: "0.4 mm",
    overallLength: "16 mm",
    type: "turning",
    description: "5 - VNMG160408 (Profiling)",
    vendor: "Seco",
    shape: "V",
    reliefAngle: "0 degrees",
    tolerance: "M",
    crossSection: "T",
    insertSize: "16.5 mm",
    thickness: "4.76 mm",
  },
  {
    id: "6",
    libraryId: "lib-frontleft-hub",
    name: "6 - CCMT09T304 (Copy turning)",
    cornerRadius: "0.4 mm",
    overallLength: "9.525 mm",
    type: "turning",
    description: "6 - CCMT09T304 (Copy turning)",
    vendor: "Mitsubishi",
    shape: "C",
    reliefAngle: "7 degrees",
    tolerance: "M",
    crossSection: "T",
    insertSize: "9.525 mm",
    thickness: "3.97 mm",
  },
  {
    id: "m1",
    libraryId: "lib-sample-mill",
    name: "10 mm Flat Endmill",
    cornerRadius: "—",
    overallLength: "75 mm",
    type: "milling",
    description: "10 mm Flat Endmill",
    vendor: "OSG",
    shape: "—",
    reliefAngle: "—",
    tolerance: "—",
    crossSection: "—",
    insertSize: "10 mm",
    thickness: "—",
  },
];

export const CUTTING_PRESETS: CuttingPreset[] = [
  {
    id: "preset-3-default",
    toolId: "3",
    name: "Default preset",
    filterBySearch: "",
    spindleSpeed: "—",
    surfaceSpeed: "200 m/min",
    cuttingFeedrate: "0.2 mm/rev",
    feedPerRev: "0.2 mm/rev",
    coolant: "Flood",
  },
];

export const DEFAULT_LIBRARY_ID = "lib-frontleft-hub";
export const DEFAULT_TOOL_ID = "3";

export function toolsForLibrary(libraryId: string): LibraryTool[] {
  return LIBRARY_TOOLS.filter((t) => t.libraryId === libraryId);
}

export function presetsForTool(toolId: string): CuttingPreset[] {
  return CUTTING_PRESETS.filter((p) => p.toolId === toolId);
}

export function libraryBreadcrumb(libraryId: string): string {
  if (libraryId === "lib-frontleft-hub") {
    return "Local > FrontleftHub v5 v1";
  }
  if (libraryId === "lib-sample-mill") {
    return "Local > Sample Mill Tools";
  }
  if (libraryId === "fus-turning") {
    return "Fusion Library > Turning";
  }
  if (libraryId === "fus-milling") {
    return "Fusion Library > Milling";
  }
  return "Tool library";
}
