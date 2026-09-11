/**
 * Setup — Fusion's New Setup command dialog.
 *
 * Rendered as the light-grey command palette docked at the right of the canvas,
 * the way Fusion draws Setup (distinct from the dark tool dialogues). In this
 * prototype the Machine row is the interactive part — choosing a machine is what
 * gives the document its turret — while the Setup / WCS / Model rows are shown
 * for fidelity to the real dialog.
 */

import { useEffect, useRef, useState } from "react";
import type { Machine } from "../types";
import { MACHINES, machineLabel } from "../data/turret";
import "./setup-dialog.css";

export type SetupDialogProps = {
  open: boolean;
  machine: Machine | null;
  onClose: () => void;
  onConfirm: (machine: Machine | null) => void;
};

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
      className={open ? "setupd__chevron" : "setupd__chevron setupd__chevron--closed"}
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
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden>
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function Section({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="setupd__section">
      <button
        type="button"
        className="setupd__section-head"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        <IconChevron open={open} />
        {label}
      </button>
      {open ? <div className="setupd__section-body">{children}</div> : null}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="setupd__row">
      <span className="setupd__row-label">{label}</span>
      <span className="setupd__value">{children}</span>
    </div>
  );
}

export function SetupDialog({ open, machine, onClose, onConfirm }: SetupDialogProps) {
  const [picked, setPicked] = useState<Machine | null>(machine);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPicked(machine);
  }, [machine, open]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointerDown(ev: MouseEvent): void {
      if (wrapRef.current?.contains(ev.target as Node) === true) return;
      setMenuOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [menuOpen]);

  if (open !== true) return null;

  return (
    <aside className="setupd" role="dialog" aria-modal="false" aria-label="Setup">
      <header className="setupd__title-bar">
        <h2 className="setupd__title">
          SETUP <span className="setupd__title-id">: Setup1</span>
        </h2>
        <button type="button" className="setupd__icon-plain" title="Expand" aria-label="Expand dialog">
          <IconExpand />
        </button>
      </header>

      <div className="setupd__tabs">
        <button type="button" className="setupd__tab setupd__tab--active">
          Setup
        </button>
        <button type="button" className="setupd__tab">
          Stock
        </button>
        <button type="button" className="setupd__tab">
          Post Process
        </button>
      </div>

      <div className="setupd__body">
        <Section label="Machine">
          <Row label="Machine">
            <div className="setupd__machine-wrap" ref={wrapRef}>
              {picked !== null ? (
                <button
                  type="button"
                  className="setupd__select-btn"
                  onClick={() => {
                    setMenuOpen((v) => !v);
                  }}
                >
                  <IconCursor />
                  {machineLabel(picked)}
                </button>
              ) : (
                <button
                  type="button"
                  className="setupd__select-btn setupd__select-btn--empty"
                  onClick={() => {
                    setMenuOpen((v) => !v);
                  }}
                >
                  Select…
                </button>
              )}
              {picked !== null ? (
                <button
                  type="button"
                  className="setupd__clear"
                  title="Clear machine"
                  aria-label="Clear machine"
                  onClick={() => {
                    setPicked(null);
                  }}
                >
                  <IconClose />
                </button>
              ) : null}
              {menuOpen ? (
                <div className="setupd__machine-menu" role="listbox">
                  {MACHINES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="setupd__machine-opt"
                      role="option"
                      aria-selected={picked?.id === m.id}
                      onClick={() => {
                        setPicked(m);
                        setMenuOpen(false);
                      }}
                    >
                      {m.name}{" "}
                      <span className="setupd__machine-opt-sub">— {m.orientation}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Row>
        </Section>

        <Section label="Setup">
          <Row label="Operation Type">
            <span className="setupd__static">Turning or mill/turn</span>
          </Row>
          <Row label="Spindle">
            <span className="setupd__static">Main spindle</span>
          </Row>
        </Section>

        <Section label="Work Coordinate System (WCS)">
          <Row label="Orientation">
            <span className="setupd__static">Z axis/plane &amp; X axis</span>
          </Row>
          <Row label="Z Axis (Rotary Axis)">
            <span className="setupd__static">Face</span>
          </Row>
          <Row label="Origin">
            <span className="setupd__static">Stock front</span>
          </Row>
        </Section>

        <Section label="Model" defaultOpen={false}>
          <Row label="Model">
            <span className="setupd__static">Body1</span>
          </Row>
        </Section>
      </div>

      <footer className="setupd__footer">
        <button
          type="button"
          className="setupd__footer-btn setupd__footer-btn--primary"
          disabled={picked === null}
          onClick={() => {
            onConfirm(picked);
          }}
        >
          OK
        </button>
        <button type="button" className="setupd__footer-btn" onClick={onClose}>
          Cancel
        </button>
      </footer>
    </aside>
  );
}
