import type { WorkflowStepId } from "../types";

export interface WorkflowStepMeta {
  id: WorkflowStepId;
  label: string;
  shortLabel: string;
  description: string;
}

export const WORKFLOW_STEPS: WorkflowStepMeta[] = [
  {
    id: "select-holder",
    label: "Select tool holder",
    shortLabel: "Holder",
    description: "Choose a turning tool block from the component library.",
  },
  {
    id: "add-insert",
    label: "Add compatible insert",
    shortLabel: "Insert",
    description: "Assign inserts, clamps, and fasteners to assembly slots.",
  },
  {
    id: "configure",
    label: "Configure orientation & dimensions",
    shortLabel: "Configure",
    description: "Set orientation, connection types, and stick-out values.",
  },
  {
    id: "validate",
    label: "Validate compatibility",
    shortLabel: "Validate",
    description: "Check geometry, connection, and cutting parameter fit.",
  },
  {
    id: "review",
    label: "Review assembly",
    shortLabel: "Review",
    description: "Confirm the completed turning tool holder assembly.",
  },
];

export function getStepIndex(step: WorkflowStepId): number {
  return WORKFLOW_STEPS.findIndex((s) => s.id === step);
}
