/**
 * Per-position identity colours, indexed by position ordinal (0 = Position 1).
 *
 * Shared by the assembly grid (the colour chip on each "Position N" pill) and
 * the 3D viewer (the colour-coded ghost box for the focused position), so the
 * table and the preview always agree on which colour means which position.
 *
 * Deliberately not the blue selection hue (reserved for a selected block), so
 * the seats read apart from each other and from a selected block. Extend the
 * palette if a block ever gains more positions.
 */
export type Rgb = [number, number, number];

export const POSITION_COLOURS: Rgb[] = [
  [0.16, 0.72, 0.60], // Position 1 — teal
  [0.95, 0.58, 0.15], // Position 2 — amber
  [0.62, 0.44, 0.86], // Position 3 — violet
];

/** The colour for a position ordinal, wrapping if the palette runs out. */
export function positionColour(index: number): Rgb {
  return POSITION_COLOURS[index % POSITION_COLOURS.length];
}

/** CSS ``rgb()`` string for a position chip, from the sRGB palette above. */
export function positionColourCss(index: number): string {
  const [r, g, b] = positionColour(index);
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
}
