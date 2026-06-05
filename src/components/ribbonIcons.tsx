/**
 * Ribbon icons sourced from Fusion UI resources (see scripts/sync-fusion-ribbon-icons.mjs).
 * Falls back to a simple glyph when no asset was synced for a label.
 */

import manifest from "../ribbonIconManifest.json";

const iconModules = import.meta.glob("../assets/ribbon-icons/*", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const urlByFilename = new Map<string, string>();
for (const [modulePath, url] of Object.entries(iconModules)) {
  const name = modulePath.split("/").pop();
  if (name !== undefined) {
    urlByFilename.set(name, url);
  }
}

const urlByLabel = new Map<string, string>();
for (const [label, filename] of Object.entries(manifest as Record<string, string>)) {
  const url = urlByFilename.get(filename);
  if (url !== undefined) {
    urlByLabel.set(label, url);
  }
}

export function ribbonIconUrlForLabel(label: string): string | undefined {
  return urlByLabel.get(label);
}

function FallbackGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden className="ribbon__icon-fallback">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.55"
      />
    </svg>
  );
}

export function RibbonIcon({ label }: { label: string }) {
  const src = ribbonIconUrlForLabel(label);
  if (src === undefined) {
    return <FallbackGlyph />;
  }
  return (
    <img
      className="ribbon__icon-img"
      src={src}
      alt=""
      width={32}
      height={32}
      draggable={false}
    />
  );
}
