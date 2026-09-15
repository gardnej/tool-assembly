import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserPanel } from "./components/BrowserPanel";
import { ContextMenu, type ContextMenuItem } from "./components/ContextMenu";
import { DocumentTabs } from "./components/DocumentTabs";
import { MenuBar } from "./components/MenuBar";
import { NewToolDialog } from "./components/NewToolDialog";
import { Ribbon } from "./components/Ribbon";
import { SetupDialog } from "./components/SetupDialog";
import { ToolHolderDialog } from "./components/ToolHolderDialog";
import { ToolLibraryDialog } from "./components/ToolLibraryDialog";
import { TurretSetupDialog } from "./components/TurretSetupDialog";
import { Viewport } from "./components/Viewport";
import {
  browserRootWithTurret,
  DEMO_BLOCK_DOCUMENT_TITLE,
  getViewportEmphasis,
  TURRET_BROWSER_NODE_ID,
} from "./data/demoBlockDesign";
import turretGlbUrl from "./assets/models/turret-stations.glb?url";
import {
  assemblyBaseId,
  createDefaultTurretSetup,
  HAAS_ST_20Y,
  toolAssemblyOptions,
  turretSetups,
  setSelectedMachine,
  upsertTurretSetup,
} from "./data/turret";
import { sessionAssemblies, upsertSessionAssembly } from "./data/libraryEdits";
import { assemblyMount } from "./data/turretSolids";
import { useTurretRevision } from "./hooks/useTurretRevision";
import type { Machine, TurretSetup } from "./types";
import { defaultTabForWorkspace, type RibbonTabId, type RibbonWorkspaceId } from "./ribbonConfig";
import "./App.css";

