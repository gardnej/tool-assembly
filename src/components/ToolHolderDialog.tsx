import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { libraries } from "../data/realLibrary";
import type { RowId, SlotLevel } from "../types";
import { AssemblyGrid } from "./AssemblyGrid";
import { AssemblyViewer } from "./AssemblyViewer";
import { ConfigurationPanel } from "./ConfigurationPanel";
import { DialogTabs } from "./DialogTabs";
import { GeneralTab } from "./GeneralTab";
import { Header } from "./Header";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { ReviewPanel } from "./ReviewPanel";
import { ToolLibraryDialog } from "./ToolLibraryDialog";
import { ValidationPanel } from "./ValidationPanel";
import { PrimaryButton } from "./buttons/PrimaryButton";
import { SecondaryButton } from "./buttons/SecondaryButton";
import { useHorizontalPanelResize } from "../hooks/useHorizontalPanelResize";
import { useToolAssemblyWorkflow } from "../hooks/useToolAssemblyWorkflow";
import "./tool-holder-dialog.css";

interface ToolHolderDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Id of a saved assembly to reopen for editing. When set (and different
   * from the last one seen), the workflow reloads its state from the
   * matching library record on the next mount/change.
   */
  editAssemblyId?: string | null;
}

export function ToolHolderDialog({
  open,
  onClose,
  editAssemblyId,
}: ToolHolderDialogProps) {
  const {
    state,
    rows,
    blocks,
    blockTool,
    slotFills,
    measuredStackUpMm,
    scopeLibraryId,
    availableBlocks,
    availableTools,
    availableByLevel,
    selectedTool,
    selectLibrary,
    selectRow,
    selectToolBlock,
    selectSlotTool,
    insertSlotTool,
    moveSlotBy,
    removeSlotAt,
    setActiveTab,
    updateConfig,
    updateGeneralInfo,
    runValidate,
    goToStep,
    advanceStep,
    saveAssembly,
    loadAssembly,
    resetWorkflow,
  } = useToolAssemblyWorkflow();

  // Pull a saved assembly into the workflow whenever the parent hands one in.
  useEffect(() => {
    if (open && editAssemblyId !== null && editAssemblyId !== undefined) {
      loadAssembly(editAssemblyId);
    }
  }, [open, editAssemblyId, loadAssembly]);

  /**
   * Which row the library picker is filling, or null when it is closed.
   *
   * ``mode`` says whether picking replaces the row's occupant, splices a new
   * one in above it (making it deeper) or below it (pushing the rest down).
   * A block row only supports replacement, since a block sits at the root.
   */
  const [pickerTarget, setPickerTarget] = useState<
    { id: RowId; mode: "replace" | "insertAbove" | "insertBelow" } | null
  >(null);
  /** Library record the properties panel sent us to edit, or null when closed. */
  const [editToolId, setEditToolId] = useState<string | null>(null);
  const pickerRow = rows.find((row) => row.id === pickerTarget?.id);
  const pickerSlot = pickerRow?.slotIndex ?? null;

  /** Part the viewer highlights: the selected row, mapped back to the mesh. */
  const selectedRow = rows.find((row) => row.id === state.selectedRowId);
  const selectedViewerPart =
    selectedRow?.slotIndex != null && selectedRow.level !== null
      ? { slotIndex: selectedRow.slotIndex, level: selectedRow.level }
      : null;

  /**
   * Which row a picked part of the mesh belongs to.
   *
   * The mesh has a seat for each kind, while a position holds only what was put
   * in it, so a part with nothing behind it selects the position instead.
   */
  const rowIdAt = useCallback(
    (slotIndex: number, level: SlotLevel): RowId | null => {
      const row = rows.find(
        (item) => item.slotIndex === slotIndex && item.level === level,
      );
      return row?.id ?? (slotIndex < state.slots.length ? `slot-${slotIndex}` : null);
    },
    [rows, state.slots.length],
  );

  const showReview = state.currentStep === "review";
  const showValidation =
    state.currentStep === "validate" || state.validationIssues.length > 0;

  const {
    containerRef,
    leftPanelStyle,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = useHorizontalPanelResize({ initialRatio: 0.42, minLeftPx: 320, minRightPx: 280 });

  if (!open) {
    return null;
  }

  const handleCancel = () => {
    resetWorkflow();
    onClose();
  };

  const handleBackdropMouseDown = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  const stopDialogMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="tl-overlay"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        className="tl-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Turning tool holder"
        onMouseDown={stopDialogMouseDown}
      >
        <Header />
        <DialogTabs activeTab={state.activeTab} onTabChange={setActiveTab} />

        <div ref={containerRef} className="tl-dialog__body">
          <div
            className="tl-dialog__panel min-h-0 min-w-0 shrink-0 overflow-y-auto bg-weave-dialog px-8 py-4"
            style={leftPanelStyle}
          >
            {state.activeTab === "general" && (
              <GeneralTab
                generalInfo={state.generalInfo}
                onChange={updateGeneralInfo}
              />
            )}

            {state.activeTab === "assembly" && (
              <div className="space-y-4">
                <AssemblyGrid
                  rows={rows}
                  selectedId={state.selectedRowId}
                  libraries={libraries()}
                  libraryId={state.libraryId}
                  availableBlocks={availableBlocks}
                  availableTools={availableTools}
                  availableByLevel={availableByLevel}
                  onSelectRow={selectRow}
                  onSelectLibrary={selectLibrary}
                  onSelectToolBlock={selectToolBlock}
                  onSelectSlotTool={selectSlotTool}
                  onMoveSlot={moveSlotBy}
                  onRemoveSlot={removeSlotAt}
                  onBrowseLibrary={(id, mode = "replace") =>
                    setPickerTarget({ id, mode })
                  }
                />

                {!showReview && (
                  <ConfigurationPanel
                    tool={selectedTool}
                    row={selectedRow}
                    config={state.config}
                    onConfigChange={updateConfig}
                    onEditInLibrary={setEditToolId}
                    onBrowse={() => {
                      if (selectedRow !== undefined) {
                        setPickerTarget({ id: selectedRow.id, mode: "replace" });
                      }
                    }}
                    onClear={() => {
                      if (selectedRow?.slotIndex != null && selectedRow.depth !== null) {
                        selectSlotTool(selectedRow.slotIndex, selectedRow.depth, null);
                      }
                    }}
                    readOnly={state.currentStep === "review"}
                  />
                )}

                {showValidation && !showReview && (
                  <ValidationPanel
                    status={state.validationStatus}
                    issues={state.validationIssues}
                    onValidate={runValidate}
                    onContinue={() => goToStep("review")}
                  />
                )}

                {showReview && (
                  <ReviewPanel
                    rows={rows}
                    config={state.config}
                    measuredStackUpMm={measuredStackUpMm}
                  />
                )}
              </div>
            )}

            {state.activeTab === "setup" && (
              <PlaceholderTab
                title="Setup"
                body="Machine setup parameters for this tool assembly would appear here."
              />
            )}

            {state.activeTab === "post-processor" && (
              <PlaceholderTab
                title="Post processor"
                body="Post processor mapping and output settings would appear here."
              />
            )}
          </div>

          <PanelResizeHandle
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          />

          <AssemblyViewer
            blockGeometryId={blocks[0]?.block.geometryId ?? blockTool?.geometryId ?? null}
            slots={slotFills}
            selected={selectedViewerPart}
            blockSelected={state.selectedRowId === "block"}
            selectedTool={selectedTool}
            rowIdAt={rowIdAt}
            onSelectRow={selectRow}
          />
        </div>

        <footer className="tl-dialog__footer flex h-9 shrink-0 items-center justify-between border-t border-weave-divider bg-weave-header px-4">
          <span className="text-[11px] text-weave-text-placeholder">v2.13.4 Online</span>
          <div className="flex gap-2">
            <PrimaryButton
              split
              onClick={() => {
                if (state.currentStep === "configure") {
                  goToStep("validate");
                } else if (state.currentStep === "validate") {
                  runValidate();
                } else if (state.currentStep === "review") {
                  const saved = saveAssembly();
                  if (saved === 0) {
                    alert("Nothing to save — mount a component in a position first.");
                  } else {
                    alert(
                      `Saved ${saved} assembly record${saved === 1 ? "" : "s"} to ` +
                        "User Libraries → Documents → Saved Assemblies and 3X Axial 1.",
                    );
                    onClose();
                  }
                } else {
                  advanceStep();
                }
              }}
            >
              {state.currentStep === "review" ? "Save Assembly" : "OK"}
            </PrimaryButton>
            <SecondaryButton onClick={handleCancel}>Cancel</SecondaryButton>
          </div>
        </footer>
      </section>

      {pickerTarget !== null && (
        <ToolLibraryDialog
          open
          picker
          initialLibraryId={scopeLibraryId}
          // A block seats against the turret; anything else is a cutting tool.
          pickKind={pickerSlot === null ? "block" : "tool"}
          onPick={(toolId) => {
            if (pickerSlot === null || pickerRow?.depth == null) {
              // Blocks always replace: there is no depth above the root.
              selectToolBlock(toolId);
            } else if (pickerTarget.mode === "insertAbove" && toolId !== null) {
              insertSlotTool(pickerSlot, pickerRow.depth, toolId);
            } else if (pickerTarget.mode === "insertBelow" && toolId !== null) {
              insertSlotTool(pickerSlot, pickerRow.depth + 1, toolId);
            } else {
              selectSlotTool(pickerSlot, pickerRow.depth, toolId);
            }
            setPickerTarget(null);
          }}
          onClose={() => setPickerTarget(null)}
        />
      )}

      {editToolId !== null && (
        <ToolLibraryDialog
          open
          initialToolId={editToolId}
          openEditor
          onClose={() => setEditToolId(null)}
        />
      )}
    </div>
  );
}

function PlaceholderTab({ title, body }: { title: string; body: string }) {
  return (
    <section className="py-2">
      <h3 className="mb-2 text-base font-semibold">{title}</h3>
      <p className="text-xs text-weave-text-placeholder">{body}</p>
    </section>
  );
}
