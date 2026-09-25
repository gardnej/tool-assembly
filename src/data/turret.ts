/**
 * Turret setup model: machines, their turrets, and the per-station assignment
 * of tool assemblies.
 *
 * A machine carries a fixed turret (coupling, station count, mount, position);
 * a `TurretSetup` names an assignment of tool assemblies to those stations. The
 * station table in the dialog is exactly `turret.stationCount` rows long.
 *
 * Assignments reference tool assemblies by id. Those come from two places,
 * merged: the real `SavedAssembly` records the assembly workflow writes this
 * session, and a seeded demo set so the dialog reads like the design on first
 * open. Anything the user builds and saves then appears alongside the demos.
 */

import type {
  Machine,
  SavedAssembly,
  ToolAssemblyOption,
  TurretSetup,
  TurretStationAssignment,
} from "../types";
import { libraryEditRevision, sessionAssemblies } from "./libraryEdits";

/* Machines --------------------------------------------------------------- */

/** The HAAS ST-20Y and its 12-station BMT turret, from the client STEP/OBJ. */
export const HAAS_ST_20Y: Machine = {
  id: "haas-st-20y",
  name: "HAAS ST-20Y",
  orientation: "Orthogonal",
  turret: {
    coupling: "BMT",
    stationCount: 12,
    mount: "Outside mounted",
    position: "Above main spindle",
  },
};

/** Machines the Setup dialog can select. One, for now — the client machine. */
export const MACHINES: Machine[] = [HAAS_ST_20Y];

export function machineById(id: string | null): Machine | undefined {
  if (id === null) return undefined;
  return MACHINES.find((machine) => machine.id === id);
}

/** "HAAS ST-20Y - Orthogonal", as the dialog labels the selected machine. */
export function machineLabel(machine: Machine): string {
  return `${machine.name} - ${machine.orientation}`;
}

/* Demo tool assemblies --------------------------------------------------- */

/**
 * A seeded set of tool assemblies, so the Turret Setup dropdown has content
 * before the user has saved any of their own. The labels follow the design.
 * Ids are stable so the default station assignment can reference them.
 */
export const DEMO_TOOL_ASSEMBLIES: ToolAssemblyOption[] = [
  { id: "demo-1", label: "Assembly #1 - Ø4mm 45° Turning (P clamp)" },
  { id: "demo-2", label: "Assembly #2 - Ø3.8mm 30° Turning (finish)" },
  { id: "demo-3", label: "Assembly #3 - Ø4mm 30° Turning (rough OD)" },
  { id: "demo-4", label: "Assembly #4 - Ø4mm 30° Turning (profile)" },
  { id: "demo-5", label: "Assembly #5 - Ø8mm Face (P clamp)" },
  { id: "demo-6", label: "Assembly #6 - Ø1mm 90° Turning (groove)" },
  { id: "demo-7", label: "Assembly #7 - Ø10mm Boring (ID)" },
  { id: "demo-8", label: "Assembly #8 - Ø3mm Parting (cut-off)" },
  { id: "demo-9", label: "Assembly #9 - Ø8mm 65° Turning (rough OD)" },
  { id: "demo-10", label: "Assembly #10 - Ø8mm 65° Turning (finish OD)" },
  { id: "demo-11", label: "Assembly #11 - Ø6mm Drilling (c/line)" },
  { id: "demo-12", label: "Assembly #12 - Ø8mm 65° Turning (semi)" },
];

/**
 * Base id of a saved assembly, shared across its per-library copies.
 *
 * `saveAssembly` writes one `SavedAssembly` per target library, each id being
 * `<base>-<docs|axial1|hub>`. Stripping the suffix collapses those copies to
 * the one logical assembly the dropdown should offer.
 */
export function assemblyBaseId(id: string): string {
  return id.replace(/-(docs|axial1|hub)$/, "");
}

/**
 * Tool assemblies offered per station: the user's real saved assemblies
 * (deduplicated across their library copies), then the seeded demos that are
 * not shadowed by a real one. Real work is listed first so it is easy to find.
 */
