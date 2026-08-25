/**
 * Labels for the geometry keys Fusion stores on a library record.
 *
 * The keys are Fusion's own (`DC`, `OAL`, `LCF` …), so anything without an
 * entry here is shown as a readable form of the key rather than hidden: real
 * libraries carry fields this prototype has never seen.
 */
const GEOMETRY_LABELS: Record<string, string> = {
  // Milling and drilling
  DC: "Diameter",
  SFDM: "Shaft diameter",
  RE: "Corner radius",
  SIG: "Tip angle",
  TP: "Taper angle",
  OAL: "Overall length",
  LB: "Length below holder",
  LS: "Shoulder length",
  LCF: "Flute length",
  NOF: "Number of flutes",

  // Turning inserts
  SC: "Shape code",
  SCTY: "Shape type",
  TC: "Tolerance class",
  INSD: "Insert size",
  S: "Thickness",
  EPSR: "Corner angle",
  RA: "Relief angle",
  LH: "Hand",

  // Holders
  CW: "Clamp width",
  H: "Height",
  W: "Width",
  HAND: "Hand",
  MTP: "Mounting type",
  THSC: "Shank code",

  // Tool blocks
  adaptiveItemSize: "Adaptive item size",
  numberOfTools: "Number of tools",
  numberOfAttachmentPoints: "Attachment points",
  orientationType: "Orientation",
  machineSideConnectionType: "Machine side connection",
};

/** Angles rather than lengths, so they take degrees instead of the tool's unit. */
const ANGLE_KEYS = new Set(["SIG", "TP", "EPSR", "RA"]);

/** Counts and codes, which carry no unit at all. */
const UNITLESS_KEYS = new Set([
  "NOF",
  "SC",
  "SCTY",
  "TC",
  "LH",
  "HAND",
  "MTP",
  "THSC",
  "numberOfTools",
  "numberOfAttachmentPoints",
  "orientationType",
  "machineSideConnectionType",
]);

/** Keys worth surfacing in the compact summary under the assembly's properties. */
export const SUMMARY_GEOMETRY_KEYS = [
  "OAL",
  "DC",
  "RE",
  "LCF",
  "NOF",
  "SC",
  "INSD",
  "S",
  "adaptiveItemSize",
];

export function geometryLabel(key: string): string {
  const known = GEOMETRY_LABELS[key];
  if (known !== undefined) return known;

  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** What a value of this key is measured in, given the record's own unit. */
export function geometryUnit(key: string, recordUnit: string): string {
  if (UNITLESS_KEYS.has(key)) return "";
  if (ANGLE_KEYS.has(key)) return "degrees";
  return recordUnit === "inches" ? "in" : "mm";
}
