/**
 * Turret Setup — assign tool assemblies to the stations of a machine's turret.
 *
 * A Fusion command dialog, docked at the right of the canvas in the prototype's
 * dark theme. The station table is exactly `machine.turret.stationCount` rows;
 * each row's dropdown offers the real saved assemblies plus the seeded demos.
 * The machine's turret facts (type, mount, position) are shown read-only, since
 * they belong to the machine chosen in the Setup dialog rather than to the
 * turret setup.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  Machine,
  ToolAssemblyOption,
  TurretSetup,
  TurretStationAssignment,
} from "../types";
import { machineLabel } from "../data/turret";
import "./turret-setup-dialog.css";

export type TurretSetupDialogProps = {
  open: boolean;
  machine: Machine | null;
  /** Working setup to edit; committed on Ok. */
  setup: TurretSetup;
  /** Tool assemblies offered per station (real saved + demo). */
  options: ToolAssemblyOption[];
  /** Existing named turret setups, for the "Turret setup" dropdown. */
  existingSetups: TurretSetup[];
  onClose: () => void;
  onConfirm: (setup: TurretSetup) => void;
  /** Open the Setup dialog to choose or change the machine. */
  onEditMachine: () => void;
  /** Load a different existing setup into the dialog. */
  onSelectSetup?: (setupId: string) => void;
  /** Open the Tool Library as an assembly picker for the given station. */
  onPickFromLibrary?: (stationNumber: number) => void;
  /**
   * An assembly the library picker chose for a station. Applied to the working
   * table when its `token` changes, so it patches one station without
   * discarding the rest of the in-progress edits.
   */
  pendingAssignment?: {
    stationNumber: number;
    toolAssemblyId: string;
    token: number;
  } | null;
};

/** Sentinel option value that opens the library picker instead of assigning. */
const PICK_FROM_LIBRARY = "__library__";

function IconExpand() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
      <path fill="none" stroke="currentColor" strokeWidth="1.6" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={open ? "tsd__chevron" : "tsd__chevron tsd__chevron--closed"}
      viewBox="0 0 12 12"
      aria-hidden
    >
      <path fill="currentColor" d="M2 4l4 4 4-4z" />
    </svg>
  );
}

function IconCursor() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M5 3l14 8-6 1.5L10 20 5 3z" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
      <path fill="none" stroke="currentColor" strokeWidth="1.8" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function IconUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M12 7l-6 7h12z" />
    </svg>
  );
}

function IconDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M12 17l6-7H6z" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12" />
    </svg>
  );
}

