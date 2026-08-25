import { useEffect, useRef } from "react";
import previewBlockUrl from "../assets/models/3x-spot-drill-tap.glb?url";
import axialBlockUrl from "../assets/models/3x-axial-block.glb?url";
import er16ColletUrl from "../assets/models/er16-collet.glb?url";
import er16ExtensionUrl from "../assets/models/er16-extension.glb?url";
import {
  PREVIEW_BLOCK_MATERIAL,
  PREVIEW_SEATS,
  seatMaterials,
} from "../data/previewGeometry";
import type { ModelViewerElement } from "../model-viewer";
import type { LibraryToolRecord } from "../data/realLibrary";
import { PREVIEW_BLOCK_GEOMETRY_ID } from "../data/previewGeometry";

/**
 * The library's 3D preview for a record we have a mesh for.
 *
 * Meshes come from three places, each with its own quirk: the prototype block
 * is one GLB that carries the whole assembly and needs its mounted seats
 * hidden so only the block reads; the imported 3X Axial block was exported to
 * STEP by the user and converted at build time; and the ER16 Collet is a
 * single-solid STEP that renders straight through. Records with no mesh fall
 * back to the SVG silhouette upstream.
 */

/** Which record uses which mesh, and whether its seats need alpha-ing out. */
interface Preview {
  src: string;
  hideMountedSeats: boolean;
  alt: string;
}

/**
 * The imported 3X Axial block records in the snapshot; each library ships one
 * so the guid varies, and the .3DTool geometry id (``3482e088…``) does too.
 * Whatever the ids, the mesh the user handed us covers all of them.
 */
const AXIAL_BLOCK_GEOMETRY_IDS = new Set([
  "3482e088-0690-4e9f-a4d8-4f1514f4ea90",
]);

export function meshPreviewFor(record: LibraryToolRecord): Preview | null {
  if (record.geometryId === PREVIEW_BLOCK_GEOMETRY_ID) {
    return {
      src: previewBlockUrl,
      hideMountedSeats: true,
      alt: "Tool block solid",
    };
  }
  if (record.geometryId !== null && AXIAL_BLOCK_GEOMETRY_IDS.has(record.geometryId)) {
    return {
      src: axialBlockUrl,
      hideMountedSeats: false,
      alt: "3X Axial tool block",
    };
  }
  if (record.type === "holder" && /er16.*collet/i.test(record.description)) {
    return {
      src: er16ColletUrl,
      hideMountedSeats: false,
      alt: `${record.description} collet solid`,
    };
  }
  if (record.type === "holder" && /er16.*extension/i.test(record.description)) {
    return {
      src: er16ExtensionUrl,
      hideMountedSeats: false,
      alt: `${record.description} extension solid`,
    };
  }
  return null;
}

interface ToolLibrarySolidPreviewProps {
  preview: Preview;
}

export function ToolLibrarySolidPreview({ preview }: ToolLibrarySolidPreviewProps) {
  const ref = useRef<ModelViewerElement | null>(null);

  useEffect(() => {
    if (!preview.hideMountedSeats) return;
    const viewer = ref.current;
    if (viewer === null) return;

    const hideMounted = () => {
      const materials = viewer.model?.materials;
      if (materials === undefined) return;

      const mounted = new Set<string>();
      for (const seat of PREVIEW_SEATS) {
        for (const name of seatMaterials(seat)) mounted.add(name);
      }

      for (const material of materials) {
        if (material.name === PREVIEW_BLOCK_MATERIAL) continue;
        if (!mounted.has(material.name)) continue;
        // Alpha-out rather than remove; nodes are not reachable through
        // model-viewer, so painting the material is what a hide amounts to.
        material.setAlphaMode("BLEND");
        material.pbrMetallicRoughness.setBaseColorFactor([0, 0, 0, 0]);
      }
    };

    viewer.addEventListener("load", hideMounted);
    if (viewer.model !== undefined) hideMounted();
    return () => viewer.removeEventListener("load", hideMounted);
  }, [preview.hideMountedSeats, preview.src]);

  return (
    <model-viewer
      ref={ref}
      className="absolute inset-0 h-full w-full"
      src={preview.src}
      alt={preview.alt}
      camera-controls
      orientation="0deg -90deg 0deg"
      camera-orbit="25deg 70deg auto"
      interaction-prompt="none"
      shadow-intensity="0.5"
      exposure="1.1"
      aria-label={`${preview.alt} — drag to orbit, scroll to zoom.`}
    />
  );
}
