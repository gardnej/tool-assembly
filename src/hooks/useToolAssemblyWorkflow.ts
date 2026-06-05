import { useCallback, useMemo, useState } from "react";
import { getComponentById, INITIAL_SLOTS } from "../data/toolComponents";
import { getStepIndex, WORKFLOW_STEPS } from "../data/workflowSteps";
import type {
  AssemblyConfig,
  AssemblyRow,
  AssemblySlot,
  ToolComponent,
  ValidationIssue,
  ValidationStatus,
  WorkflowState,
  WorkflowStepId,
} from "../types";

const DEFAULT_CONFIG: AssemblyConfig = {
  orientation: "axial",
  machineConnectionType: "Unspecified",
  toolConnectionType: "ER16 MF",
  size: "Unspecified",
  numberOfTools: 2,
  stickOut: 42,
  totalLength: 57,
};

function createInitialState(): WorkflowState {
  return {
    currentStep: "select-holder",
    completedSteps: [],
    activeTab: "assembly",
    selectedCatalogId: null,
    selectedAssemblyId: null,
    assemblyRows: [],
    slots: INITIAL_SLOTS.map((s) => ({ ...s, componentId: null })),
    config: { ...DEFAULT_CONFIG },
    validationStatus: "idle",
    validationIssues: [],
    generalInfo: {
      description: "Turning tool holder assembly — prototype",
      vendor: "",
      productId: "",
      productLink: "",
    },
  };
}

function isCompatible(holderId: string, componentId: string): boolean {
  const holder = getComponentById(holderId);
  const component = getComponentById(componentId);
  if (holder === undefined || component === undefined) return false;
  return (
    holder.compatibleWith.includes(componentId) ||
    component.compatibleWith.includes(holderId)
  );
}

function runValidation(
  rows: AssemblyRow[],
  slots: AssemblySlot[],
  config: AssemblyConfig,
): { status: ValidationStatus; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const holder = rows.find((r) => r.isRoot === true);
  if (holder === undefined) {
    return {
      status: "fail",
      issues: [
        {
          id: "no-holder",
          severity: "error",
          message: "No tool holder selected in the assembly.",
        },
      ],
    };
  }

  const filledSlots = slots.filter((s) => s.componentId !== null);
  if (filledSlots.length === 0) {
    issues.push({
      id: "no-slots",
      severity: "warning",
      message: "No components assigned to assembly slots.",
    });
  }

  for (const slot of filledSlots) {
    if (slot.componentId !== null && !isCompatible(holder.componentId, slot.componentId)) {
      const comp = getComponentById(slot.componentId);
      issues.push({
        id: `compat-${slot.id}`,
        severity: "error",
        message: `${comp?.name ?? "Component"} is not compatible with the selected holder.`,
        componentId: slot.componentId,
      });
    }
  }

  if (config.stickOut > config.totalLength) {
    issues.push({
      id: "stickout-exceeds",
      severity: "error",
      message: "Stick out exceeds total tool length.",
    });
  }

  if (config.toolConnectionType === "Unspecified") {
    issues.push({
      id: "connection-unspecified",
      severity: "warning",
      message: "Tool connection type is unspecified — verify machine interface.",
    });
  }

  const hasInsert = filledSlots.some((s) => {
    const c = s.componentId !== null ? getComponentById(s.componentId) : undefined;
    return c?.category === "insert";
  });
  if (!hasInsert) {
    issues.push({
      id: "no-insert",
      severity: "warning",
      message: "No cutting insert assigned — assembly cannot generate toolpaths.",
    });
  }

  if (issues.some((i) => i.severity === "error")) {
    return { status: "fail", issues };
  }
  if (issues.some((i) => i.severity === "warning")) {
    return { status: "warning", issues };
  }
  return { status: "pass", issues: [] };
}

