import { useEffect, useRef } from "react";
import previewBlockUrl from "../assets/models/3x-spot-drill-tap.glb?url";
import axialBlockUrl from "../assets/models/3x-axial-block.glb?url";
import er16ColletUrl from "../assets/models/er16-collet.glb?url";
import er16ExtensionUrl from "../assets/models/er16-extension.glb?url";
// User-provided OD/ID dual assemblies (block + tools) in their OWN design
// frame, converted from the per-assembly STEPs. These are the LIBRARY PREVIEW
// meshes: upright and centred, so the catalog reads cleanly — as opposed to the
// world-frame GLBs used to SEAT the block on the turret (turretSolids.ts), which
// are tilted to sit on the drum facet. model-viewer auto-frames either, but the
// design frame gives a consistent, straight-on preview like the 3X block.
import od20mmDualIdPreviewUrl from "../assets/models/od-20mm-dual-id-preview.glb?url";
import od25mmDualOdPreviewUrl from "../assets/models/od-25mm-dual-od-preview.glb?url";
import {
  PREVIEW_BLOCK_MATERIAL,
  PREVIEW_SEATS,
  seatMaterials,
} from "../data/previewGeometry";
import type { ModelViewerElement, ModelViewerMaterial } from "../model-viewer";
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
  /**
   * For assembly GLBs that bake block + tools together (OD/ID duals), the
   * material names that make up the bare block body. When set, every OTHER
   * material is hidden so the catalog shows the block alone — the tools only
   * belong once mounted in the assembly editor.
   */
  bodyMaterials?: string[];
}

/**
 * The imported 3X Axial block records in the snapshot; each library ships one
 * so the guid varies, and the .3DTool geometry id (``3482e088…``) does too.
 * Whatever the ids, the mesh the user handed us covers all of them.
 */
const AXIAL_BLOCK_GEOMETRY_IDS = new Set([
  "3482e088-0690-4e9f-a4d8-4f1514f4ea90",
]);

/**
 * OD/ID dual tool blocks → their assembly GLB (the whole block + tools), keyed
 * by the `.3DTool` geometry id. Kept in step with `OD_ID_BLOCK_SOLIDS` in
 * `turretSolids.ts` so the library preview and the seated turret show the same
 * mesh. (20MM OD_SINGLE has no exported STEP yet, so it still falls back to the
 * silhouette upstream.)
 */
const OD_ID_BLOCK_PREVIEWS: Record<
  string,
  { src: string; alt: string; bodyMaterials: string[] }
> = {
  "3ac2ff71-0a7a-4fa9-80b4-ee79740f884f": {
    src: od20mmDualIdPreviewUrl,
    alt: "20MM ID_DUAL tool block",
    // Bare block only — the CNMG bars/seats are tools, hidden here.
    bodyMaterials: ["Tool Block", "End Cap_1", "End Cap_2"],
  },
  "60a88fbe-b190-408d-9fb4-81510f603e94": {
    src: od25mmDualOdPreviewUrl,
    alt: "25MM OD_DUAL tool block",
    // Bare block only — the DDJNL/SER holders are tools, hidden here.
    bodyMaterials: ["SOLID"],
  },
};

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
  if (record.geometryId !== null && record.geometryId in OD_ID_BLOCK_PREVIEWS) {
    const { src, alt, bodyMaterials } = OD_ID_BLOCK_PREVIEWS[record.geometryId];
    return { src, hideMountedSeats: false, alt, bodyMaterials };
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

  const { hideMountedSeats, bodyMaterials, src } = preview;
  useEffect(() => {
    if (!hideMountedSeats && bodyMaterials === undefined) return;
    const viewer = ref.current;
    if (viewer === null) return;

    // A hidden part is painted so it draws nothing: MASK with a full cutoff and
    // zero alpha discards every fragment from all angles (nodes are not
    // reachable through model-viewer, and BLEND at alpha 0 can still ghost).
    const hide = (material: ModelViewerMaterial) => {
      material.setAlphaMode("MASK");
      material.setAlphaCutoff(1);
      material.pbrMetallicRoughness.setBaseColorFactor([0, 0, 0, 0]);
    };

    const hideMounted = () => {
      const materials = viewer.model?.materials;
      if (materials === undefined) return;

      // OD/ID dual assemblies: keep only the block body, hide every tool part.
      if (bodyMaterials !== undefined) {
        const body = new Set(bodyMaterials);
        for (const material of materials) {
          if (!body.has(material.name)) hide(material);
        }
        return;
      }

      // Prototype 3X block: hide just its mounted seats.
      const mounted = new Set<string>();
      for (const seat of PREVIEW_SEATS) {
        for (const name of seatMaterials(seat)) mounted.add(name);
      }
      for (const material of materials) {
        if (material.name === PREVIEW_BLOCK_MATERIAL) continue;
        if (!mounted.has(material.name)) continue;
        hide(material);
      }
    };

    viewer.addEventListener("load", hideMounted);
    if (viewer.model !== undefined) hideMounted();
    return () => viewer.removeEventListener("load", hideMounted);
  }, [hideMountedSeats, bodyMaterials, src]);

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