function queryFlag(name: string): boolean {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get(name) === "1"
  );
}

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
  /**
   * Where the Tool Library dialog should open. Set by the assembly workflow
   * after a save so the library lands on the Hub copy of the assembly it
   * just wrote.
   */
  const [libraryTarget, setLibraryTarget] = useState<
    { libraryId: string; assemblyId: string } | null
  >(null);

  /* Turret setup -------------------------------------------------------- */

  const turretRev = useTurretRevision();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [turretSetup, setTurretSetup] = useState<TurretSetup | null>(null);
  const [setupDialogOpen, setSetupDialogOpen] = useState(() => queryFlag("setup"));
  const [turretDialogOpen, setTurretDialogOpen] = useState(false);
  const [turretVisible, setTurretVisible] = useState(true);
  const [contextMenu, setContextMenu] = useState<
    { x: number; y: number; nodeId: string } | null
  >(null);
  /** Station the assembly picker is choosing for; null when the picker is shut. */
  const [libraryPickStation, setLibraryPickStation] = useState<number | null>(null);
  /** Assembly the picker chose, handed to the turret dialog to apply. */
  const [pendingAssignment, setPendingAssignment] = useState<
    { stationNumber: number; toolAssemblyId: string; token: number } | null
  >(null);

  // Assemblies offered per station, refreshed when the user saves one.
  const assemblyOptions = useMemo(() => toolAssemblyOptions(), [turretRev]);
  const existingSetups = useMemo(() => turretSetups(), [turretRev]);
  // Open the assembly picker on a library that actually holds a saved assembly.
  const assemblyPickerLibraryId = useMemo(
    () => sessionAssemblies()[0]?.libraryId,
    [turretRev],
  );

  /** Ensure there is a working turret setup for the given machine. */
  const ensureTurretSetup = useCallback(
    (forMachine: Machine): TurretSetup => {
      if (turretSetup !== null && turretSetup.machineId === forMachine.id) {
        return turretSetup;
      }
      const created = createDefaultTurretSetup(forMachine);
      setTurretSetup(created);
      return created;
    },
    [turretSetup],
  );

  const confirmSetup = useCallback(
    (chosen: Machine | null) => {
      setMachine(chosen);
      setSelectedMachine(chosen?.id ?? null);
      if (chosen !== null) {
        ensureTurretSetup(chosen);
        setTurretVisible(true);
      }
      setSetupDialogOpen(false);
    },
    [ensureTurretSetup],
  );

  const openTurretDialog = useCallback(() => {
    if (machine === null) {
      // No machine yet — the turret comes from the Setup dialog first.
      setSetupDialogOpen(true);
      return;
    }
    ensureTurretSetup(machine);
    setTurretDialogOpen(true);
  }, [machine, ensureTurretSetup]);

  const confirmTurret = useCallback((next: TurretSetup) => {
    upsertTurretSetup(next);
    setTurretSetup(next);
    setTurretDialogOpen(false);
  }, []);

  const editMachineFromTurret = useCallback(() => {
    setTurretDialogOpen(false);
    setSetupDialogOpen(true);
  }, []);

  // Deep link: ?turretSetup=1 selects the client machine and opens the dialog.
  useEffect(() => {
    if (!queryFlag("turretSetup")) return;
    setMachine((prev) => prev ?? HAAS_ST_20Y);
    setSelectedMachine(HAAS_ST_20Y.id);
    setTurretSetup((prev) => prev ?? createDefaultTurretSetup(HAAS_ST_20Y));
    setTurretDialogOpen(true);
  }, []);

  // Deep link: ?demo=1 mounts a seatable sample assembly on station 1 straight
  // away — no dialog, no saved data needed — so the seating can be verified on
  // any fresh browser or origin. Seeds the assembly once if it is not present.
  useEffect(() => {
    if (!queryFlag("demo")) return;
    const seedBase = "demo-seatable";
    if (!sessionAssemblies().some((a) => assemblyBaseId(a.id) === seedBase)) {
      upsertSessionAssembly({
        id: `${seedBase}-hub`,
        libraryId: "hub-team",
        name: "3X Spot-Drill-Tap",
        vendor: "",
        productId: "",
        productLink: "",
        blockToolId: "preview-block-3x-spot-drill-tap",
        slots: [
          {
            stack: ["preview-extension-6", "preview-collet-6", "preview-tool-spot-drill"],
            stationNumber: null,
            halfIndex: false,
          },
          {
            stack: ["preview-extension-8", "preview-collet-8", "preview-tool-drill"],
            stationNumber: null,
            halfIndex: false,
          },
          {
            stack: ["preview-extension-10", "preview-collet-10", "preview-tool-tap"],
            stationNumber: null,
            halfIndex: false,
          },
        ],
        config: {
          orientation: "axial",
          machineSideConnectionType: "Unspecified",
          numberOfTools: 3,
          numberOfAttachmentPoints: 0,
          adaptiveItemSize: 0,
          stationNumber: null,
          halfIndex: false,
        },
        createdAt: Date.now(),
      });
    }
    setMachine((prev) => prev ?? HAAS_ST_20Y);
    setSelectedMachine(HAAS_ST_20Y.id);
    setTurretSetup((prev) => {
      if (prev !== null) return prev;
      const setup = createDefaultTurretSetup(HAAS_ST_20Y);
      return {
        ...setup,
        stations: setup.stations.map((s) =>
          s.stationNumber === 1 ? { ...s, toolAssemblyId: seedBase } : s,
        ),
      };
    });
    setTurretVisible(true);
  }, []);

  const handleBrowserContextMenu = useCallback(
    (nodeId: string, x: number, y: number) => {
      if (nodeId === TURRET_BROWSER_NODE_ID) {
        setContextMenu({ x, y, nodeId });
      }
    },
    [],
  );

  const handleBrowserActivate = useCallback(
    (nodeId: string) => {
      if (nodeId === TURRET_BROWSER_NODE_ID) openTurretDialog();
    },
    [openTurretDialog],
  );

  const handleBrowserVisibility = useCallback((nodeId: string, hidden: boolean) => {
    if (nodeId === TURRET_BROWSER_NODE_ID) setTurretVisible(!hidden);
  }, []);

  const browserRoot = useMemo(() => {
    if (machine === null) return undefined;
    return browserRootWithTurret(machine.name, turretSetup?.name ?? "Turret1");
  }, [machine, turretSetup]);

  /** Station numbers that currently have a tool assembly mounted. */
  const assignedStations = useMemo(
    () =>
      (turretSetup?.stations ?? [])
        .filter((station) => station.toolAssemblyId !== null)
        .map((station) => station.stationNumber),
    [turretSetup],
  );

  /**
   * Per-station real solids to show on the turret: for each assigned station,
   * the GLB of the assembly's own geometry when we ship one (else null, so the
   * viewport keeps the baked template). Recomputed when a save adds a solid.
   */
  const turretMounts = useMemo(
    () =>
      (turretSetup?.stations ?? [])
        .filter((station) => station.toolAssemblyId !== null)
        .map((station) => {
          const mount = assemblyMount(station.toolAssemblyId);
          return {
            stationNumber: station.stationNumber,
            solidUrl: mount?.url ?? null,
            keepMaterials: mount?.keepMaterials,
          };
        }),
    [turretSetup, turretRev],
  );

  const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (contextMenu === null) return [];
    return [
      {
        id: "edit-turret-setup",
        label: "Edit Turret Setup",
        onSelect: openTurretDialog,
      },
    ];
  }, [contextMenu, openTurretDialog]);

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
        case "CreateSetupCmd":
          setSetupDialogOpen(true);
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
    setLibraryTarget(null);
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

  /**
   * After Save Assembly writes to the libraries, close the workflow and
   * reopen the Tool Library on the Hub copy of the assembly so the user
   * lands on where it was saved.
   */
  const handleAssemblySaved = useCallback((libraryId: string, assemblyId: string) => {
    setToolHolderOpen(false);
    setEditAssemblyId(null);
    setLibraryTarget({ libraryId, assemblyId });
    setToolLibraryOpen(true);
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
              root={browserRoot}
              selectedId={selectedBrowserId}
              onSelect={(nodeId) => {
                setSelectedBrowserId(nodeId);
              }}
              onContextMenuNode={handleBrowserContextMenu}
              onActivateNode={handleBrowserActivate}
              onVisibilityChange={handleBrowserVisibility}
            />
          </aside>
          <main className="app-shell__center">
            <Viewport
              ribbonWorkspace={ribbonWorkspace}
              ribbonTab={ribbonTab}
              subtitle={viewportEmphasis.subtitle}
              blockAccentClass={viewportEmphasis.blockClass || undefined}
              turret={
                machine !== null
                  ? {
                      url: turretGlbUrl,
                      visible: turretVisible,
                      assignedStations,
                      mounts: turretMounts,
                    }
                  : undefined
              }
            />
          </main>
        </div>
      </div>

      <ToolLibraryDialog
        // Re-mounts when the target changes so ``initialLibraryId`` and
        // ``initialAssemblyId`` are picked up fresh after each save.
        key={libraryTarget ? `${libraryTarget.libraryId}:${libraryTarget.assemblyId}` : "default"}
        open={toolLibraryOpen}
        onClose={closeToolLibrary}
        onCreateTool={openNewToolPicker}
        onEditAssembly={openAssemblyEditor}
        initialLibraryId={libraryTarget?.libraryId}
        initialAssemblyId={libraryTarget?.assemblyId}
      />

      {/* Assembly picker opened from a turret station's dropdown. */}
      <ToolLibraryDialog
        key={`assembly-picker:${libraryPickStation ?? "none"}`}
        open={libraryPickStation !== null}
        picker
        pickAssembly
        initialLibraryId={assemblyPickerLibraryId}
        onClose={() => {
          setLibraryPickStation(null);
        }}
        onPickAssembly={(assemblyId) => {
          if (libraryPickStation !== null) {
            setPendingAssignment({
              stationNumber: libraryPickStation,
              toolAssemblyId: assemblyBaseId(assemblyId),
              token: Date.now(),
            });
          }
          setLibraryPickStation(null);
        }}
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
        onAssemblySaved={handleAssemblySaved}
      />

      <SetupDialog
        open={setupDialogOpen}
        machine={machine}
        onClose={() => {
          setSetupDialogOpen(false);
        }}
        onConfirm={confirmSetup}
      />

      {turretSetup !== null ? (
        <TurretSetupDialog
          open={turretDialogOpen}
          machine={machine}
          setup={turretSetup}
          options={assemblyOptions}
          existingSetups={existingSetups}
          onClose={() => {
            setTurretDialogOpen(false);
          }}
          onConfirm={confirmTurret}
          onEditMachine={editMachineFromTurret}
          onPickFromLibrary={(stationNumber) => {
            setLibraryPickStation(stationNumber);
          }}
          pendingAssignment={pendingAssignment}
        />
      ) : null}

      {contextMenu !== null ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => {
            setContextMenu(null);
          }}
        />
      ) : null}
    </>
  );
}
