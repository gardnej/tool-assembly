import type { MouseEvent } from "react";
import { AssemblyGrid } from "./AssemblyGrid";
import { ConfigurationPanel } from "./ConfigurationPanel";
import { DialogTabs } from "./DialogTabs";
import { GeneralTab } from "./GeneralTab";
import { Header } from "./Header";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { ReviewPanel } from "./ReviewPanel";
import { ToolAssemblyCanvas } from "./ToolAssemblyCanvas";
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
    holderRow,
    selectedAssemblyComponent,
    assemblyComponents,
    selectAssemblyItem,
    setActiveTab,
    updateConfig,
    updateGeneralInfo,
    addToAssembly,
    runValidate,
    goToStep,
    resetWorkflow,
  } = useToolAssemblyWorkflow();

  const configComponent = selectedAssemblyComponent;
  const showReview = state.currentStep === "review";
  const showValidation =
    state.currentStep === "validate" || state.validationIssues.length > 0;
  const selectedPreviewId = selectedAssemblyComponent?.id;

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
                  holderRow={holderRow}
                  slots={state.slots}
                  selectedId={state.selectedAssemblyId}
                  onSelectRow={selectAssemblyItem}
                  onSelectSlot={selectAssemblyItem}
                />

                {!showReview && (
                  <ConfigurationPanel
                    component={configComponent}
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
                    holderRow={holderRow}
                    slots={state.slots}
                    config={state.config}
                    components={assemblyComponents}
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
            components={assemblyComponents}
            selectedComponentId={selectedPreviewId}
            highlightSlots={
              state.currentStep === "add-insert" || state.currentStep === "configure"
            }
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
                  addToAssembly();
                }
              }}
            >
              {state.currentStep === "review" ? "Save Assembly" : "OK"}
            </PrimaryButton>
            <SecondaryButton onClick={handleCancel}>Cancel</SecondaryButton>
          </div>
        </footer>
      </section>
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
