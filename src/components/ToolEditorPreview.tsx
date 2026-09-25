import type { LibraryToolRecord } from "../data/realLibrary";
import { meshPreviewFor, ToolLibrarySolidPreview } from "./ToolLibrarySolidPreview";
import { ToolSilhouette } from "./ToolSilhouette";

interface ToolEditorPreviewProps {
  record: LibraryToolRecord;
  geometry: Record<string, number | string | boolean>;
}

/**
 * The editor's viewport.
 *
 * Fusion draws the tool against a grid with its tip on the origin. Only the
 * prototype block has a solid the browser can read, so everything else is drawn
 * from the record's own geometry — which is what makes editing a diameter or a
 * length show up here.
 */
export function ToolEditorPreview({ record, geometry }: ToolEditorPreviewProps) {
  const mesh = meshPreviewFor(record);

  return (
    <div className="te-view">
      <div className="te-view__grid" aria-hidden="true" />

      {mesh !== null ? (
        <ToolLibrarySolidPreview preview={mesh} />
      ) : (
        <ToolSilhouette
          record={record}
          geometry={geometry}
          className="te-view__art"
        />
      )}

      <div className="te-view__cube" aria-hidden="true">
        FRONT
      </div>
      <span className="te-view__axis te-view__axis--z" aria-hidden="true">
        +Z
      </span>
      <span className="te-view__axis te-view__axis--x" aria-hidden="true">
        +X
      </span>
      <div className="te-view__scale" aria-hidden="true">
        <span className="te-view__scale-bar" />5 mm
      </div>
    </div>
  );
}
