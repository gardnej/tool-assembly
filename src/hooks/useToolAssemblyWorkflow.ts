import { useCallback, useMemo, useState } from "react";
import {
  chainFor,
  cuttingTools,
  displayName,
  isTurningType,
  LIBRARIES,
  measuredStackUpMm,
  missingFrameLabel,
  toolBlocks,
  toolById,
  type ChainComponent,
  type LibraryToolRecord,
} from "../data/realLibrary";
import { getStepIndex, WORKFLOW_STEPS } from "../data/workflowSteps";
import type {
  AssemblyConfig,
  AssemblyRow,
  ComponentRole,
  Orientation,
  ValidationIssue,
  ValidationStatus,
  WorkflowState,
  WorkflowStepId,
} from "../types";

/** Library holding the real tool blocks, preferred as the starting point. */
function defaultLibraryId(): string {
  const withBlocks = LIBRARIES.find((library) => library.blockCount > 0);
  return withBlocks?.id ?? LIBRARIES[0]?.id ?? "";
}

const DEFAULT_CONFIG: AssemblyConfig = {
  orientation: "axial",
  machineSideConnectionType: "Unspecified",
  numberOfTools: 1,
  numberOfAttachmentPoints: 0,
  adaptiveItemSize: 0,
  stationNumber: null,
  halfIndex: false,
};

function readNumber(
  source: Record<string, number | string | boolean>,
  key: string,
  fallback: number,
): number {
  const value = source[key];
  return typeof value === "number" ? value : fallback;
}

function readString(
  source: Record<string, number | string | boolean>,
  key: string,
  fallback: string,
): string {
  const value = source[key];
  return typeof value === "string" ? value : fallback;
}

/** Pull block-level settings out of a real `tool block` item. */
function configFromBlock(block: LibraryToolRecord): Partial<AssemblyConfig> {
  const geometry = block.geometry;
  const orientation = readString(geometry, "orientationType", "axial");

  return {
    orientation: orientation === "radial" ? "radial" : ("axial" as Orientation),
    machineSideConnectionType: readString(
      geometry,
      "machineSideConnectionType",
      "Unspecified",
    ),
    numberOfTools: readNumber(geometry, "numberOfTools", 1),
    numberOfAttachmentPoints: readNumber(geometry, "numberOfAttachmentPoints", 0),
    adaptiveItemSize: readNumber(geometry, "adaptiveItemSize", 0),
    stationNumber: block.postProcess.stationNumber,
    halfIndex: block.postProcess.halfIndex === true,
  };
}

function createInitialState(): WorkflowState {
  return {
    currentStep: "select-block",
    completedSteps: [],
    activeTab: "assembly",
    libraryId: defaultLibraryId(),
    blockToolId: null,
    cuttingToolId: null,
    selectedRowId: null,
    config: { ...DEFAULT_CONFIG },
    validationStatus: "idle",
    validationIssues: [],
    generalInfo: {
      description: "",
      vendor: "",
      productId: "",
      productLink: "",
    },
  };
}

function rowFor(
  role: ComponentRole,
  tool: LibraryToolRecord | undefined,
  component: ChainComponent | undefined,
  hasTransformOverride: boolean,
): AssemblyRow {
  if (tool === undefined) {
    return {
      id: role,
      role,
      toolId: null,
      name: "",
      type: "",
      vendor: "",
      spanMm: null,
      missingFrame: null,
      hasTransformOverride: false,
    };
  }

  return {
    id: role,
    role,
    toolId: tool.id,
    name: displayName(tool),
    type: tool.type,
    vendor: tool.vendor,
    spanMm: component?.spanMm ?? null,
    missingFrame: component !== undefined ? missingFrameLabel(component) : "geometry",
    hasTransformOverride,
  };
}

/**
 * Validation against what Fusion actually requires: a component is only usable
 * once its solid carries both joint frames, and a chain with a gap in it cannot
 * be measured at all.
 */
