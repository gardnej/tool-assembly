import type { RibbonTabId, RibbonWorkspaceId } from "../ribbonConfig";
import auPartGlbUrl from "../assets/models/au-part-2023.glb?url";
import "./panels.css";

type ViewportProps = {
  ribbonWorkspace: RibbonWorkspaceId;
  ribbonTab: RibbonTabId;
  /** Line under the block (e.g. highlight / selection context) */
  subtitle?: string;
  /** Extra frame class for feature emphasis rings around viewport preview */
  blockAccentClass?: string | undefined;
};

export function Viewport({ ribbonWorkspace, ribbonTab, subtitle, blockAccentClass }: ViewportProps) {
  const mode =
    ribbonWorkspace === "render"
      ? "Render"
      : ribbonWorkspace === "manufacturing"
        ? "Manufacturing"
        : ribbonTab === "sketch"
          ? "Sketch (2D)"
          : ribbonTab === "assemble"
            ? "Assembly"
            : "Model (3D)";

  const hint =
    subtitle !== undefined && subtitle !== ""
      ? `AU Part 2023 · ${subtitle}`
      : `AU Part 2023 · ${mode}`;

  return (
    <div className="viewport" role="application" aria-label="Design viewport">
      <div className="viewport__grid">
        <div
          className={["viewport__block", "viewport__block--glb", blockAccentClass ?? ""]
            .filter(Boolean)
            .join(" ")}
        >
          <model-viewer
            className="viewport__model-viewer"
            src={auPartGlbUrl}
            alt="AU Part 2023"
            camera-controls
            interaction-prompt="none"
            shadow-intensity="0.4"
            exposure="1"
            aria-label="AU Part 2023 — 3D model. Drag to orbit, scroll to zoom."
          />
        </div>
      </div>
      <svg
        className="viewport__gizmo"
        viewBox="0 0 64 64"
        aria-label="View cube placeholder"
      >
        <line x1="32" y1="32" x2="56" y2="12" stroke="#c44" strokeWidth="2" />
        <line x1="32" y1="32" x2="12" y2="56" stroke="#4a4" strokeWidth="2" />
        <line x1="32" y1="32" x2="12" y2="12" stroke="#48c" strokeWidth="2" />
        <circle cx="32" cy="32" r="3" fill="#ddd" />
      </svg>
      <div className="viewport__toolbar-hint">{hint}</div>
    </div>
  );
}
