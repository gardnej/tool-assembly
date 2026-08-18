/**
 * Types for the tool assembly prototype, aligned to Fusion's real schema.
 *
 * Two things follow Fusion rather than convenience. A cutting tool *owns* its
 * tool block — the block is nested inside the tool, not a parent with a list of
 * child slots. And components are joined at ISO-13399 joint frames (`MCS` on the
 * machine side, `CSW` on the cutting side), so the gauge length is measured
 * through that chain instead of summed from nominal lengths.
 */

export type WorkflowStepId =
  | "select-block"
  | "select-tool"
  | "configure"
  | "validate"
  | "review";

export type Orientation = "axial" | "radial";

export type ValidationStatus = "idle" | "checking" | "pass" | "warning" | "fail";

/** Which end of the chain a component sits at. */
export type ComponentRole = "block" | "holder";

/** Which joint frame a component lacks, if any. */
export type MissingFrame = "MCS" | "CSW" | "geometry" | null;

/** One component of the assembly, as shown in the grid. */
export interface AssemblyRow {
  id: ComponentRole;
  role: ComponentRole;
  /** Library tool this row came from, or null when nothing is chosen yet. */
  toolId: string | null;
  name: string;
  /** Fusion's own type string, e.g. "tool block" or "turning general". */
  type: string;
  vendor: string;
  /** Machine-side to cutting-side distance from stored frames, in millimetres. */
  spanMm: number | null;
  missingFrame: MissingFrame;
  /** Set when the block is positioned manually rather than by its joints. */
  hasTransformOverride: boolean;
}

export interface ValidationIssue {
  id: string;
  severity: "warning" | "error";
  message: string;
  toolId?: string;
}

/** Block-level configuration, mirroring the real `tool-block` geometry fields. */
export interface AssemblyConfig {
  orientation: Orientation;
  machineSideConnectionType: string;
  numberOfTools: number;
  numberOfAttachmentPoints: number;
  adaptiveItemSize: number;
  stationNumber: number | null;
  halfIndex: boolean;
}

export interface WorkflowState {
  currentStep: WorkflowStepId;
  completedSteps: WorkflowStepId[];
  activeTab: "general" | "assembly" | "setup" | "post-processor";
  /** Library the assembly is being built from. */
  libraryId: string;
  /** Standalone `tool block` item chosen as the machine-side root. */
  blockToolId: string | null;
  /** Cutting tool that carries the block, per Fusion's ownership direction. */
  cuttingToolId: string | null;
  selectedRowId: ComponentRole | null;
  config: AssemblyConfig;
  validationStatus: ValidationStatus;
  validationIssues: ValidationIssue[];
  generalInfo: {
    description: string;
    vendor: string;
    productId: string;
    productLink: string;
  };
}