export function useToolAssemblyWorkflow() {
  const [state, setState] = useState<WorkflowState>(createInitialState);

  const holderRow = useMemo(
    () => state.assemblyRows.find((r) => r.isRoot === true),
    [state.assemblyRows],
  );

  const selectedCatalogComponent = useMemo(
    () =>
      state.selectedCatalogId !== null
        ? getComponentById(state.selectedCatalogId)
        : undefined,
    [state.selectedCatalogId],
  );

  const selectedAssemblyComponent = useMemo(() => {
    if (state.selectedAssemblyId === null) return undefined;
    const row = state.assemblyRows.find((r) => r.id === state.selectedAssemblyId);
    if (row !== undefined) return getComponentById(row.componentId);
    const slot = state.slots.find((s) => s.id === state.selectedAssemblyId);
    if (slot?.componentId !== null && slot !== undefined) {
      return getComponentById(slot.componentId);
    }
    return undefined;
  }, [state.selectedAssemblyId, state.assemblyRows, state.slots]);

  const assemblyComponents = useMemo(() => {
    const ids = new Set<string>();
    for (const row of state.assemblyRows) ids.add(row.componentId);
    for (const slot of state.slots) {
      if (slot.componentId !== null) ids.add(slot.componentId);
    }
    return [...ids]
      .map((id) => getComponentById(id))
      .filter((c): c is ToolComponent => c !== undefined);
  }, [state.assemblyRows, state.slots]);

  const selectCatalogComponent = useCallback((id: string) => {
    setState((prev) => ({ ...prev, selectedCatalogId: id }));
  }, []);

  const selectAssemblyItem = useCallback((id: string) => {
    setState((prev) => ({ ...prev, selectedAssemblyId: id }));
  }, []);

  const setActiveTab = useCallback((tab: WorkflowState["activeTab"]) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const updateConfig = useCallback((patch: Partial<AssemblyConfig>) => {
    setState((prev) => ({
      ...prev,
      config: { ...prev.config, ...patch },
      validationStatus: "idle",
    }));
  }, []);

  const updateGeneralInfo = useCallback(
    (patch: Partial<WorkflowState["generalInfo"]>) => {
      setState((prev) => ({
        ...prev,
        generalInfo: { ...prev.generalInfo, ...patch },
      }));
    },
    [],
  );

  const addToAssembly = useCallback(() => {
    setState((prev) => {
      if (prev.selectedCatalogId === null) return prev;
      const component = getComponentById(prev.selectedCatalogId);
      if (component === undefined) return prev;

      if (component.category === "tool-holder") {
        const row: AssemblyRow = {
          id: "root-holder",
          componentId: component.id,
          type: component.type,
          stickOut: component.stickOut,
          totalLength: component.totalLength,
          isRoot: true,
        };
        const nextCompleted: WorkflowStepId[] = prev.completedSteps.includes("select-holder")
          ? prev.completedSteps
          : [...prev.completedSteps, "select-holder"];
        return {
          ...prev,
          assemblyRows: [row],
          selectedAssemblyId: row.id,
          config: {
            ...prev.config,
            stickOut: component.stickOut,
            totalLength: component.totalLength,
            toolConnectionType: component.connectionType ?? prev.config.toolConnectionType,
            orientation: component.orientation ?? prev.config.orientation,
          },
          currentStep: prev.currentStep === "select-holder" ? "add-insert" : prev.currentStep,
          completedSteps: nextCompleted,
          generalInfo: {
            ...prev.generalInfo,
            vendor: component.vendor,
            productId: component.productId,
          },
        };
      }

      const emptySlot = prev.slots.find((s) => s.componentId === null);
      if (emptySlot === undefined) return prev;

      const holder = prev.assemblyRows.find((r) => r.isRoot === true);
      if (holder !== undefined && !isCompatible(holder.componentId, component.id)) {
        return {
          ...prev,
          validationStatus: "warning" as ValidationStatus,
          validationIssues: [
            {
              id: "add-incompatible",
              severity: "warning",
              message: `${component.name} may not be compatible with the current holder.`,
              componentId: component.id,
            },
          ],
        };
      }

      const slots = prev.slots.map((s) =>
        s.id === emptySlot.id ? { ...s, componentId: component.id } : s,
      );
      const hasInsert = slots.some((s) => {
        const c = s.componentId !== null ? getComponentById(s.componentId) : undefined;
        return c?.category === "insert";
      });
      const nextCompleted: WorkflowStepId[] = [...prev.completedSteps];
      if (hasInsert && !nextCompleted.includes("add-insert")) {
        nextCompleted.push("add-insert");
      }

      return {
        ...prev,
        slots,
        selectedAssemblyId: emptySlot.id,
        currentStep:
          prev.currentStep === "add-insert" && hasInsert ? "configure" : prev.currentStep,
        completedSteps: nextCompleted,
        validationStatus: "idle",
        validationIssues: [],
      };
    });
  }, []);

  const assignSlotComponent = useCallback((slotId: string, componentId: string | null) => {
    setState((prev) => ({
      ...prev,
      slots: prev.slots.map((s) =>
        s.id === slotId ? { ...s, componentId } : s,
      ),
      validationStatus: "idle",
    }));
  }, []);

  const runValidate = useCallback(() => {
    setState((prev) => {
      const { status, issues } = runValidation(prev.assemblyRows, prev.slots, prev.config);
      const nextCompleted: WorkflowStepId[] = [...prev.completedSteps];
      if (!nextCompleted.includes("configure")) nextCompleted.push("configure");
      if (status === "pass" || status === "warning") {
        if (!nextCompleted.includes("validate")) nextCompleted.push("validate");
      }
      const finalCompleted: WorkflowStepId[] =
        status === "pass" || status === "warning"
          ? nextCompleted.includes("review")
            ? nextCompleted
            : [...nextCompleted, "review"]
          : nextCompleted;
      return {
        ...prev,
        validationStatus: status,
        validationIssues: issues,
        currentStep: status === "fail" ? "validate" : "review",
        completedSteps: finalCompleted,
      };
    });
  }, []);

  const goToStep = useCallback((step: WorkflowStepId) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const advanceStep = useCallback(() => {
    setState((prev) => {
      const idx = getStepIndex(prev.currentStep);
      const next = WORKFLOW_STEPS[idx + 1];
      if (next === undefined) return prev;
      const completed = prev.completedSteps.includes(prev.currentStep)
        ? prev.completedSteps
        : [...prev.completedSteps, prev.currentStep];
      return { ...prev, currentStep: next.id, completedSteps: completed };
    });
  }, []);

  const resetWorkflow = useCallback(() => {
    setState(createInitialState());
  }, []);

  return {
    state,
    holderRow,
    selectedCatalogComponent,
    selectedAssemblyComponent,
    assemblyComponents,
    selectCatalogComponent,
    selectAssemblyItem,
    setActiveTab,
    updateConfig,
    updateGeneralInfo,
    addToAssembly,
    assignSlotComponent,
    runValidate,
    goToStep,
    advanceStep,
    resetWorkflow,
  };
}