export function toolAssemblyOptions(records: SavedAssembly[] = sessionAssemblies()): ToolAssemblyOption[] {
  const byBase = new Map<string, ToolAssemblyOption>();
  for (const record of records) {
    const base = assemblyBaseId(record.id);
    if (!byBase.has(base)) {
      byBase.set(base, { id: base, label: record.name });
    }
  }
  const real = [...byBase.values()];
  const demos = DEMO_TOOL_ASSEMBLIES.filter((demo) => !byBase.has(demo.id));
  return [...real, ...demos];
}

/** Label for an assigned assembly id, across real and demo options. */
export function assemblyOptionLabel(
  id: string | null,
  options: ToolAssemblyOption[] = toolAssemblyOptions(),
): string {
  if (id === null || id === "") return "";
  return options.find((option) => option.id === id)?.label ?? "";
}

/* Turret setups ---------------------------------------------------------- */

/** An empty station table sized to a machine's turret. */
export function emptyStations(machine: Machine): TurretStationAssignment[] {
  return Array.from({ length: machine.turret.stationCount }, (_, i) => ({
    stationNumber: i + 1,
    toolAssemblyId: null,
  }));
}

/**
 * A fresh turret setup for a machine — a blank turret with no tools attached.
 *
 * The user starts from an empty turret and assigns assemblies station by
 * station; the dropdown offers the demo assemblies (and any real ones saved)
 * but none are pre-mounted.
 */
export function createDefaultTurretSetup(
  machine: Machine = HAAS_ST_20Y,
  name = "Turret1",
  opNumber = 10,
): TurretSetup {
  return {
    id: `turret-${Date.now()}`,
    name,
    machineId: machine.id,
    stations: emptyStations(machine),
    createdAt: Date.now(),
    opNumber,
  };
}

/**
 * Lowest unused OP number for a new manufacturing Setup, continuing the demo
 * sequence in increments of 10. The seeded demo tree occupies OP 10 and OP 20,
 * so the first turret-authored setup lands on OP 30, then OP 40, and so on.
 */
export function nextOpNumber(): number {
  const DEMO_MAX = 20; // seeded OP 10 + OP 20 nodes
  const highest = turretSetups().reduce(
    (max, setup) => Math.max(max, setup.opNumber ?? 0),
    DEMO_MAX,
  );
  return highest + 10;
}

/* Session store ---------------------------------------------------------- */

/**
 * Turret setups saved this session, keyed by id, and the machine chosen for
 * the current setup document. Kept in memory only, like the library overlay in
 * `libraryEdits`, so nothing writes back to the read-only snapshot.
 */
const TURRET_SETUPS = new Map<string, TurretSetup>();
let selectedMachineId: string | null = null;
const LISTENERS = new Set<() => void>();
let revision = 0;

function announce(): void {
  revision += 1;
  LISTENERS.forEach((listener) => listener());
}

/** Bumped on every turret change; combined with the library revision so views
 * that depend on both saved assemblies and turret setups re-read together. */
export function turretRevision(): number {
  return revision + libraryEditRevision();
}

export function subscribeToTurret(listener: () => void): () => void {
  LISTENERS.add(listener);
  return () => {
    LISTENERS.delete(listener);
  };
}

export function selectedMachine(): Machine | undefined {
  return machineById(selectedMachineId);
}

export function setSelectedMachine(id: string | null): void {
  if (selectedMachineId === id) return;
  selectedMachineId = id;
  announce();
}

export function turretSetups(): TurretSetup[] {
  return [...TURRET_SETUPS.values()];
}

export function turretSetupById(id: string): TurretSetup | undefined {
  return TURRET_SETUPS.get(id);
}

export function upsertTurretSetup(setup: TurretSetup): void {
  TURRET_SETUPS.set(setup.id, setup);
  announce();
}

export function removeTurretSetup(id: string): void {
  if (TURRET_SETUPS.delete(id)) announce();
}
