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
  isMachineNode,
  isTurretNode,
  setupIdFromMachineNode,
  setupIdFromTurretNode,
  turretNodeId,
} from "./data/demoBlockDesign";
// User's clean Haas ST-20Y turret, freshly authored and exported from Fusion 360
// (turret geometry only). Ring/station positions are fitted from its 12 patterned
// mount features — see scripts/build-haas-turret-ring.py. Block seating frames
// (block MCS + turret Joint/UCS) are still pending, so mounted blocks won't seat
// flush against this turret until those frames arrive.
// The full Haas ST-20Y assembly (turret + tool block) tessellated straight from
// the seated CAD STEP via `scripts/convert-assembly-step.py`. In `?cad=1` mode
// the viewport renders THIS mesh verbatim, so the seat you see is the CAD
// joint's own — no placement math, no separate-turret bridge.
import haasAssemblyGlbUrl from "./assets/models/haas-assembly.glb?url";
// The turret split from the seated CAD assembly (same frame as the CAD block).
// The interactive path renders THIS so the composed block seats exactly as the
// CAD joint put it — see `scripts/split-assembly-cad.py`.
import turretCadUrl from "./assets/models/turret-cad.glb?url";
import {
  assemblyBaseId,
  createDefaultTurretSetup,
  HAAS_ST_20Y,
  nextOpNumber,
  toolAssemblyOptions,
  turretSetups,
  turretSetupById,
  setSelectedMachine,
  upsertTurretSetup,
} from "./data/turret";
import { sessionAssemblies, upsertSessionAssembly } from "./data/libraryEdits";
import { assemblyMount } from "./data/turretSolids";
import { useTurretRevision } from "./hooks/useTurretRevision";
import type { Machine, TurretSetup, TurretStationAssignment } from "./types";
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
  // The machine is already present in the Setup by default (the user need not
  // pick one), matching the Turret Setup workflow. Its 3D visibility still
  // defaults to OFF (see `turretVisible`), toggleable on from the browser.
  const [machine, setMachine] = useState<Machine | null>(HAAS_ST_20Y);
  const [turretSetup, setTurretSetup] = useState<TurretSetup | null>(null);
  /**
   * In-progress station assignments from the open dialog, mirrored here so the
   * canvas previews mounts live before Ok commits them. Null when the dialog is
   * closed or has not emitted yet, in which case the committed setup is shown.
   */
  const [draftStations, setDraftStations] = useState<
    TurretStationAssignment[] | null
  >(null);
  const [setupDialogOpen, setSetupDialogOpen] = useState(() => queryFlag("setup"));
  const [turretDialogOpen, setTurretDialogOpen] = useState(false);
  // Turret geometry is hidden in the canvas by default; the browser node's eye
  // toggles it on. (While the Turret Setup dialog is open it is force-shown so
  // the user can see what they are editing — see `turretShown`.)
  const [turretVisible, setTurretVisible] = useState(false);
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

  const confirmTurret = useCallback((next: TurretSetup) => {
    upsertTurretSetup(next);
    setTurretSetup(next);
    setDraftStations(null);
    setTurretDialogOpen(false);
  }, []);

  const editMachineFromTurret = useCallback(() => {
    setTurretDialogOpen(false);
    setSetupDialogOpen(true);
  }, []);

  // The machine is pre-selected in the Setup and a default turret setup exists
  // so its node shows in the browser (turret hidden until toggled on). Skipped
  // for the deep-link flows below, which seed their own current setup.
  useEffect(() => {
    setSelectedMachine(HAAS_ST_20Y.id);
    if (queryFlag("turretSetup") || queryFlag("demo") || queryFlag("cad")) return;
    const existing = turretSetups();
    const setup = existing[0] ?? createDefaultTurretSetup(HAAS_ST_20Y);
    if (existing.length === 0) upsertTurretSetup(setup);
    setTurretSetup((prev) => prev ?? setup);
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

  // Deep link: ?cad=1 renders the seated CAD assembly GLB directly (turret +
  // tool block as modelled), bypassing station mounts and placement math so the
  // viewport shows the exact CAD joint seat. Just needs a machine + a visible
  // turret; the assembly mesh carries its own block, so no mounts are set.
  const cadMode = queryFlag("cad");
  useEffect(() => {
    if (!cadMode) return;
    setMachine((prev) => prev ?? HAAS_ST_20Y);
    setSelectedMachine(HAAS_ST_20Y.id);
    setTurretVisible(true);
  }, [cadMode]);

  /** Make the setup carried by a turret node the current one, if it resolves. */
  const selectSetupFromNode = useCallback((nodeId: string) => {
    const setupId = setupIdFromTurretNode(nodeId);
    if (setupId === null) return;
    const found = turretSetupById(setupId);
    if (found !== undefined) setTurretSetup(found);
  }, []);

  /** Open the Turret Setup dialog on the setup a turret node points at. */
  const openTurretNode = useCallback(
    (nodeId: string) => {
      selectSetupFromNode(nodeId);
      setTurretDialogOpen(true);
    },
    [selectSetupFromNode],
  );

  /**
   * Create a NEW manufacturing Setup (OP 30, OP 40, … continuing the demo OP
   * sequence), each a top-level Setup node under the Setups folder carrying its
   * own machine → Turret1 subtree with an empty/default turret. Registers it so
   * its OP node appears in the browser, selects the new turret and opens the
   * dialog. Wired to the ribbon's New Setup button.
   */
  const createTurretSetup = useCallback(() => {
    const forMachine = machine ?? HAAS_ST_20Y;
    if (machine === null) {
      setMachine(forMachine);
      setSelectedMachine(forMachine.id);
    }
    const setup = createDefaultTurretSetup(forMachine, "Turret1", nextOpNumber());
    upsertTurretSetup(setup);
    setTurretSetup(setup);
    setDraftStations(null);
    setSelectedBrowserId(turretNodeId(setup.id));
    setTurretDialogOpen(true);
  }, [machine]);

  const handleBrowserContextMenu = useCallback(
    (nodeId: string, x: number, y: number) => {
      if (isTurretNode(nodeId)) {
        setContextMenu({ x, y, nodeId });
      }
    },
    [],
  );

  const handleBrowserActivate = useCallback(
    (nodeId: string) => {
      if (isTurretNode(nodeId)) openTurretNode(nodeId);
    },
    [openTurretNode],
  );

  const handleBrowserVisibility = useCallback(
    (nodeId: string, hidden: boolean) => {
      // Both a Setup's machine node and its turret node drive that Setup's
      // turret in the canvas: make it current, then toggle visibility.
      if (isTurretNode(nodeId)) {
        selectSetupFromNode(nodeId);
        setTurretVisible(!hidden);
      } else if (isMachineNode(nodeId)) {
        const setupId = setupIdFromMachineNode(nodeId);
        if (setupId !== null) {
          const found = turretSetupById(setupId);
          if (found !== undefined) setTurretSetup(found);
        }
        setTurretVisible(!hidden);
      }
    },
    [selectSetupFromNode],
  );

  // Turret setups to render as nodes: the committed store plus the current
  // working setup if it has not been committed yet (e.g. a demo deep link).
  const browserSetups = useMemo(() => {
    const list = turretSetups();
    if (turretSetup !== null && !list.some((s) => s.id === turretSetup.id)) {
      return [turretSetup, ...list];
    }
    return list;
  }, [turretRev, turretSetup]);

  const browserRoot = useMemo(() => {
    if (machine === null) return undefined;
    return browserRootWithTurret(
      machine.name,
      browserSetups.map((s) => ({ id: s.id, name: s.name, opNumber: s.opNumber ?? 10 })),
    );
  }, [machine, browserSetups]);

  /**
   * Stations the canvas should reflect: the dialog's live draft while it is
   * open and has emitted, otherwise the committed setup. This is what makes a
   * station's tool appear on the turret the moment it is picked, before Ok.
   */
  const previewStations = useMemo(
    () =>
      turretDialogOpen && draftStations !== null
        ? draftStations
        : (turretSetup?.stations ?? []),
    [turretDialogOpen, draftStations, turretSetup],
  );

  /** Station numbers that currently have a tool assembly mounted. */
  const assignedStations = useMemo(
    () =>
      previewStations
        .filter((station) => station.toolAssemblyId !== null)
        .map((station) => station.stationNumber),
    [previewStations],
  );

  /**
   * Per-station real solids to show on the turret: for each assigned station,
   * the GLB of the assembly's own geometry when we ship one (else null, so the
   * viewport keeps the baked template). Recomputed when a save adds a solid.
   */
  const turretMounts = useMemo(
    () =>
      previewStations
        .filter((station) => station.toolAssemblyId !== null)
        .map((station) => {
          const mount = assemblyMount(station.toolAssemblyId);
          return {
            stationNumber: station.stationNumber,
            solidUrl: mount?.url ?? null,
            keepMaterials: mount?.keepMaterials,
            flipped: station.flipped === true,
          };
        }),
    [previewStations, turretRev],
  );

  const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (contextMenu === null) return [];
    const { nodeId } = contextMenu;
    return [
      {
        id: "edit-turret-setup",
        label: "Edit Turret Setup",
        onSelect: () => {
          openTurretNode(nodeId);
        },
      },
    ];
  }, [contextMenu, openTurretNode]);

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
          // In this turret prototype the machine is already in the Setup, so
          // "New Setup" creates a new TURRET setup node rather than reopening
          // the machine chooser (still reachable via the dialog's Edit machine).
          createTurretSetup();
          break;
        default:
          break;
      }
    },
    [createTurretSetup],
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

  // Turret is shown when its browser visibility is on OR the Turret Setup dialog
  // is open (so the user can see what they are editing regardless of the toggle).
  const turretShown = turretVisible || turretDialogOpen;

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
                // Selecting a turret node makes its setup the current one, so
                // the canvas and dialog reflect the setup the user clicked.
                if (isTurretNode(nodeId)) selectSetupFromNode(nodeId);
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
                  ? cadMode
                    ? {
                        // Seated CAD assembly rendered verbatim: no mounts (the
                        // mesh already carries the block) and no hotspots (they
                        // are placed in the reconstructed turret's frame, not
                        // this mesh's), so the seat you see is the CAD joint's.
                        url: haasAssemblyGlbUrl,
                        visible: turretShown,
                        assignedStations: [],
                        mounts: [],
                        hotspots: false,
                      }
                    : {
                        // CAD turret split from the seated assembly; the block
                        // mount composes onto it in the same frame (metres), so
                        // the seat is the CAD joint's. Hotspots are suppressed
                        // because their positions live in the old reconstructed
                        // turret's centimetre frame, not this mesh's.
                        url: turretCadUrl,
                        visible: turretShown,
                        assignedStations,
                        mounts: turretMounts,
                        hotspots: false,
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
            // Cancel: drop the live draft so the canvas reverts to the last
            // committed setup.
            setDraftStations(null);
            setTurretDialogOpen(false);
          }}
          onConfirm={confirmTurret}
          onStationsChange={setDraftStations}
          onSelectSetup={(setupId) => {
            const found = turretSetupById(setupId);
            if (found !== undefined) setTurretSetup(found);
          }}
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
