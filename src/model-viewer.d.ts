import type { DetailedHTMLProps, HTMLAttributes } from "react";

type ModelViewerAttributes = HTMLAttributes<HTMLElement> & {
  src?: string;
  alt?: string;
  poster?: string;
  exposure?: string;
  "camera-controls"?: boolean | "";
  "camera-orbit"?: string;
  /** Roll, pitch and yaw applied to the model, about +Z, +X and +Y. */
  orientation?: string;
  "auto-rotate"?: boolean | "";
  "interaction-prompt"?: "auto" | "none";
  "shadow-intensity"?: string;
  "environment-image"?: string;
};

/**
 * The slice of model-viewer's scene graph the assembly viewer uses.
 *
 * It reaches materials but not nodes, which is why parts are shown and hidden
 * through a material each rather than by toggling a node.
 */
export interface ModelViewerMaterial {
  name: string;
  setAlphaMode(mode: "OPAQUE" | "MASK" | "BLEND"): void;
  pbrMetallicRoughness: {
    setBaseColorFactor(rgba: [number, number, number, number]): void;
    setMetallicFactor(value: number): void;
    setRoughnessFactor(value: number): void;
  };
}

export interface ModelViewerElement extends HTMLElement {
  model?: { materials: ModelViewerMaterial[] };
  /** Material under a viewport pixel, or null where the model is not hit. */
  materialFromPoint?(x: number, y: number): ModelViewerMaterial | null;
  /** Current orbit around the target, ``theta`` and ``phi`` in radians. */
  getCameraOrbit?(): { theta: number; phi: number; radius: number };
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<ModelViewerAttributes, HTMLElement>;
    }
  }
}
