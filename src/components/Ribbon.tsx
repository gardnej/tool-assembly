import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { RibbonTabId, RibbonWorkspaceId } from "../ribbonConfig";
import { ribbonTabsForWorkspace, WORKSPACE_OPTIONS } from "../ribbonConfig";
import { RibbonIcon } from "./ribbonIcons";
import "./chrome.css";

type RibbonProps = {
  workspace: RibbonWorkspaceId;
  activeTab: RibbonTabId;
  onWorkspaceChange: (w: RibbonWorkspaceId) => void;
  onTabChange: (t: RibbonTabId) => void;
  onOpenFeatureManager?: () => void;
  onOpenToolLibrary?: () => void;
};

export function Ribbon({
  workspace,
  activeTab,
  onWorkspaceChange,
  onTabChange,
  onOpenFeatureManager,
  onOpenToolLibrary,
}: RibbonProps) {
  const tabs = ribbonTabsForWorkspace(workspace);
  return (
    <div className="ribbon">
      <div className="ribbon__top">
        <div className="ribbon__tabs-strip" role="tablist" aria-label="Ribbon tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={
                activeTab === t.id ? "ribbon__tab ribbon__tab--active" : "ribbon__tab"
              }
              onClick={() => {
                onTabChange(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <RibbonToolbar
        workspace={workspace}
        tab={activeTab}
        onWorkspaceChange={onWorkspaceChange}
        onOpenFeatureManager={onOpenFeatureManager}
        onOpenToolLibrary={onOpenToolLibrary}
      />
    </div>
  );
}

function WorkspaceSwitcher({
  workspace,
  onWorkspaceChange,
}: {
  workspace: RibbonWorkspaceId;
  onWorkspaceChange: (w: RibbonWorkspaceId) => void;
}) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (workspaceOpen === false) {
      return undefined;
    }
    function onPointerDown(ev: MouseEvent): void {
      const el = workspaceWrapRef.current;
      if (el === null) {
        return;
      }
      if (ev.target instanceof Node === true && el.contains(ev.target) === true) {
        return;
      }
      setWorkspaceOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [workspaceOpen]);

  const workspaceLabel =
    WORKSPACE_OPTIONS.find((o) => o.id === workspace)?.label ?? "DESIGN";

  const pickWorkspace = useCallback(
    (w: RibbonWorkspaceId) => {
      onWorkspaceChange(w);
      setWorkspaceOpen(false);
    },
    [onWorkspaceChange],
  );

  return (
    <div className="ribbon__workspace-slot ribbon__workspace-slot--toolbar">
      <div className="ribbon__workspace" ref={workspaceWrapRef}>
        <button
          type="button"
          className={
            workspaceOpen === true
              ? "ribbon__workspace-trigger ribbon__workspace-trigger--open"
              : "ribbon__workspace-trigger"
          }
          aria-expanded={workspaceOpen === true}
          aria-haspopup="listbox"
          aria-label={`Workspace: ${workspaceLabel}. Choose workspace`}
          onClick={() => {
            setWorkspaceOpen((x) => !x);
          }}
        >
          <span className="ribbon__workspace-name">{workspaceLabel}</span>
          <span className="ribbon__workspace-chevron" aria-hidden>
            ▾
          </span>
        </button>
        {workspaceOpen === true ? (
          <ul className="ribbon__workspace-dropdown" role="listbox">
            {WORKSPACE_OPTIONS.map((opt) => (
              <li key={opt.id} role="option" aria-selected={opt.id === workspace}>
                <button
                  type="button"
                  className={`ribbon__workspace-opt${opt.id === workspace ? " ribbon__workspace-opt--current" : ""}`}
                  onClick={() => {
                    pickWorkspace(opt.id);
                  }}
                >
                  <span className="ribbon__workspace-opt-label">{opt.label}</span>
                  <span className="ribbon__workspace-opt-hint">{opt.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function RibbonToolbar({
  workspace,
  tab,
  onWorkspaceChange,
  onOpenFeatureManager,
  onOpenToolLibrary,
}: {
  workspace: RibbonWorkspaceId;
  tab: RibbonTabId;
  onWorkspaceChange: (w: RibbonWorkspaceId) => void;
  onOpenFeatureManager?: () => void;
  onOpenToolLibrary?: () => void;
}) {
  let panel: ReactNode;
  switch (workspace) {
    case "design":
      panel = <DesignRibbonTools tab={tab} />;
      break;
    case "manufacturing":
      panel = (
        <ManufacturingRibbonTools
          tab={tab}
          onOpenFeatureManager={onOpenFeatureManager}
          onOpenToolLibrary={onOpenToolLibrary}
        />
      );
      break;
    case "render":
      panel = <RenderRibbonTools tab={tab} />;
      break;
  }

  return (
    <div className="ribbon__toolbar">
      <WorkspaceSwitcher workspace={workspace} onWorkspaceChange={onWorkspaceChange} />
      <div className="ribbon__toolbar-groups">{panel}</div>
    </div>
  );
}

function DesignRibbonTools({ tab }: { tab: RibbonTabId }) {
  switch (tab) {
    case "model":
      return (
        <>
          <RibbonGroup label="Create">
            <IconBox label="Extrude" />
            <IconBox label="Revolve" />
            <IconBox label="Sweep" />
            <IconBox label="Loft" />
            <IconBox label="Rib" />
            <IconBox label="Hole" />
          </RibbonGroup>
          <RibbonGroup label="Modify">
            <IconBox label="Fillet" />
            <IconBox label="Chamfer" />
            <IconBox label="Draft" />
            <IconBox label="Shell" />
            <IconBox label="Split body" />
            <IconBox label="Combine" />
          </RibbonGroup>
          <RibbonGroup label="Patterns">
            <IconBox label="Linear" />
            <IconBox label="Circular" />
            <IconBox label="Mirror" />
            <IconBox label="Rectangular pattern" />
          </RibbonGroup>
          <RibbonGroup label="Inspect">
            <IconBox label="Verify" />
            <IconBox label="Interference" />
            <IconBox label="Measurements" />
          </RibbonGroup>
          <RibbonGroup label="Manage">
            <IconBox label="Bodies" />
            <IconBox label="Properties" />
          </RibbonGroup>
          <RibbonGroup label="Features">
            <IconBox label="Hole" />
            <IconBox label="Thread" />
            <IconBox label="Gear" />
          </RibbonGroup>
        </>
      );
    case "surface":
      return (
        <>
          <RibbonGroup label="Create">
            <IconBox label="Extrude Surface" />
            <IconBox label="Revolve Surface" />
            <IconBox label="Sweep Surface" />
            <IconBox label="Loft" />
            <IconBox label="Boundary Surface" />
            <IconBox label="Patch" />
          </RibbonGroup>
          <RibbonGroup label="Extend">
            <IconBox label="Extend" />
            <IconBox label="Offset Surface" />
            <IconBox label="Thicken" />
          </RibbonGroup>
          <RibbonGroup label="Repair">
            <IconBox label="Stitch" />
            <IconBox label="Trim" />
            <IconBox label="Untrim" />
          </RibbonGroup>
        </>
      );
    case "sheet":
      return (
        <>
          <RibbonGroup label="Flange">
            <IconBox label="Flange" />
            <IconBox label="Contour flange" />
            <IconBox label="Hem" />
            <IconBox label="Bend" />
          </RibbonGroup>
          <RibbonGroup label="Cut">
            <IconBox label="Cut" />
            <IconBox label="Punch tool" />
            <IconBox label="Corner reliefs" />
          </RibbonGroup>
          <RibbonGroup label="Flatten">
            <IconBox label="Create flat pattern" />
            <IconBox label="Refold" />
          </RibbonGroup>
        </>
      );
    case "plastic":
      return (
        <>
          <RibbonGroup label="Part design">
            <IconBox label="Boss" />
            <IconBox label="Vent" />
            <IconBox label="Snap fit" />
            <IconBox label="Rib wizard" />
            <IconBox label="Thin feature" />
          </RibbonGroup>
          <RibbonGroup label="Edit">
            <IconBox label="Thickness" />
            <IconBox label="Draft analysis" />
            <IconBox label="Plastic rule" />
          </RibbonGroup>
        </>
      );
    case "sketch":
      return (
        <>
          <RibbonGroup label="Sketch">
            <IconBox label="Start sketch" accent />
            <IconBox label="Finish sketch" />
            <IconBox label="Construction" />
            <IconBox label="Project incl. geom" />
          </RibbonGroup>
          <RibbonGroup label="Create">
            <IconBox label="Line" />
            <IconBox label="Rectangle" />
            <IconBox label="Circle" />
            <IconBox label="Spline" />
            <IconBox label="Fillet sketch" />
            <IconBox label="Mirror" />
            <IconBox label="Offset" />
          </RibbonGroup>
          <RibbonGroup label="Modify">
            <IconBox label="Trim" />
            <IconBox label="Extend" />
            <IconBox label="Move" />
            <IconBox label="Scale" />
            <IconBox label="Pattern" />
          </RibbonGroup>
          <RibbonGroup label="Constraints">
            <IconBox label="Coincident" />
            <IconBox label="Horizontal" />
            <IconBox label="Vertical" />
            <IconBox label="Tangent" />
            <IconBox label="Equal" />
            <IconBox label="Fix/unfix" />
          </RibbonGroup>
          <RibbonGroup label="Dimension">
            <IconBox label="Dimension" />
            <IconBox label="Aligned dim" />
            <IconBox label="Radius" />
            <IconBox label="Diameter" />
          </RibbonGroup>
        </>
      );
    case "assemble":
      return (
        <>
          <RibbonGroup label="Relationships">
            <IconBox label="Assemble" accent />
            <IconBox label="Joint" />
            <IconBox label="Motion link" />
            <IconBox label="Rigid group" />
            <IconBox label="Bolted connection" />
          </RibbonGroup>
          <RibbonGroup label="Analyze">
            <IconBox label="Interference" />
            <IconBox label="Degrees of freedom" />
            <IconBox label="Centre of gravity" />
          </RibbonGroup>
          <RibbonGroup label="Inspect">
            <IconBox label="Isolate" />
            <IconBox label="Select priority" />
            <IconBox label="Measurement" />
          </RibbonGroup>
        </>
      );
    case "inspect":
      return (
        <>
          <RibbonGroup label="Measure">
            <IconBox label="Distance" accent />
            <IconBox label="Angle" />
            <IconBox label="Area" />
            <IconBox label="Diameter" />
            <IconBox label="Slope" />
          </RibbonGroup>
          <RibbonGroup label="Section">
            <IconBox label="Inspect" />
            <IconBox label="Planes" />
            <IconBox label="Slice graphics" />
          </RibbonGroup>
          <RibbonGroup label="Analyze">
            <IconBox label="Compare" />
            <IconBox label="Curvature analysis" />
            <IconBox label="Deviation" />
          </RibbonGroup>
        </>
      );
    case "utilities":
      return (
        <>
          <RibbonGroup label="Parameters">
            <IconBox label="Parameters" accent />
            <IconBox label="Equation curve" />
            <IconBox label="Configurations" />
          </RibbonGroup>
          <RibbonGroup label="Naming">
            <IconBox label="Bodies & Components" accent />
            <IconBox label="Naming rules" />
            <IconBox label="Named views" />
            <IconBox label="Search browser" />
          </RibbonGroup>
          <RibbonGroup label="Appearance">
            <IconBox label="Appearances library" />
            <IconBox label="Assign appearance" />
            <IconBox label="Material library" />
            <IconBox label="Manage materials" />
          </RibbonGroup>
        </>
      );
    case "addons":
      return (
        <>
          <RibbonGroup label="Add-ins">
            <IconBox label="SCRIPT & ADD-INS" accent />
            <IconBox label="Open App Store" />
            <IconBox label="Customize add-ins panel" />
            <IconBox label="My add-ins" />
          </RibbonGroup>
        </>
      );
    default:
      return (
        <>
          <RibbonGroup label="">
            <span className="ribbon__placeholder">
              Commands for this tab are not mocked in this workspace.
            </span>
          </RibbonGroup>
        </>
      );
  }
}

function ManufacturingFeaturesRibbonGroup({
  onOpenFeatureManager,
}: {
  onOpenFeatureManager?: () => void;
}) {
  if (typeof onOpenFeatureManager !== "function") {
    return null;
  }
  return (
    <RibbonGroup label="Features">
      <button
        type="button"
        className="ribbon__icon-btn"
        title="Feature Manager"
        aria-label="Open Feature Manager"
        onClick={() => {
          onOpenFeatureManager();
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <rect
            x="4"
            y="5"
            width="14"
            height="12"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M7 15 H17 M12 13 V17" stroke="currentColor" strokeWidth="1.25" />
          <circle cx="8" cy="9" r="1.2" fill="currentColor" />
          <circle cx="13" cy="9" r="1.2" fill="currentColor" />
          <circle cx="16" cy="11" r="1" fill="currentColor" />
        </svg>
      </button>
    </RibbonGroup>
  );
}

function ManufacturingToolLibraryGroup({
  onOpenToolLibrary,
}: {
  onOpenToolLibrary?: () => void;
}) {
  if (typeof onOpenToolLibrary !== "function") {
    return null;
  }
  return (
    <RibbonGroup label="Libraries">
      <IconBox label="Tool library" accent onClick={onOpenToolLibrary} />
    </RibbonGroup>
  );
}

function ManufacturingRibbonTools({
  tab,
  onOpenFeatureManager,
  onOpenToolLibrary,
}: {
  tab: RibbonTabId;
  onOpenFeatureManager?: () => void;
  onOpenToolLibrary?: () => void;
}) {
  switch (tab) {
    case "mfg_milling":
      return (
        <>
          <RibbonGroup label="Setup">
            <IconBox label="New setup" accent />
            <IconBox label="NC program / setup sheet" />
          </RibbonGroup>
          <RibbonGroup label="2D">
            <IconBox label="2D Adaptive" accent />
            <IconBox label="2D Roughing" />
            <IconBox label="2D Morph" />
          </RibbonGroup>
          <RibbonGroup label="3D">
            <IconBox label="Adaptive clearing" accent />
            <IconBox label="Parallel" />
            <IconBox label="Contour finishing" />
            <IconBox label="Flow" />
            <IconBox label="Pencil" />
            <IconBox label="Rough" />
            <IconBox label="Rest machining" />
          </RibbonGroup>
          <RibbonGroup label="Drilling">
            <IconBox label="Drill" accent />
            <IconBox label="Circular pattern" />
            <IconBox label="Tapping" />
            <IconBox label="Boring" />
          </RibbonGroup>
          <RibbonGroup label="Multi-axis">
            <IconBox label="Swarf" accent />
            <IconBox label="Morph 3+2" />
          </RibbonGroup>
          <RibbonGroup label="Templates">
            <IconBox label="Template library" accent />
          </RibbonGroup>
          <ManufacturingToolLibraryGroup onOpenToolLibrary={onOpenToolLibrary} />
          <ManufacturingFeaturesRibbonGroup onOpenFeatureManager={onOpenFeatureManager} />
        </>
      );
    case "mfg_turning":
      return (
        <>
          <RibbonGroup label="Turning Roughing">
            <IconBox label="Rough" accent />
            <IconBox label="Face" />
            <IconBox label="Profile" />
            <IconBox label="Groove" />
          </RibbonGroup>
          <RibbonGroup label="Turning Finish">
            <IconBox label="Contour" />
            <IconBox label="Turning chamfer" title="Chamfer" />
            <IconBox label="Bore finishing" />
            <IconBox label="Groove finishing" />
          </RibbonGroup>
          <RibbonGroup label="Groove Cycle">
            <IconBox label="Groove / thread" />
            <IconBox label="Part-off" />
            <IconBox label="Centre drill" />
          </RibbonGroup>
          <ManufacturingToolLibraryGroup onOpenToolLibrary={onOpenToolLibrary} />
          <ManufacturingFeaturesRibbonGroup onOpenFeatureManager={onOpenFeatureManager} />
        </>
      );
    case "mfg_additive":
      return (
        <>
          <RibbonGroup label="Print setup">
            <IconBox label="Additive setup" accent />
            <IconBox label="Machine library" />
            <IconBox label="Material / process" />
          </RibbonGroup>
          <RibbonGroup label="Orient & arrange">
            <IconBox label="Orient part" accent />
            <IconBox label="Arrange duplicates" />
            <IconBox label="Nest preview" />
          </RibbonGroup>
          <RibbonGroup label="Support & slice">
            <IconBox label="Generate supports" />
            <IconBox label="Inspect slice" accent />
          </RibbonGroup>
          <ManufacturingToolLibraryGroup onOpenToolLibrary={onOpenToolLibrary} />
          <ManufacturingFeaturesRibbonGroup onOpenFeatureManager={onOpenFeatureManager} />
        </>
      );
    case "mfg_inspection":
      return (
        <>
          <RibbonGroup label="Inspection">
            <IconBox label="Probe setup" accent />
            <IconBox label="Inspection path" />
            <IconBox label="Deviation report" />
            <IconBox label="Inspection template" />
          </RibbonGroup>
          <RibbonGroup label="Analysis">
            <IconBox label="Compare to CAD" accent />
            <IconBox label="Report export" />
          </RibbonGroup>
          <ManufacturingToolLibraryGroup onOpenToolLibrary={onOpenToolLibrary} />
          <ManufacturingFeaturesRibbonGroup onOpenFeatureManager={onOpenFeatureManager} />
        </>
      );
    case "mfg_fabrication":
      return (
        <>
          <RibbonGroup label="Fabrication setup">
            <IconBox label="Job setup" accent />
            <IconBox label="Tool / machine" />
            <IconBox label="Post library" />
          </RibbonGroup>
          <RibbonGroup label="CAM output">
            <IconBox label="Post process" accent />
            <IconBox label="Edit NC program" />
            <IconBox label="Compare setups" />
          </RibbonGroup>
          <RibbonGroup label="Simulation">
            <IconBox label="Animate" accent />
            <IconBox label="Analyze" />
          </RibbonGroup>
          <ManufacturingToolLibraryGroup onOpenToolLibrary={onOpenToolLibrary} />
          <ManufacturingFeaturesRibbonGroup onOpenFeatureManager={onOpenFeatureManager} />
        </>
      );
    case "mfg_utilities":
      return (
        <>
          <RibbonGroup label="Libraries">
            <IconBox label="Tool library" accent onClick={onOpenToolLibrary} />
            <IconBox label="Feeds & speeds" />
            <IconBox label="Template library" />
          </RibbonGroup>
          <RibbonGroup label="Stock & axes">
            <IconBox label="Stock from solid" accent />
            <IconBox label="Axes & origin" />
            <IconBox label="Preview stock" />
          </RibbonGroup>
          <RibbonGroup label="Utilities">
            <IconBox label="Machine definitions" accent />
            <IconBox label="Calculator" />
            <IconBox label="Export setups" />
          </RibbonGroup>
          <ManufacturingFeaturesRibbonGroup onOpenFeatureManager={onOpenFeatureManager} />
        </>
      );
    default:
      return (
        <>
          <RibbonGroup label="">
            <span className="ribbon__placeholder">Select a Manufacturing tab.</span>
          </RibbonGroup>
          <ManufacturingToolLibraryGroup onOpenToolLibrary={onOpenToolLibrary} />
          <ManufacturingFeaturesRibbonGroup onOpenFeatureManager={onOpenFeatureManager} />
        </>
      );
  }
}

function RenderRibbonTools({ tab }: { tab: RibbonTabId }) {
  switch (tab) {
    case "r_scene":
      return (
        <>
          <RibbonGroup label="Cameras">
            <IconBox label="Edit camera" accent />
            <IconBox label="Add camera view" />
            <IconBox label="Perspective / orthographic" />
            <IconBox label="Animate camera path" />
          </RibbonGroup>
          <RibbonGroup label="Environment">
            <IconBox label="Backdrop" />
            <IconBox label="Ground shadows" />
            <IconBox label="Scene settings" />
          </RibbonGroup>
        </>
      );
    case "r_visuals":
      return (
        <>
          <RibbonGroup label="Appearance">
            <IconBox label="Assign appearance" accent />
            <IconBox label="Plastic appearance" />
            <IconBox label="Decal / label" />
            <IconBox label="Environment map" />
            <IconBox label="Glow" />
            <IconBox label="Displacement" />
          </RibbonGroup>
          <RibbonGroup label="HDR">
            <IconBox label="Tone mapping" />
            <IconBox label="Bloom" />
            <IconBox label="Depth blur" />
          </RibbonGroup>
        </>
      );
    case "r_output":
      return (
        <>
          <RibbonGroup label="Render">
            <IconBox label="Local render in cloud" accent />
            <IconBox label="Render settings" />
            <IconBox label="Render presets" />
            <IconBox label="Queue render" />
            <IconBox label="Gallery" />
          </RibbonGroup>
          <RibbonGroup label="Outputs">
            <IconBox label="Save image sequence" />
            <IconBox label="Export panorama" />
            <IconBox label="Denoise passes" />
          </RibbonGroup>
        </>
      );
    default:
      return (
        <>
          <RibbonGroup label="">
            <span className="ribbon__placeholder">Select a Render tab.</span>
          </RibbonGroup>
        </>
      );
  }
}

function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ribbon__group">
      <div className="ribbon__icons">{children}</div>
      <span className="ribbon__group-label">{label === "" ? "\u00a0" : label}</span>
    </div>
  );
}

function IconBox({
  label,
  title,
  accent,
  onClick,
}: {
  label: string;
  /** Tooltip/aria when different from manifest icon key (label). */
  title?: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  const tooltip = title ?? label;
  return (
    <button
      type="button"
      className={accent === true ? "ribbon__icon-btn ribbon__icon-btn--active" : "ribbon__icon-btn"}
      title={tooltip}
      aria-label={tooltip}
      onClick={onClick}
    >
      <RibbonIcon label={label} />
    </button>
  );
}
