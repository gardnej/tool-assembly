/**
 * Browser tree artwork, copied out of Fusion by
 * `scripts/build-browser-icons.py` and keyed by node kind.
 */

import type { BrowserNodeKind } from "../data/demoBlockDesign";

const iconModules = import.meta.glob("../assets/browser-icons/*", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const urlByName = new Map<string, string>();
for (const [modulePath, url] of Object.entries(iconModules)) {
  const file = modulePath.split("/").pop();
  if (file !== undefined) {
    urlByName.set(file.replace(/\.[^.]+$/, ""), url);
  }
}

/** The row controls Fusion draws alongside a node's own icon. */
type BrowserControl = "visible" | "hidden" | "expand" | "collapse";

export function browserIconUrl(name: BrowserNodeKind | BrowserControl): string | undefined {
  return urlByName.get(name);
}

export function BrowserIcon({ kind }: { kind: BrowserNodeKind }) {
  const src = browserIconUrl(kind);
  if (src === undefined) {
    return <span className="browser-tree__icon" aria-hidden />;
  }
  return <img className="browser-tree__icon" src={src} alt="" width={16} height={16} draggable={false} />;
}
