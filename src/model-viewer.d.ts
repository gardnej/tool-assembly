import type { DetailedHTMLProps, HTMLAttributes } from "react";

type ModelViewerAttributes = HTMLAttributes<HTMLElement> & {
  src?: string;
  alt?: string;
  poster?: string;
  exposure?: string;
  "camera-controls"?: boolean | "";
  "auto-rotate"?: boolean | "";
  "interaction-prompt"?: "auto" | "none";
  "shadow-intensity"?: string;
  "environment-image"?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<ModelViewerAttributes, HTMLElement>;
    }
  }
}
