import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { RibbonCommand, RibbonPanel } from "../data/ribbonManufacture";
import { MANUFACTURE_TABS } from "../data/ribbonManufacture";
import type { RibbonTabId, RibbonWorkspaceId } from "../ribbonConfig";
import { ribbonTabsForWorkspace, WORKSPACE_OPTIONS } from "../ribbonConfig";
import { ManufactureIcon } from "./manufactureIcons";
import { RibbonIcon } from "./ribbonIcons";
import "./chrome.css";

/** Matches the max width of `.ribbon__panel-menu`. */
const MENU_MAX_WIDTH = 360;

const SUBMENU_WIDTH = 208;

type RibbonProps = {
  workspace: RibbonWorkspaceId;
  activeTab: RibbonTabId;
  onWorkspaceChange: (w: RibbonWorkspaceId) => void;
  onTabChange: (t: RibbonTabId) => void;
  /** Invoked with Fusion's own command id, e.g. `IronToolLibrary`. */
  onCommand?: (commandId: string) => void;
};

export function Ribbon({
  workspace,
  activeTab,
  onWorkspaceChange,
  onTabChange,
  onCommand,
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
        onCommand={onCommand}
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
  onCommand,
}: {
  workspace: RibbonWorkspaceId;
  tab: RibbonTabId;
  onWorkspaceChange: (w: RibbonWorkspaceId) => void;
  onCommand?: (commandId: string) => void;
}) {
  let panel: ReactNode;
  switch (workspace) {
    case "design":
      panel = <DesignRibbonTools tab={tab} />;
      break;
    case "manufacturing":
      panel = <ManufacturePanels tab={tab} onCommand={onCommand} />;
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

/**
 * The Manufacture tabs, laid out as the product lays them out: promoted
 * commands on the bar, the rest behind the panel caption's chevron.
 */
function ManufacturePanels({
  tab,
  onCommand,
}: {
  tab: RibbonTabId;
  onCommand?: (commandId: string) => void;
}) {
  const config = MANUFACTURE_TABS.find((candidate) => candidate.id === tab);
  if (config === undefined) {
    return (
      <RibbonGroup label="">
        <span className="ribbon__placeholder">Select a Manufacture tab.</span>
      </RibbonGroup>
    );
  }

  return (
    <>
      {config.panels.map((panel) => (
        <ManufacturePanel key={panel.id} panel={panel} onCommand={onCommand} />
      ))}
    </>
  );
}

function ManufacturePanel({
  panel,
  onCommand,
}: {
  panel: RibbonPanel;
  onCommand?: (commandId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (open === false) {
      return undefined;
    }
    function onPointerDown(ev: MouseEvent): void {
      const target = ev.target;
      if (!(target instanceof Node)) {
        return;
      }
      // The submenu is a portal of its own, so containment is not enough.
      const insideAMenu =
        target instanceof Element &&
        target.closest(".ribbon__panel-menu, .ribbon__submenu") !== null;
      if (
        insideAMenu ||
        wrapRef.current?.contains(target) === true ||
        menuRef.current?.contains(target) === true
      ) {
        return;
      }
      setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  // The toolbar scrolls horizontally and so clips its children; the menu is
  // taken out to the body and positioned against the panel instead.
  const toggle = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect !== undefined) {
      // Panels at the end of the ribbon would otherwise hang off the window.
      const maxLeft = Math.max(8, window.innerWidth - MENU_MAX_WIDTH - 8);
      setAnchor({ left: Math.min(rect.left, maxLeft), top: rect.bottom });
    }
    setOpen((x) => !x);
  }, []);

  const run = useCallback(
    (commandId: string) => {
      setOpen(false);
      onCommand?.(commandId);
    },
    [onCommand],
  );

  const hasOverflow = panel.overflow.length > 0;

  return (
    <div className="ribbon__group" ref={wrapRef}>
      <div className="ribbon__icons">
        {panel.promoted.map((command) => (
          <button
            key={command.id}
            type="button"
            className="ribbon__icon-btn"
            title={command.label}
            aria-label={command.label}
            onClick={() => {
              run(command.id);
            }}
          >
            <ManufactureIcon icon={command.icon} />
          </button>
        ))}
      </div>

      {hasOverflow ? (
        <button
          type="button"
          className={
            open === true
              ? "ribbon__group-label ribbon__group-label--menu ribbon__group-label--open"
              : "ribbon__group-label ribbon__group-label--menu"
          }
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={toggle}
        >
          {panel.label}
          <span className="ribbon__group-chevron" aria-hidden>
            ▾
          </span>
        </button>
      ) : (
        <span className="ribbon__group-label">
          {panel.label === "" ? "\u00a0" : panel.label}
        </span>
      )}

      {open === true
        ? createPortal(
            <div
              className="ribbon__panel-menu"
              role="menu"
              ref={menuRef}
              style={{ left: anchor.left, top: anchor.top }}
            >
              {panel.overflow.map((command) => (
                <ManufactureMenuItem key={command.id} command={command} onRun={run} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** A command in a panel's dropdown, or a split button opening a submenu. */
function ManufactureMenuItem({
  command,
  onRun,
}: {
  command: RibbonCommand;
  onRun: (commandId: string) => void;
}) {
  const [submenu, setSubmenu] = useState<{ left: number; top: number } | null>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const children = command.items;

  const hold = useCallback(() => {
    window.clearTimeout(closeTimer.current);
  }, []);

  // The dropdown scrolls, so the submenu is placed against the split button
  // and taken out to the body rather than nested inside and clipped.
  const openSubmenu = useCallback(() => {
    hold();
    const rect = splitRef.current?.getBoundingClientRect();
    if (rect === undefined) {
      return;
    }
    const wouldOverflow = rect.right + SUBMENU_WIDTH > window.innerWidth;
    setSubmenu({
      left: wouldOverflow ? rect.left - SUBMENU_WIDTH : rect.right,
      top: rect.top - 4,
    });
  }, [hold]);

  // A grace period, so the pointer can cross the gap into the submenu.
  const closeSubmenu = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setSubmenu(null);
    }, 160);
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(closeTimer.current);
    };
  }, []);

  if (children === undefined || children.length === 0) {
    return (
      <button
        type="button"
        role="menuitem"
        className="ribbon__menu-item"
        onClick={() => {
          onRun(command.id);
        }}
      >
        <ManufactureIcon icon={command.icon} size={16} />
        <span className="ribbon__menu-label">{command.label}</span>
      </button>
    );
  }

  return (
    <div
      className="ribbon__menu-split"
      ref={splitRef}
      onMouseEnter={openSubmenu}
      onMouseLeave={closeSubmenu}
    >
      <button
        type="button"
        role="menuitem"
        className="ribbon__menu-item"
        aria-expanded={submenu !== null}
        aria-haspopup="menu"
        onClick={() => {
          if (submenu === null) {
            openSubmenu();
          } else {
            setSubmenu(null);
          }
        }}
      >
        <ManufactureIcon icon={command.icon} size={16} />
        <span className="ribbon__menu-label">{command.label}</span>
        <span className="ribbon__menu-arrow" aria-hidden>
          ▸
        </span>
      </button>
      {submenu !== null
        ? createPortal(
            <div
              className="ribbon__submenu"
              role="menu"
              style={{ left: submenu.left, top: submenu.top, width: SUBMENU_WIDTH }}
              onMouseEnter={hold}
              onMouseLeave={closeSubmenu}
            >
              {children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  role="menuitem"
                  className="ribbon__menu-item"
                  onClick={() => {
                    setSubmenu(null);
                    onRun(child.id);
                  }}
                >
                  <ManufactureIcon icon={child.icon} size={16} />
                  <span className="ribbon__menu-label">{child.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
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
