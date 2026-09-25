/**
 * Artwork for the Manufacture ribbon, copied out of Fusion by
 * `scripts/build-ribbon.py` and referenced by file name from the generated
 * config. Commands whose icon is chosen at runtime rather than declared have
 * none, and fall back to a glyph.
 */

const iconModules = import.meta.glob("../assets/manufacture-icons/*", {
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

function FallbackGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="ribbon__icon-fallback"
    >
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

export function ManufactureIcon({
  icon,
  size = 32,
}: {
  icon: string | null;
  size?: number;
}) {
  const src = icon === null ? undefined : urlByFilename.get(icon);
  if (src === undefined) {
    return <FallbackGlyph size={size} />;
  }
  return (
    <img
      className="ribbon__icon-img"
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
    />
  );
}
