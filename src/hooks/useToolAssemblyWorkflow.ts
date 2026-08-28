import { useCallback, useMemo, useState } from "react";
import {
  emptySlot,
  insertSlotComponent,
  moveSlot,
  runValidation,
  setSlotComponent,
  slotAccepts,
  slotIsOccupied,
  slotKind,
  slotStation,
  swapStackItems,
  syncSlotCount,
} from "../data/assembly";
import {
  adaptiveItems,
  cuttingTools,
  derivedBlocks,
  displayName,
  framesFor,
  gaugeLengthsMm,
  isHalfIndex,
  isTurningType,
  LIBRARIES,
  measuredStackUpMm,
  missingFrameLabel,
  solidSpanMm,
  stackChain,
  stationNumber,
  storedGaugeLengthMm,
  toolBlocks,
  toolById,
  type ChainComponent,
  type LibraryToolRecord,
  type NestedBlock,
} from "../data/realLibrary";
import { getStepIndex, WORKFLOW_STEPS } from "../data/workflowSteps";
import {
  removeSessionAssembly,
  sessionAssemblies,
  sessionAssemblyById,
  upsertSessionAssembly,
  upsertSessionLibrary,
} from "../data/libraryEdits";
import type { SavedAssembly } from "../types";
import { useLibraryRevision } from "./useLibraryRevision";
import { slotRowId } from "../types";
import type {
  AssemblyConfig,
  AssemblyRow,
  AssemblySlot,
  Orientation,
  RowId,
  SlotLevel,
  WorkflowState,
  WorkflowStepId,
} from "../types";

/**
 * Libraries whose components are trusted implicitly.
 *
 * The 3X Axial exports don't carry MCS/CSW joint frames yet, but Fusion is
 * fine with them — treat any assembly built entirely from these libraries as
 * valid without running the joint-frame checks.
 */
const THREE_X_AXIAL_LIBRARY_IDS = new Set(["3x-axial", "3x-axial-1"]);

/** Id of the User Libraries → Documents library that holds saved assemblies. */
const SAVED_ASSEMBLIES_LIBRARY_ID = "documents-saved-assemblies";
/** Id of the 3X Axial 1 library, the second target for saved assemblies. */
const AXIAL_1_LIBRARY_ID = "3x-axial-1";
/** Id of the prototype Team Hub library, seeded in ``libraryEdits.ts``. */
const HUB_LIBRARY_ID = "hub-team";

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

/**
 * Number of tools a block record declares.
 *
 * Fusion's data model treats one ``tool block`` record as a single adaptive-
 * item mount, so a physical three-position block is normally stored as three
 * separate records. Some imported libraries carry the whole multi-seat block
 * under one record instead — the description names the count (``3X Axial``,
 * ``2X Radial``) even though ``numberOfTools`` still reads ``1``. Until the
 * source data is updated, this reads the prefix as the count for records that
 * would otherwise offer one slot for a visibly multi-seat block.
 */
function declaredNumberOfTools(block: LibraryToolRecord): number {
  const declared = readNumber(block.geometry, "numberOfTools", 1);
  if (declared > 1) return declared;

  const prefix = /^(\d+)\s*X\b/i.exec(block.description);
  if (prefix !== null) {
    const count = Number(prefix[1]);
    if (Number.isFinite(count) && count >= 1) return count;
  }

  return declared;
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
    numberOfTools: declaredNumberOfTools(block),
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
    slots: [emptySlot()],
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
    editingAssemblyId: null,
  };
}

const EMPTY_BLOCK_ROW: AssemblyRow = {
  id: "block",
  role: "block",
  slotIndex: null,
  depth: null,
  level: null,
  accepts: [],
  toolId: null,
  name: "",
  type: "",
  vendor: "",
  spanMm: null,
  gaugeLengthMm: null,
  missingFrame: null,
  hasTransformOverride: false,
  stationNumber: null,
  halfIndex: false,
  stationFollowsOrder: false,
};

/**
 * The parent row, read back out of whichever block the occupants carry.
 *
 * It has no gauge length of its own: the block is the mount that everything else
 * is measured from, not something mounted on it.
 */
