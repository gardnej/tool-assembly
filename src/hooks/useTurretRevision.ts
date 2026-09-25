import { useSyncExternalStore } from "react";
import { subscribeToLibraryEdits } from "../data/libraryEdits";
import { subscribeToTurret, turretRevision } from "../data/turret";

/**
 * Re-renders the caller whenever a turret setup changes or a saved assembly is
 * written, since the station dropdown draws its options from both. Subscribes
 * to both stores; `turretRevision` already folds the library revision in.
 */
export function useTurretRevision(): number {
  return useSyncExternalStore(
    (listener) => {
      const a = subscribeToTurret(listener);
      const b = subscribeToLibraryEdits(listener);
      return () => {
        a();
        b();
      };
    },
    turretRevision,
    turretRevision,
  );
}
