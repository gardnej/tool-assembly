import type { WorkflowStepId } from "../types";

export interface WorkflowStepMeta {
  id: WorkflowStepId;
  label: string;
  shortLabel: string;
  description: string;
}

export const WORKFLOW_STEPS: WorkflowStepMeta[] = [
  {
    id: "select-block",
    label: "Select tool block",
    shortLabel: "Block",
    description: "Choose a tool block to sit against the turret face.",
  },
  {
    id: "select-tool",
    label: "Select cutting tool",
    shortLabel: "Tool",
    description: "Choose the cutting tool that will carry the block.",
  },
  {
    id: "configure",
    label: "Configure block & station",
    shortLabel: "Configure",
    description: "Set orientation, machine-side connection, and turret station.",
  },
  {
    id: "validate",
    label: "Validate joint chain",
    shortLabel: "Validate",
    description: "Check that every component has MCS and CSW joint frames.",
  },
  {
    id: "review",
    label: "Review assembly",
    shortLabel: "Review",
    description: "Confirm the measured stack-up before saving.",
  },
];

export function getStepIndex(step: WorkflowStepId): number {
  return WORKFLOW_STEPS.findIndex((s) => s.id === step);
}
