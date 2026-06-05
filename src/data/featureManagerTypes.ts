/** Shared types & template lists for Feature Manager (no design-specific data). */

export type FeatureKind =
  | "profile"
  | "face"
  | "hole"
  | "slot"
  | "pocket"
  | "shoulder"
  | "groove"
  | "thread";

/** Internal (bore) vs outside (OD) diameter — turning feature list indicator. */
export type FeatureDiameterSide = "ID" | "OD";

/** Required machine axis capability for machining this feature (Fusion-style icon). */
export type MachiningAxisCount = 3 | 4 | 5;

export type MachiningFlag =
  | "machined"
  | "notMachined"
  | "issues"
  | "userApproved";

export const MACHINING_LABEL: Record<MachiningFlag, string> = {
  machined: "Machined",
  notMachined: "Not machined",
  issues: "Issues",
  userApproved: "User approved",
};

/** One CAM operation authored under “Create operations” for a feature row (prototype). */
export type CreatedCamOp = {
  id: string;
  label: string;
};

/** Axial extent along part Z for preview highlighting (model units, metres). */
export type FeatureAxialRange = {
  axialMin: number;
  axialMax: number;
};

/** How this feature appears on the ZY section preview overlay. */
export type FeatureSectionHighlight =
  | "od"
  | "bore"
  /** Perpendicular face (vertical line at station Z). */
  | "face-vertical"
  /** Radial wall at a diameter step (shoulder). */
  | "shoulder-step"
  /** Angled chamfer / transition on OD. */
  | "shoulder-chamfer"
  /** Recessed groove contour on OD. */
  | "groove-contour"
  /** Curved or complex OD profile segment. */
  | "profile-contour"
  /** Flat horizontal OD profile (e.g. right cylinder crest). */
  | "profile-flat"
  /** External thread major-diameter face. */
  | "thread-external"
  /** Internal thread bore wedge (filled). */
  | "thread-internal";

/** Infer ID vs OD from feature kind and section highlight mode. */
export function inferDiameterSide(
  kind: FeatureKind,
  sectionHighlight?: FeatureSectionHighlight,
): FeatureDiameterSide {
  if (sectionHighlight === "thread-internal" || sectionHighlight === "bore") {
    return "ID";
  }
  if (
    sectionHighlight === "thread-external" ||
    sectionHighlight === "profile-contour" ||
    sectionHighlight === "profile-flat" ||
    sectionHighlight === "groove-contour" ||
    sectionHighlight === "shoulder-step" ||
    sectionHighlight === "shoulder-chamfer" ||
    sectionHighlight === "face-vertical" ||
    sectionHighlight === "od"
  ) {
    return "OD";
  }
  switch (kind) {
    case "hole":
    case "slot":
    case "pocket":
      return "ID";
    case "profile":
    case "groove":
    case "shoulder":
    case "face":
      return "OD";
    case "thread":
      return "OD";
    default:
      return "OD";
  }
}

export type FeatureRow = {
  id: string;
  kind: FeatureKind;
  name: string;
  /** Internal diameter (bore) or outside diameter (OD) feature. */
  diameterSide: FeatureDiameterSide;
  /** Station range on the part — used to highlight the feature on the profile preview. */
  axialRange?: FeatureAxialRange;
  sectionHighlight?: FeatureSectionHighlight;
  /** Modeled instance count — shown in expandable detail; Threads category shows 1 per row in the # column. */
  sameTypeCount: number;
  /** Stable sequence within kind for provisional CAM naming (Fusion-style). */
  camOrdinal: number;
  status: "error" | "ok" | "warning";
  orientation: string;
  flags: Set<MachiningFlag>;
  unmatched: boolean;
  /** Machine axis count shown in the Machining Type column (defaults from kind when omitted). */
  machiningAxisCount?: MachiningAxisCount;
  defaultTemplate: string;
  defaultSetup: string;
};

/** Prototype default axis requirement by feature kind. */
export function inferMachiningAxisCount(kind: FeatureKind): MachiningAxisCount {
  switch (kind) {
    case "pocket":
    case "slot":
      return 5;
    case "thread":
      return 4;
    default:
      return 3;
  }
}

/** Category rail order and labels (matches Fusion turning feature legend). */
export const FEATURE_NAV: { kind: FeatureKind; label: string }[] = [
  { kind: "profile", label: "Profiles" },
  { kind: "groove", label: "Grooves" },
  { kind: "thread", label: "Threads" },
  { kind: "shoulder", label: "Shoulders" },
  { kind: "face", label: "Faces" },
  { kind: "hole", label: "Holes" },
  { kind: "slot", label: "Slots" },
  { kind: "pocket", label: "Pockets" },
];

export const TEMPLATE_OPTIONS: string[] = ["Manual", "Template Name", "Create Operation"];

/** Stable identifiers for comparisons (subset of Feature Manager dropdown). */
export const FM_TEMPLATE_MANUAL = "Manual";
export const FM_TEMPLATE_NAME = "Template Name";
export const FM_TEMPLATE_CREATE_OPERATION = "Create Operation";

export const SETUP_OPTIONS: string[] = ["Create", "Setup 1", "Setup 2"];