function blockRowFrom(
  derived: NestedBlock | null,
  fallback: LibraryToolRecord | undefined,
  toolId: string | null,
): AssemblyRow {
  if (derived === null && fallback === undefined) return EMPTY_BLOCK_ROW;

  const geometryId = derived?.geometryId ?? fallback?.geometryId ?? null;
  const component: ChainComponent = {
    role: "block",
    name: "",
    geometryId,
    frames: framesFor(geometryId),
    spanMm: solidSpanMm(geometryId),
  };

  const name =
    derived !== null
      ? derived.description || derived.stepFileName || "Tool block"
      : displayName(fallback as LibraryToolRecord);

  return {
    ...EMPTY_BLOCK_ROW,
    toolId,
    name,
    type: "tool block",
    vendor: derived?.vendor ?? fallback?.vendor ?? "",
    spanMm: component.spanMm,
    missingFrame: missingFrameLabel(component),
    hasTransformOverride: derived?.transformOverride != null,
  };
}

/**
 * The rows of one position: what it holds, in mounting order, and — while it can
 * still take something — one open row offering whatever fits next.
 *
 * The order is not fixed. A position that holds a cutting tool directly is one
 * row and is finished; one that holds an extension offers a collet or a tool
 * after it. Every step is measured through the one chain, so a gap anywhere
 * leaves all of them unmeasured together.
 */
function slotRowsFrom(
  slot: AssemblySlot,
  index: number,
  stack: (LibraryToolRecord | undefined)[],
  blockOverride: LibraryToolRecord | null,
): AssemblyRow[] {
  // Whatever seats in the position declares the station the position sits in.
  // Reading it back rather than using the copy taken when it was chosen means
  // editing the record in the library moves the position.
  const occupant = stack[0];
  const declared = occupant === undefined ? null : stationNumber(occupant);

  const base = (depth: number, accepts: SlotLevel[]): AssemblyRow => ({
    id: slotRowId(index, depth),
    role: "holder",
    slotIndex: index,
    depth,
    level: null,
    accepts,
    toolId: null,
    name: "",
    type: "",
    vendor: "",
    spanMm: null,
    gaugeLengthMm: null,
    missingFrame: null,
    hasTransformOverride: false,
    // The position's station belongs to the position, so it shows on its row.
    stationNumber: depth === 0 ? declared ?? slotStation(slot, index) : null,
    halfIndex: occupant !== undefined ? isHalfIndex(occupant) : slot.halfIndex,
    stationFollowsOrder: declared === null && slot.stationNumber === null,
  });

  const chosen = stack.filter(
    (record): record is LibraryToolRecord => record !== undefined,
  );
  const components = stackChain(chosen, blockOverride);
  const gauges = gaugeLengthsMm(components);
  // The chain leads with the block, so the stack starts one along from it.
  const offset = components.length - chosen.length;

  const kinds: SlotLevel[] = [];
  const rows: AssemblyRow[] = [];

  chosen.forEach((record, depth) => {
    const at = offset + depth;
    // A filled row can be swapped for anything that could have gone there.
    rows.push({
      ...base(depth, slotAccepts(kinds)),
      level: slotKind(record),
      toolId: record.id,
      name: displayName(record),
      type: record.type,
      vendor: record.vendor,
      spanMm: components[at]?.spanMm ?? null,
      // Prefer Fusion's own assemblyGaugeLength / holder gauge from the record;
      // fall back to what the joint-frame chain measured. Modern mill-drill
      // libraries carry the number directly and rarely ship joint frames.
      gaugeLengthMm: storedGaugeLengthMm(record) ?? gauges[at] ?? null,
      // A record that carries its own gauge length does not need joint frames
      // to be measurable — Fusion has already done that measurement — so the
      // missing-frame warning is only reported when there is no other way to
      // reach the component's position along the chain.
      missingFrame:
        storedGaugeLengthMm(record) !== null || components[at] === undefined
          ? null
          : missingFrameLabel(components[at]),
    });
    kinds.push(slotKind(record));
  });

  const next = slotAccepts(kinds);
  if (next.length > 0) rows.push(base(chosen.length, next));

  return rows;
}

