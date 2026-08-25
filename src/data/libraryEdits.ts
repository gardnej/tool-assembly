import type { LibraryRef, LibraryToolRecord } from "./realLibrary";
import type { SavedAssembly } from "../types";

/**
 * Edits made to library records in this session.
 *
 * The snapshot the prototype ships is a read-only export of a real Fusion
 * library, so edits are kept as an overlay on top of it rather than written
 * back into it. Everything that reads a record reads it through this overlay,
 * which is why an edit made in the library shows up in an assembly that already
 * uses the record.
 */

/**
 * The fields the tool editor can change.
 *
 * Fusion's tool dialog carries more than the export does — a product link, the
 * cutter material, a post-processor comment and its flags — so those live only
 * here. Everything else maps back onto the record.
 */
export interface ToolRecordEdit {
  description: string;
  vendor: string;
  productId: string;
  productLink: string;
  unit: string;
  material: string;
  clockwiseSpindleRotation: boolean;
  geometry: Record<string, number | string | boolean>;
  postProcess: ToolPostProcessEdit;
}

export interface ToolPostProcessEdit {
  number: number | null;
  lengthOffset: number | null;
  diameterOffset: number | null;
  turret: number | null;
  stationNumber: number | null;
  halfIndex: boolean | null;
  comment: string;
  manualToolChange: boolean;
  liveTool: boolean;
  breakControl: boolean;
}

const EDITS = new Map<string, ToolRecordEdit>();
const RENAMES = new Map<string, string>();
/**
 * Libraries the user asked to remove this session.
 *
 * The snapshot itself is read-only, so a deleted library is simply hidden from
 * every accessor — its records are skipped and the tree stops rendering it.
 * Reload the app to bring it back, since the delete is not persisted.
 */
const HIDDEN_LIBRARIES = new Set<string>();
/**
 * Libraries created in this session, keyed by id.
 *
 * The snapshot is read-only, but the app has to keep saved assemblies
 * somewhere the tree can find. New libraries live here alongside the imported
 * ones, and never write back to disk.
 */
const SESSION_LIBRARIES = new Map<string, LibraryRef>();
/** Tool records saved this session. */
const SESSION_TOOLS = new Map<string, LibraryToolRecord>();
/**
 * Assemblies saved this session, keyed by ``id``.
 *
 * Each entry is the full chain — block + stacks + config — so an edit from
 * the library can reopen the workflow in the same state.
 */
const SESSION_ASSEMBLIES = new Map<string, SavedAssembly>();
const LISTENERS = new Set<() => void>();

/** Bumped on every change, so views can memoise against it. */
let revision = 0;

export function libraryEditRevision(): number {
  return revision;
}

export function subscribeToLibraryEdits(listener: () => void): () => void {
  LISTENERS.add(listener);
  return () => {
    LISTENERS.delete(listener);
  };
}

export function toolEditFor(id: string): ToolRecordEdit | undefined {
  return EDITS.get(id);
}

export function isToolEdited(id: string): boolean {
  return EDITS.has(id);
}

export function saveToolEdit(id: string, edit: ToolRecordEdit): void {
  EDITS.set(id, edit);
  announce();
}

export function revertToolEdit(id: string): void {
  if (!EDITS.delete(id)) return;
  announce();
}

export function clearToolEdits(): void {
  if (EDITS.size === 0) return;
  EDITS.clear();
  announce();
}

/** The record as edited, or the record itself when it has not been touched. */
export function applyToolEdit(record: LibraryToolRecord): LibraryToolRecord {
  const edit = EDITS.get(record.id);
  if (edit === undefined) return record;

  return {
    ...record,
    description: edit.description,
    vendor: edit.vendor,
    productId: edit.productId,
    unit: edit.unit,
    geometry: { ...record.geometry, ...edit.geometry },
    postProcess: {
      ...record.postProcess,
      number: edit.postProcess.number,
      turret: edit.postProcess.turret,
      compensationOffset: edit.postProcess.diameterOffset,
      stationNumber: edit.postProcess.stationNumber,
      halfIndex: edit.postProcess.halfIndex,
    },
  };
}

