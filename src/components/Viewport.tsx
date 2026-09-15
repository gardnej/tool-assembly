import { useEffect, useRef } from "react";
import type { RibbonTabId, RibbonWorkspaceId } from "../ribbonConfig";
import auPartGlbUrl from "../assets/models/au-part-2023.glb?url";
import turretStations from "../data/turretStations.json";
import "./panels.css";

type ViewportProps = {
  ribbonWorkspace: RibbonWorkspaceId;
  ribbonTab: RibbonTabId;
  /** Line under the block (e.g. highlight / selection context) */
  subtitle?: string;
  /** Extra frame class for feature emphasis rings around viewport preview */
  blockAccentClass?: string | undefined;
  /**
   * Turret model to overlay, whether the browser's turret node is shown, and
   * the station numbers that currently have a tool assembly mounted (their
   * baked ``station-NN`` material is revealed; the rest stay hidden).
   */
  turret?: { url: string; visible: boolean; assignedStations: number[] } | undefined;
};

/** Regex pulling the station number out of a baked ``station-07`` material. */
const STATION_MATERIAL = /^station-(\d+)$/;

/** The slice of model-viewer's material API we drive to show/hide tools. */
type MvMaterial = {
  name?: string;
  setAlphaMode: (mode: "OPAQUE" | "BLEND" | "MASK") => void;
  pbrMetallicRoughness: {
    baseColorFactor: [number, number, number, number];
    setBaseColorFactor: (rgba: [number, number, number, number]) => void;
  };
};

export function Viewport({
  ribbonWorkspace,
  ribbonTab,
  subtitle,
  blockAccentClass,
  turret,
}: ViewportProps) {
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

  /**
   * Reveal only the mounted stations' tools. Each station's tool is a baked
   * ``station-NN`` material; we drop the alpha of unassigned ones to 0 so the
   * turret reads as bare, and restore it for assigned ones. Re-applied on
   * every assignment change and whenever the model (re)loads.
   */
  const turretRef = useRef<HTMLElement & { model?: unknown }>(null);
  const assignedKey = turret?.assignedStations.slice().sort((a, b) => a - b).join(",");

  useEffect(() => {
    const viewer = turretRef.current;
    if (viewer === null || turret === undefined) return;

    const assigned = new Set(turret.assignedStations);
    const apply = () => {
      // model-viewer exposes a symbolic scene graph once the glTF has loaded.
      const model = (viewer as { model?: { materials?: MvMaterial[] } }).model;
      if (model?.materials === undefined) return;
      for (const material of model.materials) {
        const match = STATION_MATERIAL.exec(material.name ?? "");
        if (match === null) continue;
        const on = assigned.has(Number(match[1]));
        const pbr = material.pbrMetallicRoughness;
        const [r, g, b] = pbr.baseColorFactor;
        pbr.setBaseColorFactor([r, g, b, on ? 1 : 0]);
        material.setAlphaMode(on ? "OPAQUE" : "BLEND");
      }
    };

    apply();
    viewer.addEventListener("load", apply);
    return () => {
      viewer.removeEventListener("load", apply);
    };
  }, [assignedKey, turret?.url, turret?.visible, turret]);

  return (
    <div className="viewport" role="application" aria-label="Design viewport">
      <div className="viewport__grid">
        <div
          className={["viewport__block", "viewport__block--glb", blockAccentClass ?? ""]
            .filter(Boolean)
            .join(" ")}
        >
          {turret !== undefined && turret.visible ? (
            <model-viewer
              ref={turretRef}
              className="viewport__model-viewer"
              src={turret.url}
              alt="Turret assembly"
              camera-controls
              interaction-prompt="none"
              camera-orbit="88deg 74deg 110%"
              shadow-intensity="0.4"
              exposure="1"
              aria-label="Turret assembly — 3D model. Drag to orbit, scroll to zoom."
            >
              {turretStations.stations.map((station) => {
                const mounted = turret.assignedStations.includes(station.number);
                return (
                  <button
                    key={station.number}
                    className={
                      mounted ? "turret-hotspot turret-hotspot--mounted" : "turret-hotspot"
                    }
                    slot={`hotspot-${station.number}`}
                    data-position={station.position.join(" ")}
                    data-normal={station.normal.join(" ")}
                    data-visibility-attribute="visible"
                    type="button"
                  >
                    {station.number}
                  </button>
                );
              })}
            </model-viewer>
          ) : (
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
          )}
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
