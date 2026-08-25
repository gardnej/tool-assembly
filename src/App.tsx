import { useCallback, useMemo, useState } from "react";
import { BrowserPanel } from "./components/BrowserPanel";
import { DocumentTabs } from "./components/DocumentTabs";
import { MenuBar } from "./components/MenuBar";
import { NewToolDialog } from "./components/NewToolDialog";
import { Ribbon } from "./components/Ribbon";
import { ToolHolderDialog } from "./components/ToolHolderDialog";
import { ToolLibraryDialog } from "./components/ToolLibraryDialog";
import { Viewport } from "./components/Viewport";
import {
  DEMO_BLOCK_DOCUMENT_TITLE,
  getViewportEmphasis,
} from "./data/demoBlockDesign";
import { defaultTabForWorkspace, type RibbonTabId, type RibbonWorkspaceId } from "./ribbonConfig";
import "./App.css";

export default function App() {
  const [ribbonWorkspace, setRibbonWorkspace] = useState<RibbonWorkspaceId>("manufacturing");

  const [ribbonTab, setRibbonTab] = useState<RibbonTabId>(() =>
    defaultTabForWorkspace("manufacturing"),
  );

  const [selectedBrowserId, setSelectedBrowserId] = useState<string>("body1");

  const [toolLibraryOpen, setToolLibraryOpen] = useState(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("toolLibrary") === "1",
  );

  const [newToolOpen, setNewToolOpen] = useState(false);
  const [toolHolderOpen, setToolHolderOpen] = useState(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("assembly") === "1",
  );
  /**
   * Assembly id passed to the workflow when the user picks Edit on a saved
   * assembly in the library dialog. Cleared once the dialog consumes it so a
   * fresh open goes back to a blank workflow.
   */
  const [editAssemblyId, setEditAssemblyId] = useState<string | null>(null);

  const handleRibbonWorkspaceChange = useCallback((w: RibbonWorkspaceId) => {
    setRibbonWorkspace(w);
    setRibbonTab(defaultTabForWorkspace(w));
  }, []);

  /**
   * Ribbon commands the prototype answers, keyed by Fusion's own command id.
   * The tool assembly dialog lives under Manage ▸ Solid Holder in the product,
   * so that is where it opens from here too.
   */
  const runRibbonCommand = useCallback(
    (commandId: string) => {
      switch (commandId) {
        case "IronToolLibrary":
          setToolLibraryOpen(true);
          break;
        case "IronToolAssembly":
        case "IronToolBlock":
        case "IronTurningToolHolder":
          setToolHolderOpen(true);
          break;
        default:
          break;
      }
    },
    [],
  );

  const closeToolLibrary = useCallback(() => {
    setToolLibraryOpen(false);
    setNewToolOpen(false);
    setToolHolderOpen(false);
  }, []);

  const openNewToolPicker = useCallback(() => {
    setNewToolOpen(true);
  }, []);

  const closeNewToolPicker = useCallback(() => {
    setNewToolOpen(false);
  }, []);

  const handleNewToolTypeSelect = useCallback((toolTypeId: string) => {
    if (toolTypeId === "tool-assembly") {
      setNewToolOpen(false);
      setToolHolderOpen(true);
    }
  }, []);

  const closeToolHolder = useCallback(() => {
    setToolHolderOpen(false);
    setEditAssemblyId(null);
  }, []);

  const openAssemblyEditor = useCallback((assemblyId: string) => {
    setEditAssemblyId(assemblyId);
    setToolLibraryOpen(false);
    setToolHolderOpen(true);
  }, []);

  const viewportEmphasis = useMemo(
    () => getViewportEmphasis(selectedBrowserId, null),
    [selectedBrowserId],
  );

  return (
    <>
      <div className="app-shell" data-fusion-prototype data-workspace={ribbonWorkspace}>
        <header className="app-shell__chrome">
          <MenuBar />
          <DocumentTabs documentTitle={DEMO_BLOCK_DOCUMENT_TITLE} />
          <Ribbon
            workspace={ribbonWorkspace}
            activeTab={ribbonTab}
            onWorkspaceChange={handleRibbonWorkspaceChange}
            onTabChange={setRibbonTab}
            onCommand={runRibbonCommand}
          />
        </header>
        <div className="app-shell__body">
          <aside className="app-shell__left">
            <BrowserPanel
              selectedId={selectedBrowserId}
              onSelect={(nodeId) => {
                setSelectedBrowserId(nodeId);
              }}
            />
          </aside>
          <main className="app-shell__center">
            <Viewport
              ribbonWorkspace={ribbonWorkspace}
              ribbonTab={ribbonTab}
              subtitle={viewportEmphasis.subtitle}
              blockAccentClass={viewportEmphasis.blockClass || undefined}
            />
          </main>
        </div>
      </div>

      <ToolLibraryDialog
        open={toolLibraryOpen}
        onClose={closeToolLibrary}
        onCreateTool={openNewToolPicker}
        onEditAssembly={openAssemblyEditor}
      />

      <NewToolDialog
        open={newToolOpen}
        onClose={closeNewToolPicker}
        onSelectToolType={handleNewToolTypeSelect}
      />

      <ToolHolderDialog
        open={toolHolderOpen}
        onClose={closeToolHolder}
        editAssemblyId={editAssemblyId}
      />
    </>
  );
}