export function TurretSetupDialog({
  open,
  machine,
  setup,
  options,
  existingSetups,
  onClose,
  onConfirm,
  onEditMachine,
  onSelectSetup,
  onPickFromLibrary,
  pendingAssignment,
}: TurretSetupDialogProps) {
  const titleId = useId();
  const [machineOpen, setMachineOpen] = useState(true);
  const [turretOpen, setTurretOpen] = useState(true);
  const [name, setName] = useState(setup.name);
  const [stations, setStations] = useState<TurretStationAssignment[]>(setup.stations);
  const [selectedStation, setSelectedStation] = useState<number | null>(
    setup.stations[0]?.stationNumber ?? null,
  );

  // Re-seed the working copy whenever a different setup is opened.
  useEffect(() => {
    setName(setup.name);
    setStations(setup.stations);
    setSelectedStation(setup.stations[0]?.stationNumber ?? null);
  }, [setup]);

  const selectedIndex = useMemo(
    () => stations.findIndex((s) => s.stationNumber === selectedStation),
    [stations, selectedStation],
  );

  const setAssembly = useCallback((stationNumber: number, toolAssemblyId: string | null) => {
    setStations((prev) =>
      prev.map((s) => (s.stationNumber === stationNumber ? { ...s, toolAssemblyId } : s)),
    );
  }, []);

  // Apply an assembly the library picker chose, once per pick (tracked by
  // token) so it patches just that station and leaves other edits intact.
  const appliedPickToken = useRef<number | null>(null);
  useEffect(() => {
    if (!pendingAssignment) return;
    if (appliedPickToken.current === pendingAssignment.token) return;
    appliedPickToken.current = pendingAssignment.token;
    setAssembly(pendingAssignment.stationNumber, pendingAssignment.toolAssemblyId);
    setSelectedStation(pendingAssignment.stationNumber);
  }, [pendingAssignment, setAssembly]);

  // Reorder moves the *assembly* between fixed stations (the numbers stay put),
  // since a BMT turret's station count and numbering are set by the machine.
  const moveSelected = useCallback(
    (delta: number) => {
      if (selectedIndex < 0) return;
      const next = selectedIndex + delta;
      if (next < 0 || next >= stations.length) return;
      setStations((prev) => {
        const copy = [...prev];
        const a = copy[selectedIndex];
        const b = copy[next];
        copy[selectedIndex] = { ...a, toolAssemblyId: b.toolAssemblyId };
        copy[next] = { ...b, toolAssemblyId: a.toolAssemblyId };
        return copy;
      });
      setSelectedStation(stations[next].stationNumber);
    },
    [selectedIndex, stations],
  );

  const clearSelected = useCallback(() => {
    if (selectedStation === null) return;
    setAssembly(selectedStation, null);
  }, [selectedStation, setAssembly]);

  if (open !== true) return null;

  const turret = machine?.turret ?? null;
  const setupOptionValue = existingSetups.some((s) => s.id === setup.id) ? setup.id : "new";

  return (
    <aside className="tsd" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="tsd__title-bar">
        <h2 id={titleId} className="tsd__title">
          Turret setup
        </h2>
        <button type="button" className="tsd__icon-plain" title="Expand" aria-label="Expand dialog">
          <IconExpand />
        </button>
      </header>

      <div className="tsd__body">
        {/* Machine ---------------------------------------------------------- */}
        <section className="tsd__section">
          <button
            type="button"
            className="tsd__section-head"
            aria-expanded={machineOpen}
            onClick={() => {
              setMachineOpen((v) => !v);
            }}
          >
            <IconChevron open={machineOpen} />
            Machine
          </button>
          {machineOpen ? (
            <div className="tsd__section-body">
              <div className="tsd__row">
                <span className="tsd__row-label">Machine</span>
                <span className="tsd__machine-cluster">
                  {machine !== null ? (
                    <>
                      <span className="tsd__chip">
                        <IconCursor />
                        1 selected
                      </span>
                      <button
                        type="button"
                        className="tsd__btn"
                        onClick={onEditMachine}
                      >
                        Edit…
                      </button>
                      <button
                        type="button"
                        className="tsd__btn tsd__btn--icon"
                        title="Clear machine"
                        aria-label="Clear machine"
                        onClick={onEditMachine}
                      >
                        <IconClose />
                      </button>
                    </>
                  ) : (
                    <button type="button" className="tsd__btn" onClick={onEditMachine}>
                      Select…
                    </button>
                  )}
                </span>
              </div>
              {machine !== null ? (
                <div className="tsd__row-sub">{machineLabel(machine)}</div>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Turret setup ----------------------------------------------------- */}
        <section className="tsd__section">
          <button
            type="button"
            className="tsd__section-head"
            aria-expanded={turretOpen}
            onClick={() => {
              setTurretOpen((v) => !v);
            }}
          >
            <IconChevron open={turretOpen} />
            Turret setup
          </button>
          {turretOpen ? (
            <div className="tsd__section-body">
              <div className="tsd__row">
                <span className="tsd__row-label">Turret setup</span>
                <select
                  className="tsd__select"
                  value={setupOptionValue}
                  onChange={(e) => {
                    if (e.target.value !== "new") onSelectSetup?.(e.target.value);
                  }}
                >
                  <option value="new">Create new turret setup</option>
                  {existingSetups.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tsd__row">
                <span className="tsd__row-label">Turret name</span>
                <input
                  className="tsd__input"
                  value={name}
                  placeholder="Turret name"
                  onChange={(e) => {
                    setName(e.target.value);
                  }}
                />
              </div>
              <div className="tsd__row">
                <span className="tsd__row-label">Turret type</span>
                <span className="tsd__row-value">{turret?.coupling ?? "—"}</span>
              </div>
              <div className="tsd__row">
                <span className="tsd__row-label">Mount</span>
                <span className="tsd__row-value">{turret?.mount ?? "—"}</span>
              </div>
              <div className="tsd__row">
                <span className="tsd__row-label">Position</span>
                <span className="tsd__row-value">{turret?.position ?? "—"}</span>
              </div>
            </div>
          ) : null}
        </section>

        {/* Station table ---------------------------------------------------- */}
        <div className="tsd__table">
          <div className="tsd__table-head">
            <span>Station</span>
            <span>Tool assembly</span>
          </div>
          <ul className="tsd__station-list" role="list">
            {stations.map((row) => {
              const selected = row.stationNumber === selectedStation;
              const value = row.toolAssemblyId ?? "";
              return (
                <li
                  key={row.stationNumber}
                  className={selected ? "tsd__station tsd__station--selected" : "tsd__station"}
                  onClick={() => {
                    setSelectedStation(row.stationNumber);
                  }}
                >
                  <span className="tsd__station-num">{row.stationNumber}</span>
                  <select
                    className="tsd__station-select"
                    data-empty={value === "" ? "true" : "false"}
                    value={value}
                    aria-label={`Tool assembly for station ${row.stationNumber}`}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === PICK_FROM_LIBRARY) {
                        // Transient: hand off to the library picker; leave the
                        // stored value untouched so the select reverts.
                        onPickFromLibrary?.(row.stationNumber);
                        return;
                      }
                      setAssembly(row.stationNumber, next === "" ? null : next);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <option value="">Select tool assembly</option>
                    {options.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                    {onPickFromLibrary ? (
                      <option value={PICK_FROM_LIBRARY}>Select from library…</option>
                    ) : null}
                  </select>
                </li>
              );
            })}
          </ul>

          <div className="tsd__table-toolbar">
            <button
              type="button"
              className="tsd__tool-btn"
              title="Move assembly up"
              aria-label="Move assembly up"
              disabled={selectedIndex <= 0}
              onClick={() => {
                moveSelected(-1);
              }}
            >
              <IconUp />
            </button>
            <button
              type="button"
              className="tsd__tool-btn"
              title="Move assembly down"
              aria-label="Move assembly down"
              disabled={selectedIndex < 0 || selectedIndex >= stations.length - 1}
              onClick={() => {
                moveSelected(1);
              }}
            >
              <IconDown />
            </button>
            <button
              type="button"
              className="tsd__tool-btn"
              title="Station settings"
              aria-label="Station settings"
              disabled={selectedIndex < 0}
            >
              <IconGear />
            </button>
            <button
              type="button"
              className="tsd__tool-btn"
              title="Clear station"
              aria-label="Clear station"
              disabled={selectedStation === null}
              onClick={clearSelected}
            >
              <IconTrash />
            </button>
          </div>
        </div>
      </div>

      <footer className="tsd__footer">
        <button
          type="button"
          className="tsd__footer-btn tsd__footer-btn--primary"
          onClick={() => {
            onConfirm({ ...setup, name: name.trim() || setup.name, stations });
          }}
        >
          Ok
        </button>
        <button type="button" className="tsd__footer-btn" onClick={onClose}>
          Cancel
        </button>
      </footer>
    </aside>
  );
}
