export type ComponentCategory =
  | "tool-holder"
  | "insert"
  | "clamp"
  | "screw"
  | "adapter";

export type WorkflowStepId =
  | "select-holder"
  | "add-insert"
  | "configure"
  | "validate"
  | "review";

export type Orientation = "axial" | "radial";

export type ValidationStatus = "idle" | "checking" | "pass" | "warning" | "fail";

export interface CuttingParameters {
  surfaceSpeed: number;
  feedPerRev: number;
  depthOfCut: number;
  material: string;
}

export interface ToolComponent {
  id: string;
  name: string;
  category: ComponentCategory;
  type: string;
  vendor: string;
  productId: string;
  stickOut: number;
  totalLength: number;
  compatibleWith: string[];
  model?: string;
  connectionType?: string;
  size?: string;
  orientation?: Orientation;
  cuttingParameters?: CuttingParameters;
}

export interface AssemblySlot {
  id: string;
  label: string;
  componentId: string | null;
}

export interface AssemblyRow {
  id: string;
  componentId: string;
  type: string;
  stickOut: number;
  totalLength: number;
  isRoot?: boolean;
}

export interface ValidationIssue {
  id: string;
  severity: "warning" | "error";
  message: string;
  componentId?: string;
}

export interface AssemblyConfig {
  orientation: Orientation;
  machineConnectionType: string;
  toolConnectionType: string;
  size: string;
  numberOfTools: number;
  stickOut: number;
  totalLength: number;
}

export interface WorkflowState {
  currentStep: WorkflowStepId;
  completedSteps: WorkflowStepId[];
  activeTab: "general" | "assembly" | "setup" | "post-processor";
  selectedCatalogId: string | null;
  selectedAssemblyId: string | null;
  assemblyRows: AssemblyRow[];
  slots: AssemblySlot[];
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
