import { useState } from "react";
import type { MouseEvent } from "react";
import { LIBRARIES } from "../data/realLibrary";
import type { ComponentRole } from "../types";
import { AssemblyGrid } from "./AssemblyGrid";
import { ConfigurationPanel } from "./ConfigurationPanel";
import { DialogTabs } from "./DialogTabs";
import { GeneralTab } from "./GeneralTab";
import { Header } from "./Header";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { ReviewPanel } from "./ReviewPanel";
import { ToolAssemblyCanvas } from "./ToolAssemblyCanvas";
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
}

export function ToolHolderDialog({ open, onClose }: ToolHolderDialogProps) {
  const {
    state,
    rows,
    measuredStackUpMm,
    availableBlocks,
    availableTools,
    selectedTool,
    selectLibrary,
    selectRow,
    selectToolBlock,
    selectCuttingTool,
    setActiveTab,
    updateConfig,
    updateGeneralInfo,
    runValidate,
    goToStep,
    advanceStep,
    resetWorkflow,
  } = useToolAssemblyWorkflow();

  /** Which row the library picker is filling, or null when it is closed. */
  const [pickerRole, setPickerRole] = useState<ComponentRole | null>(null);

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
                  measuredStackUpMm={measuredStackUpMm}
                  libraries={LIBRARIES}
                  libraryId={state.libraryId}
                  availableBlocks={availableBlocks}
                  availableTools={availableTools}
                  onSelectRow={selectRow}
                  onSelectLibrary={selectLibrary}
                  onSelectToolBlock={selectToolBlock}
                  onSelectCuttingTool={selectCuttingTool}
                  onBrowseLibrary={setPickerRole}
                />

                {!showReview && (
                  <ConfigurationPanel
                    tool={selectedTool}
                    config={state.config}
                    onConfigChange={updateConfig}
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

          <ToolAssemblyCanvas
            rows={rows}
            selectedRole={state.selectedRowId}
            measuredStackUpMm={measuredStackUpMm}
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
                  alert("Assembly saved to tool library (prototype).");
                  onClose();
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

      {pickerRole !== null && (
        <ToolLibraryDialog
          open
          picker
          initialLibraryId={state.libraryId}
          // A block seats against the turret; anything else is a cutting tool.
          pickKind={pickerRole === "block" ? "block" : "tool"}
          onPick={(toolId) => {
            if (pickerRole === "block") {
              selectToolBlock(toolId);
            } else {
              selectCuttingTool(toolId);
            }
            setPickerRole(null);
          }}
          onClose={() => setPickerRole(null)}
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