function runValidation(
  rows: AssemblyRow[],
  measuredMm: number | null,
  config: AssemblyConfig,
): { status: ValidationStatus; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  const block = rows.find((row) => row.role === "block");
  const holder = rows.find((row) => row.role === "holder");

  if (holder?.toolId === null || holder === undefined) {
    return {
      status: "fail",
      issues: [
        {
          id: "no-tool",
          severity: "error",
          message: "No cutting tool selected — a tool owns the block in Fusion's schema.",
        },
      ],
    };
  }

  if (block === undefined || block.toolId === null) {
    issues.push({
      id: "no-block",
      severity: "warning",
      message: "No tool block chosen, so the assembly has no machine-side root.",
    });
  }

  for (const row of rows) {
    if (row.toolId === null || row.missingFrame === null) continue;
    if (row.missingFrame === "geometry") {
      issues.push({
        id: `no-geometry-${row.role}`,
        severity: "error",
        message: `${row.name} has no 3D solid, so it carries no joint frames.`,
        toolId: row.toolId,
      });
      continue;
    }
    issues.push({
      id: `missing-frame-${row.role}`,
      severity: "error",
      message:
        `${row.name} is missing its ${row.missingFrame} frame. ` +
        "Joint frames come from the STEP file, so add it in CAD and re-import.",
      toolId: row.toolId,
    });
  }

  if (measuredMm === null && issues.every((issue) => issue.severity !== "error")) {
    issues.push({
      id: "not-measurable",
      severity: "warning",
      message: "Stack-up cannot be measured through this chain.",
    });
  }

  const overridden = rows.find((row) => row.hasTransformOverride);
  if (overridden !== undefined) {
    issues.push({
      id: "transform-override",
      severity: "warning",
      message:
        `${overridden.name} is positioned manually by transformOverride, ` +
        "which overrides the joint chain.",
      toolId: overridden.toolId ?? undefined,
    });
  }

  if (config.machineSideConnectionType === "Unspecified") {
    issues.push({
      id: "connection-unspecified",
      severity: "warning",
      message: "Machine-side connection type is unspecified — verify the turret interface.",
    });
  }

  if (issues.some((issue) => issue.severity === "error")) {
    return { status: "fail", issues };
  }
  if (issues.length > 0) {
    return { status: "warning", issues };
  }
  return { status: "pass", issues: [] };
}

