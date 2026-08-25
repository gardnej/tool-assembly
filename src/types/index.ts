/**
 * Types for the tool assembly prototype, aligned to Fusion's real schema.
 *
 * Two things follow Fusion rather than convenience. A cutting tool *owns* its
 * tool block: the block is nested inside the tool, so the parent block row is
 * derived by grouping the tools that carry it rather than stored anywhere. And
 * components are joined at ISO-13399 joint frames (`MCS` on the machine side,
 * `CSW` on the cutting side), so gauge length is measured through that chain
 * instead of summed from nominal lengths.
 *
 * The slot ordinals below therefore exist only in this UI. Fusion has no seat
 * index, which leaves the turret station as a position's one persistable
 * property.
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

/**
 * What kind of thing sits at one step of a position's stack.
 *
 * The adaptive items are what make a cutting tool fit a position: an extension
 * packs the position out, and a collet inside it grips the tool. Neither is
 * required — a cutting tool can go straight into the position, or into an
 * extension without a collet — so this says what a component *is* rather than
 * where it has to go.
 */
export type SlotLevel = "extension" | "collet" | "tool";

/** Grid row identity: the derived parent block, or one step of one position. */
export type RowId = "block" | `slot-${number}` | `slot-${number}-${number}`;

/** Row id for one step of a position; the first step is the position row. */
export function slotRowId(index: number, depth: number): RowId {
  return depth === 0 ? `slot-${index}` : `slot-${index}-${depth}`;
}

/** Which joint frame a component lacks, if any. */
export type MissingFrame = "MCS" | "CSW" | "geometry" | null;

/**
 * One position under the tool block and the stack it holds.
 *
 * The stack is what Fusion would store as a chain of joined components, in the
 * order they mount: whatever seats in the position first, then whatever mounts
 * through that. What may follow what is a rule about the parts rather than a
 * fixed shape — a position can hold a cutting tool on its own, or an extension
 * with a tool in it, or an extension, a collet and a tool.
 *
 * Nothing here is written back as a slot: the ordinal is this UI's, and only the
 * station survives a save, onto the occupying tool's own `post-process` fields.
 */
export interface AssemblySlot {
  /** Library ids of the stack, machine side first. Empty while unfilled. */
  stack: string[];
  /** Station this position assigns, or null to follow row order. */
  stationNumber: number | null;
  halfIndex: boolean;
}

/** One component of the assembly, as shown in the grid. */
export interface AssemblyRow {
  id: RowId;
  role: ComponentRole;
  /** Position under the block, or null on the block row itself. */
  slotIndex: number | null;
  /** How far down the position's stack this row sits; null on the block row. */
  depth: number | null;
  /**
   * What this row holds: null on the block row, and null on the open row at the
   * end of a position, which holds nothing yet.
   */
  level: SlotLevel | null;
  /** Kinds this row can take, so an open row offers what actually fits. */
  accepts: SlotLevel[];
  /** Library tool this row came from, or null when nothing is chosen yet. */
  toolId: string | null;
  name: string;
  /** Fusion's own type string, e.g. "tool block" or "turning general". */
  type: string;
  vendor: string;
  /** Machine-side to cutting-side distance from stored frames, in millimetres. */
  spanMm: number | null;
  /**
   * How far this component reaches past the tool block's face, in millimetres.
   * The block is the mount rather than something mounted on it, so it has none.
   */
  gaugeLengthMm: number | null;
  missingFrame: MissingFrame;
  /** Set when the block is positioned manually rather than by its joints. */
  hasTransformOverride: boolean;
  /** Turret station this row assigns, null only on the block row. */
  stationNumber: number | null;
  halfIndex: boolean;
  /** Set when the station is row order rather than the tool's own setting. */
  stationFollowsOrder: boolean;
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
  /**
   * Standalone `tool block` item chosen as the machine-side root, used only
   * until an occupant supplies a block of its own to derive from.
   */
  blockToolId: string | null;
  /** Positions under the block, one row each. Length is `config.numberOfTools`. */
  slots: AssemblySlot[];
  selectedRowId: RowId | null;
  config: AssemblyConfig;
  validationStatus: ValidationStatus;
  validationIssues: ValidationIssue[];
  generalInfo: {
    description: string;
    vendor: string;
    productId: string;
    productLink: string;
  };
  /**
   * Id of the saved assembly this workflow was opened to edit, or null when
   * building a fresh one. When set, saving replaces those records in place
   * rather than minting new ones.
   */
  editingAssemblyId: string | null;
}

/**
 * A tool assembly persisted as a single library entry.
 *
 * Fusion writes an assembled tool back as a cutting-tool record with the block
 * nested, but the prototype keeps the whole chain here: the block choice, the
 * stack under every position and the config that was in force at save time.
 * That is what an ``Edit`` from the library reopens straight back into the
 * assembly workflow.
 */
export interface SavedAssembly {
  id: string;
  libraryId: string;
  name: string;
  vendor: string;
  productId: string;
  productLink: string;
  blockToolId: string | null;
  /** One entry per position, ordered as they sit on the block. */
  slots: {
    stack: string[];
    stationNumber: number | null;
    halfIndex: boolean;
  }[];
  config: AssemblyConfig;
  createdAt: number;
}