export function useToolAssemblyWorkflow() {
  const [state, setState] = useState<WorkflowState>(createInitialState);
  // Records are read straight out of the library, so an edit made there has to
  // pull the assembly through again.
  const editRevision = useLibraryRevision();

  const availableBlocks = useMemo(
    () => toolBlocks(state.libraryId),
    [state.libraryId, editRevision],
  );

  const blockTool = useMemo(
    () => (state.blockToolId !== null ? toolById(state.blockToolId) : undefined),
    [state.blockToolId, editRevision],
  );

  /** What each position holds, machine side first. */
  const stacks = useMemo(
    () => state.slots.map((slot) => slot.stack.map((id) => toolById(id))),
    [state.slots, editRevision],
  );

  /**
   * What occupies each position: the first component of its stack, and so what
   * the parent block row is derived from.
   */
  const occupants = useMemo(() => stacks.map((stack) => stack[0]), [stacks]);

  /** Which kinds each position holds, for the viewer's per-seat bodies. */
  const slotFills = useMemo(
    () =>
      stacks.map((stack) => {
        const kinds = stack
          .filter((record): record is LibraryToolRecord => record !== undefined)
          .map(slotKind);
        return {
          extension: kinds.includes("extension"),
          collet: kinds.includes("collet"),
          tool: kinds.includes("tool"),
        };
      }),
    [stacks],
  );

  /** Parent blocks the occupants imply; a second entry is a conflict, not a tier. */
  const blocks = useMemo(() => derivedBlocks(occupants), [occupants]);

  /**
   * Library the slots draw their candidates from.
   *
   * The tool block is the root of the assembly, so its own library scopes what can
   * sit on it. Until a block is chosen there is nothing to derive from and the
   * default library stands in.
   */
  const scopeLibraryId = useMemo(() => {
    if (blockTool !== undefined) return blockTool.libraryId;
    const owner = blocks[0] !== undefined ? occupants[blocks[0].occupants[0]] : undefined;
    return owner?.libraryId ?? state.libraryId;
  }, [blockTool, blocks, occupants, state.libraryId]);

  const availableTools = useMemo(
    () => cuttingTools(scopeLibraryId),
    [scopeLibraryId, editRevision],
  );

  /** Candidates for each level of a position, since the levels take different parts. */
  const availableByLevel = useMemo<Record<SlotLevel, LibraryToolRecord[]>>(
    () => ({
      extension: adaptiveItems("extension", scopeLibraryId),
      collet: adaptiveItems("collet", scopeLibraryId),
      tool: availableTools,
    }),
    [scopeLibraryId, availableTools, editRevision],
  );

  const rows = useMemo<AssemblyRow[]>(() => {
    const derived = blocks[0]?.block ?? null;
    // The derived block belongs to its first occupant, so that tool is what the
    // block row selects and edits.
    const owner =
      blocks[0] !== undefined ? occupants[blocks[0].occupants[0]]?.id ?? null : null;

    return [
      blockRowFrom(derived, blockTool, owner ?? blockTool?.id ?? null),
      ...state.slots.flatMap((slot, index) =>
        slotRowsFrom(slot, index, stacks[index], blockTool ?? null),
      ),
    ];
  }, [blocks, occupants, stacks, state.slots, blockTool]);

  /**
   * Furthest the assembly reaches from the turret face, in millimetres.
   *
   * Several tools on one block give several chains rather than one, so the
   * overall stack-up is the longest of them.
   */
  const measuredStackUpMmValue = useMemo(() => {
    const lengths = stacks
      .map((stack) =>
        measuredStackUpMm(
          stackChain(
            stack.filter((item): item is LibraryToolRecord => item !== undefined),
            blockTool ?? null,
          ),
        ),
      )
      .filter((length): length is number => length !== null);
    return lengths.length === 0 ? null : Math.max(...lengths);
  }, [stacks, blockTool]);

  /** Chain of the first filled position, for the schematic. */
  const chain = useMemo<ChainComponent[]>(() => {
    const filled = stacks.find((stack) => stack[0] !== undefined);
    if (filled === undefined) return [];
    return stackChain(
      filled.filter((item): item is LibraryToolRecord => item !== undefined),
      blockTool ?? null,
    );
  }, [stacks, blockTool]);

  const selectedTool = useMemo(() => {
    const row = rows.find((item) => item.id === state.selectedRowId);
    if (row === undefined) return undefined;
    if (row.slotIndex !== null && row.depth !== null) {
      return stacks[row.slotIndex]?.[row.depth];
    }
    // A derived block lives inside the record that carries it, so that record is
    // what the block row reads its library facts from.
    if (blockTool !== undefined) return blockTool;
    return row.toolId !== null ? toolById(row.toolId) : undefined;
  }, [rows, state.selectedRowId, stacks, blockTool, editRevision]);

  const selectLibrary = useCallback((libraryId: string) => {
    setState((prev) => ({
      ...prev,
      libraryId,
      blockToolId: null,
      slots: prev.slots.map(() => emptySlot()),
      selectedRowId: null,
      validationStatus: "idle",
      validationIssues: [],
    }));
  }, []);

  const selectRow = useCallback((id: RowId) => {
    setState((prev) => ({ ...prev, selectedRowId: id }));
  }, []);

  const setActiveTab = useCallback((tab: WorkflowState["activeTab"]) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const updateConfig = useCallback((patch: Partial<AssemblyConfig>) => {
    setState((prev) => {
      const config = { ...prev.config, ...patch };
      return {
        ...prev,
        config,
        slots: syncSlotCount(prev.slots, config.numberOfTools),
        validationStatus: "idle",
      };
    });
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

      const config = { ...prev.config, ...configFromBlock(block) };

      return {
        ...prev,
        libraryId: block.libraryId,
        blockToolId: block.id,
        selectedRowId: "block",
        config,
        slots: syncSlotCount(prev.slots, config.numberOfTools),
        currentStep: prev.slots.some(slotIsOccupied)
          ? prev.currentStep
          : "select-tool",
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

  /**
   * Splice a component into a position at ``depth``, pushing the rest down.
   *
   * Wraps ``insertSlotComponent`` so callers do not have to resolve the id
   * themselves. Nothing happens when the id does not resolve or when the rules
   * reject the insertion — the workflow keeps the previous state.
   */
  const insertSlotTool = useCallback(
    (index: number, depth: number, toolId: string) => {
      setState((prev) => {
        const tool = toolById(toolId);
        if (tool === undefined) return prev;

        const slots = insertSlotComponent(prev.slots, index, depth, tool);
        if (slots === prev.slots) return prev;

        return {
          ...prev,
          libraryId: tool.libraryId,
          slots,
          selectedRowId: slotRowId(index, depth),
          currentStep: "configure",
          completedSteps: prev.completedSteps.includes("select-tool")
            ? prev.completedSteps
            : [...prev.completedSteps, "select-tool"],
          validationStatus: "idle",
          validationIssues: [],
        };
      });
    },
    [],
  );

  /** Put a component at one step of a position, or clear that step. */
  const selectSlotTool = useCallback(
    (index: number, depth: number, toolId: string | null) => {
    setState((prev) => {
      const tool = toolId === null ? null : toolById(toolId) ?? null;
      if (toolId !== null && tool === null) return prev;

      const slots = setSlotComponent(prev.slots, index, depth, tool);
      if (slots === prev.slots) return prev;

      if (tool === null) {
        return {
          ...prev,
          slots,
          validationStatus: "idle",
          validationIssues: [],
        };
      }

      return {
        ...prev,
        libraryId: tool.libraryId,
        slots,
        selectedRowId: slotRowId(index, depth),
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
    },
    [],
  );

  /** Move a position, taking its station rather than carrying one along. */
  const moveSlotBy = useCallback((index: number, delta: number) => {
    setState((prev) => {
      const slots = moveSlot(prev.slots, index, delta);
      if (slots === prev.slots) return prev;
      return {
        ...prev,
        slots,
        selectedRowId: `slot-${index + delta}`,
        validationStatus: "idle",
        validationIssues: [],
      };
    });
  }, []);

  /**
   * Swap two neighbouring components inside one position's stack.
   *
   * The reordered stack must still pass the acceptance rules; if it would
   * strand a collet above an extension the swap is refused and the arrows
   * appear disabled next time the button state is recomputed.
   */
  const swapStackItemBy = useCallback(
    (index: number, depth: number, delta: number) => {
      setState((prev) => {
        const slots = swapStackItems(prev.slots, index, depth, delta);
        if (slots === prev.slots) return prev;
        return {
          ...prev,
          slots,
          selectedRowId: slotRowId(index, depth + delta),
          validationStatus: "idle",
          validationIssues: [],
        };
      });
    },
    [],
  );

  /**
   * Empty a position's stack, leaving the row itself in place.
   *
   * The row stays so the user can pick a new stack for it without having to
   * add a fresh position back onto the block. Nothing about ``numberOfTools``
   * changes.
   */
  const removeSlotAt = useCallback((index: number) => {
    setState((prev) => {
      if (index < 0 || index >= prev.slots.length) return prev;
      const current = prev.slots[index];
      if (current.stack.length === 0 && current.stationNumber === null) {
        return prev;
      }
      const slots = [...prev.slots];
      slots[index] = { ...current, stack: [], stationNumber: null, halfIndex: false };
      return {
        ...prev,
        slots,
        selectedRowId: `slot-${index}`,
        validationStatus: "idle",
        validationIssues: [],
      };
    });
  }, []);

  /** Load an assembly that already exists in the library into the first position. */
  const loadExistingAssembly = useCallback((toolId: string) => {
    setState((prev) => {
      const tool = toolById(toolId);
      if (tool === undefined || tool.block === null) return prev;

      return {
        ...prev,
        libraryId: tool.libraryId,
        blockToolId: null,
        slots: setSlotComponent(prev.slots, 0, 0, tool),
        selectedRowId: "slot-0",
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
      // Assemblies drawn entirely from the 3X Axial libraries skip validation:
      // those exports don't carry MCS/CSW joint frames yet, so the block would
      // never pass the frame check even though Fusion accepts them fine.
      const occupied = prev.slots.filter(slotIsOccupied);
      const occupantIds = occupied.flatMap((slot) => slot.stack);
      const blockRow = rows.find((row) => row.role === "block");
      const allIds = blockRow?.toolId ? [blockRow.toolId, ...occupantIds] : occupantIds;
      const usesAxialOnly =
        allIds.length > 0 &&
        allIds.every((id) => {
          const record = toolById(id);
          return record !== undefined && THREE_X_AXIAL_LIBRARY_IDS.has(record.libraryId);
        });

      const { status, issues } = usesAxialOnly
        ? { status: "pass" as const, issues: [] }
        : runValidation({
            rows,
            slots: prev.slots,
            blocks,
            config: prev.config,
            measuredMm: measuredStackUpMmValue,
          });
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
  }, [rows, blocks, measuredStackUpMmValue]);

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

  /**
   * Save the current assembly into the User Libraries.
   *
   * The whole chain — block, stacks, config, general info — is written as one
   * ``SavedAssembly`` record per target library. Editing it later reopens the
   * workflow in the exact same state, and the library dialog uses the same
   * record to render the accordion under the assembly.
   *
   * When ``editingAssemblyId`` is set the record replaces the one saved under
   * that id (an in-place edit); otherwise a fresh id is minted.
   *
   * Returns the ids and libraries the assembly was written to, or ``null``
   * if there was nothing to save.
   */
  const saveAssembly = useCallback((): {
    baseId: string;
    hubAssemblyId: string;
    hubLibraryId: string;
  } | null => {
    const occupied = state.slots.filter(slotIsOccupied);
    if (occupied.length === 0) return null;

    const blockRow = rows.find((row) => row.role === "block");
    const blockRecord = blockRow?.toolId ? toolById(blockRow.toolId) : undefined;

    // Ensure the Documents-side library exists before writing anything.
    upsertSessionLibrary({
      id: SAVED_ASSEMBLIES_LIBRARY_ID,
      name: "Saved Assemblies",
      folder: null,
      breadcrumb: "User Libraries > Documents > Saved Assemblies",
      version: null,
      toolCount: 0,
      blockCount: 0,
      assemblyCount: 0,
      parent: "documents",
    });

    const name = state.generalInfo.description.trim() ||
      blockRecord?.description ||
      "Tool Assembly";

    // The two library copies share a base id so we can find and replace them
    // together on a subsequent edit.
    const editingBase = state.editingAssemblyId;
    if (editingBase !== null) {
      for (const record of sessionAssemblies()) {
        if (
          record.id === editingBase ||
          record.id.startsWith(`${editingBase}-`)
        ) {
          removeSessionAssembly(record.id);
        }
      }
    }
    const baseId = editingBase ?? `assembly-${Date.now()}`;

    const slotSnapshot = state.slots.map((slot) => ({
      stack: [...slot.stack],
      stationNumber: slot.stationNumber,
      halfIndex: slot.halfIndex,
    }));

    const writeTo = (libraryId: string, suffix: string): void => {
      const record: SavedAssembly = {
        id: `${baseId}-${suffix}`,
        libraryId,
        name,
        vendor: state.generalInfo.vendor,
        productId: state.generalInfo.productId,
        productLink: state.generalInfo.productLink,
        blockToolId: state.blockToolId,
        slots: slotSnapshot,
        config: { ...state.config },
        createdAt: Date.now(),
      };
      upsertSessionAssembly(record);
    };

    writeTo(SAVED_ASSEMBLIES_LIBRARY_ID, "docs");
    writeTo(AXIAL_1_LIBRARY_ID, "axial1");
    writeTo(HUB_LIBRARY_ID, "hub");
    return {
      baseId,
      hubAssemblyId: `${baseId}-hub`,
      hubLibraryId: HUB_LIBRARY_ID,
    };
  }, [state, rows]);

  /**
   * Reopen a saved assembly in the workflow.
   *
   * Restores the block, every position's stack, the config and the general
   * info from the record. The originating assembly id is remembered on the
   * state so the next save replaces this record rather than creating a
   * new one.
   */
  const loadAssembly = useCallback((assemblyId: string): boolean => {
    const record = sessionAssemblyById(assemblyId);
    if (record === undefined) return false;

    // Copies of every assembly are written to each target library, sharing a
    // base id with per-library suffixes. Editing tracks the base so a resave
    // replaces all of them.
    const editingBase = assemblyId.replace(/-(docs|axial1|hub)$/, "");

    setState((prev) => ({
      ...prev,
      currentStep: "configure",
      completedSteps: ["select-block", "select-tool", "configure"],
      libraryId: record.blockToolId
        ? toolById(record.blockToolId)?.libraryId ?? prev.libraryId
        : prev.libraryId,
      blockToolId: record.blockToolId,
      slots: record.slots.map((slot) => ({
        stack: [...slot.stack],
        stationNumber: slot.stationNumber,
        halfIndex: slot.halfIndex,
      })),
      selectedRowId: null,
      config: { ...record.config },
      validationStatus: "idle",
      validationIssues: [],
      generalInfo: {
        description: record.name,
        vendor: record.vendor,
        productId: record.productId,
        productLink: record.productLink,
      },
      editingAssemblyId: editingBase,
    }));
    return true;
  }, []);

  const firstOccupant = occupants.find((tool) => tool !== undefined);

  return {
    state,
    rows,
    chain,
    blocks,
    slotFills,
    measuredStackUpMm: measuredStackUpMmValue,
    scopeLibraryId,
    availableBlocks,
    availableTools,
    availableByLevel,
    blockTool,
    selectedTool,
    isTurningTool: firstOccupant !== undefined && isTurningType(firstOccupant.type),
    selectLibrary,
    selectRow,
    selectToolBlock,
    selectSlotTool,
    insertSlotTool,
    moveSlotBy,
    swapStackItemBy,
    removeSlotAt,
    loadExistingAssembly,
    setActiveTab,
    updateConfig,
    updateGeneralInfo,
    runValidate,
    goToStep,
    advanceStep,
    saveAssembly,
    loadAssembly,
    resetWorkflow,
  };
}