export function useToolAssemblyWorkflow() {
  const [state, setState] = useState<WorkflowState>(createInitialState);

  const availableBlocks = useMemo(
    () => toolBlocks(state.libraryId),
    [state.libraryId],
  );

  const availableTools = useMemo(
    () => cuttingTools(state.libraryId),
    [state.libraryId],
  );

  const blockTool = useMemo(
    () => (state.blockToolId !== null ? toolById(state.blockToolId) : undefined),
    [state.blockToolId],
  );

  const cuttingTool = useMemo(
    () => (state.cuttingToolId !== null ? toolById(state.cuttingToolId) : undefined),
    [state.cuttingToolId],
  );

  /** Chain components, machine side first, from real joint frames. */
  const chain = useMemo<ChainComponent[]>(() => {
    if (cuttingTool === undefined) return [];
    return chainFor(cuttingTool, blockTool ?? null);
  }, [cuttingTool, blockTool]);

  const measuredStackUpMmValue = useMemo(
    () => measuredStackUpMm(chain),
    [chain],
  );

  const rows = useMemo<AssemblyRow[]>(() => {
    const blockComponent = chain.find((component) => component.role === "block");
    const holderComponent = chain.find((component) => component.role === "holder");

    const blockRow = rowFor(
      "block",
      blockTool ?? (cuttingTool?.block != null ? cuttingTool : undefined),
      blockComponent,
      cuttingTool?.block?.transformOverride != null,
    );

    // A tool that already carries a block should show the block's own name.
    if (blockTool === undefined && cuttingTool?.block != null) {
      blockRow.name = cuttingTool.block.description || "Tool block";
      blockRow.type = "tool block";
      blockRow.vendor = cuttingTool.block.vendor;
      blockRow.toolId = cuttingTool.id;
    }

    return [blockRow, rowFor("holder", cuttingTool, holderComponent, false)];
  }, [chain, blockTool, cuttingTool]);

  const selectedTool = useMemo(() => {
    if (state.selectedRowId === "block") return blockTool ?? undefined;
    if (state.selectedRowId === "holder") return cuttingTool ?? undefined;
    return undefined;
  }, [state.selectedRowId, blockTool, cuttingTool]);

  const selectLibrary = useCallback((libraryId: string) => {
    setState((prev) => ({
      ...prev,
      libraryId,
      blockToolId: null,
      cuttingToolId: null,
      selectedRowId: null,
      validationStatus: "idle",
      validationIssues: [],
    }));
  }, []);

  const selectRow = useCallback((id: ComponentRole) => {
    setState((prev) => ({ ...prev, selectedRowId: id }));
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

  /** Choose the tool block that seats against the turret face. */
  const selectToolBlock = useCallback((toolId: string | null) => {
    setState((prev) => {
      if (toolId === null) {
        return {
          ...prev,
          blockToolId: null,
          selectedRowId: prev.selectedRowId === "block" ? null : prev.selectedRowId,
          currentStep: "select-block",
          completedSteps: prev.completedSteps.filter((step) => step !== "select-block"),
          validationStatus: "idle",
          validationIssues: [],
        };
      }

      const block = toolById(toolId);
      if (block === undefined) return prev;

      return {
        ...prev,
        libraryId: block.libraryId,
        blockToolId: block.id,
        selectedRowId: "block",
        config: { ...prev.config, ...configFromBlock(block) },
        currentStep: prev.cuttingToolId === null ? "select-tool" : prev.currentStep,
        completedSteps: prev.completedSteps.includes("select-block")
          ? prev.completedSteps
          : [...prev.completedSteps, "select-block"],
        generalInfo: {
          ...prev.generalInfo,
          vendor: block.vendor || prev.generalInfo.vendor,
          productId: block.productId || prev.generalInfo.productId,
        },
        validationStatus: "idle",
        validationIssues: [],
      };
    });
  }, []);

  /** Choose the cutting tool that will own the block. */
  const selectCuttingTool = useCallback((toolId: string | null) => {
    setState((prev) => {
      if (toolId === null) {
        return {
          ...prev,
          cuttingToolId: null,
          selectedRowId: prev.selectedRowId === "holder" ? null : prev.selectedRowId,
          validationStatus: "idle",
          validationIssues: [],
        };
      }

      const tool = toolById(toolId);
      if (tool === undefined) return prev;

      // A tool that already carries a block brings its own block settings.
      const blockConfig =
        tool.block !== null
          ? {
              stationNumber: tool.block.postProcess.stationNumber,
              halfIndex: tool.block.postProcess.halfIndex === true,
            }
          : {};

      return {
        ...prev,
        libraryId: tool.libraryId,
        cuttingToolId: tool.id,
        selectedRowId: "holder",
        config: { ...prev.config, ...blockConfig },
        currentStep: "configure",
        completedSteps: prev.completedSteps.includes("select-tool")
          ? prev.completedSteps
          : [...prev.completedSteps, "select-tool"],
        generalInfo: {
          ...prev.generalInfo,
          description: prev.generalInfo.description || displayName(tool),
          vendor: tool.vendor || prev.generalInfo.vendor,
          productId: tool.productId || prev.generalInfo.productId,
        },
        validationStatus: "idle",
        validationIssues: [],
      };
    });
  }, []);

  /** Load an assembly that already exists in the library. */
  const loadExistingAssembly = useCallback((toolId: string) => {
    setState((prev) => {
      const tool = toolById(toolId);
      if (tool === undefined || tool.block === null) return prev;

      return {
        ...prev,
        libraryId: tool.libraryId,
        blockToolId: null,
        cuttingToolId: tool.id,
        selectedRowId: "holder",
        config: {
          ...prev.config,
          stationNumber: tool.block.postProcess.stationNumber,
          halfIndex: tool.block.postProcess.halfIndex === true,
        },
        currentStep: "configure",
        completedSteps: ["select-block", "select-tool"],
        generalInfo: {
          ...prev.generalInfo,
          description: displayName(tool),
          vendor: tool.vendor,
          productId: tool.productId,
        },
        validationStatus: "idle",
        validationIssues: [],
      };
    });
  }, []);

  const runValidate = useCallback(() => {
    setState((prev) => {
      const { status, issues } = runValidation(rows, measuredStackUpMmValue, prev.config);
      const completed: WorkflowStepId[] = [...prev.completedSteps];
      if (!completed.includes("configure")) completed.push("configure");
      if (status !== "fail" && !completed.includes("validate")) completed.push("validate");

      return {
        ...prev,
        validationStatus: status,
        validationIssues: issues,
        currentStep: status === "fail" ? "validate" : "review",
        completedSteps: completed,
      };
    });
  }, [rows, measuredStackUpMmValue]);

  const goToStep = useCallback((step: WorkflowStepId) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const advanceStep = useCallback(() => {
    setState((prev) => {
      const next = WORKFLOW_STEPS[getStepIndex(prev.currentStep) + 1];
      if (next === undefined) return prev;
      return {
        ...prev,
        currentStep: next.id,
        completedSteps: prev.completedSteps.includes(prev.currentStep)
          ? prev.completedSteps
          : [...prev.completedSteps, prev.currentStep],
      };
    });
  }, []);

  const resetWorkflow = useCallback(() => {
    setState(createInitialState());
  }, []);

  return {
    state,
    rows,
    chain,
    measuredStackUpMm: measuredStackUpMmValue,
    availableBlocks,
    availableTools,
    blockTool,
    cuttingTool,
    selectedTool,
    isTurningTool: cuttingTool !== undefined && isTurningType(cuttingTool.type),
    selectLibrary,
    selectRow,
    selectToolBlock,
    selectCuttingTool,
    loadExistingAssembly,
    setActiveTab,
    updateConfig,
    updateGeneralInfo,
    runValidate,
    goToStep,
    advanceStep,
    resetWorkflow,
  };
}