/** The record's current values, as the editor should open on them. */
export function toolEditDraft(record: LibraryToolRecord): ToolRecordEdit {
  const saved = EDITS.get(record.id);
  if (saved !== undefined) {
    return {
      ...saved,
      geometry: { ...saved.geometry },
      postProcess: { ...saved.postProcess },
    };
  }

  return {
    description: record.description,
    vendor: record.vendor,
    productId: record.productId,
    productLink: "",
    unit: record.unit,
    material: "",
    clockwiseSpindleRotation: true,
    geometry: { ...record.geometry },
    postProcess: {
      number: record.postProcess.number,
      lengthOffset: record.postProcess.number,
      diameterOffset: record.postProcess.compensationOffset,
      turret: record.postProcess.turret,
      stationNumber: record.postProcess.stationNumber,
      halfIndex: record.postProcess.halfIndex,
      comment: "",
      manualToolChange: false,
      liveTool: false,
      breakControl: false,
    },
  };
}

/* Library names ----------------------------------------------------------- */

export function isLibraryRenamed(id: string): boolean {
  return RENAMES.has(id);
}

export function renameLibrary(id: string, name: string): void {
  const trimmed = name.trim();
  if (trimmed === "") return;
  RENAMES.set(id, trimmed);
  announce();
}

export function resetLibraryName(id: string): void {
  if (!RENAMES.delete(id)) return;
  announce();
}

export function clearLibraryRenames(): void {
  if (RENAMES.size === 0) return;
  RENAMES.clear();
  announce();
}

/* Library deletion (session-only) --------------------------------------- */

export function isLibraryHidden(id: string): boolean {
  return HIDDEN_LIBRARIES.has(id);
}

export function hideLibrary(id: string): void {
  if (HIDDEN_LIBRARIES.has(id)) return;
  HIDDEN_LIBRARIES.add(id);
  announce();
}

export function unhideLibrary(id: string): void {
  if (!HIDDEN_LIBRARIES.delete(id)) return;
  announce();
}

export function clearHiddenLibraries(): void {
  if (HIDDEN_LIBRARIES.size === 0) return;
  HIDDEN_LIBRARIES.clear();
  announce();
}

/* Session-scope libraries and records ---------------------------------- */

/**
 * Add a library to the session pool, or replace one already registered under
 * that id. Recomputes counts is left to the caller so this stays cheap.
 */
export function upsertSessionLibrary(library: LibraryRef): void {
  SESSION_LIBRARIES.set(library.id, library);
  announce();
}

export function sessionLibraries(): LibraryRef[] {
  return [...SESSION_LIBRARIES.values()];
}

/** Add a record to the session pool. Records are addressed by their id. */
export function addSessionTool(record: LibraryToolRecord): void {
  SESSION_TOOLS.set(record.id, record);
  announce();
}

export function sessionTools(): LibraryToolRecord[] {
  return [...SESSION_TOOLS.values()];
}

export function clearSession(): void {
  if (
    SESSION_LIBRARIES.size === 0 &&
    SESSION_TOOLS.size === 0 &&
    SESSION_ASSEMBLIES.size === 0
  ) {
    return;
  }
  SESSION_LIBRARIES.clear();
  SESSION_TOOLS.clear();
  SESSION_ASSEMBLIES.clear();
  announce();
}

/**
 * Save an assembly (or replace one already stored under the same id).
 *
 * The record carries the whole chain — block, stacks, config — so editing it
 * later reopens the workflow with the same state.
 */
export function upsertSessionAssembly(assembly: SavedAssembly): void {
  SESSION_ASSEMBLIES.set(assembly.id, assembly);
  announce();
}

export function removeSessionAssembly(id: string): void {
  if (SESSION_ASSEMBLIES.delete(id)) announce();
}

export function sessionAssemblies(): SavedAssembly[] {
  return [...SESSION_ASSEMBLIES.values()];
}

export function sessionAssemblyById(id: string): SavedAssembly | undefined {
  return SESSION_ASSEMBLIES.get(id);
}

/** Assemblies saved into the library with the given id. */
export function sessionAssembliesForLibrary(libraryId: string): SavedAssembly[] {
  return [...SESSION_ASSEMBLIES.values()].filter(
    (assembly) => assembly.libraryId === libraryId,
  );
}

/**
 * The library under its session name.
 *
 * The breadcrumb follows the rename too, since it is the name with the folders
 * it sits under in front of it.
 */
export function applyLibraryRename(library: LibraryRef): LibraryRef {
  const name = RENAMES.get(library.id);
  if (name === undefined) return library;

  const trail = library.breadcrumb.split(" > ").slice(0, -1);
  return {
    ...library,
    name,
    breadcrumb: [...trail, name].join(" > "),
  };
}

function announce(): void {
  revision += 1;
  LISTENERS.forEach((listener) => listener());
}
