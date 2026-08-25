import { useSyncExternalStore } from "react";
import { libraryEditRevision, subscribeToLibraryEdits } from "../data/libraryEdits";

/**
 * Re-renders the caller whenever a record is edited or a library is renamed.
 *
 * Libraries and records are read through plain functions rather than held in
 * React state, so views that show them memoise against this revision to pick
 * the session's changes up.
 */
export function useLibraryRevision(): number {
  return useSyncExternalStore(
    subscribeToLibraryEdits,
    libraryEditRevision,
    libraryEditRevision,
  );
}
