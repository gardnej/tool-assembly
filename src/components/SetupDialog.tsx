/**
 * Setup — Fusion's New Setup command dialog.
 *
 * Rendered as a dark, floating command dialog that can be dragged around the
 * canvas by its title bar (matching how Fusion floats the Setup dialog), rather
 * than a docked side panel. In this prototype the Machine row is the interactive
 * part — choosing a machine is what gives the document its turret — while the
 * Setup / WCS / Model rows are shown for fidelity to the real dialog.
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
  const dialogRef = useRef<HTMLDivElement>(null);

  // Floating position (px, from viewport top-left). Null until first drag, so
  // the CSS default placement is used; dragging by the title bar sets it.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    setPicked(machine);
  }, [machine, open]);

  // Reset the floating position each time the dialog opens, so it always
  // reappears at its default spot rather than wherever it was last dragged.
  useEffect(() => {
    if (open) setPos(null);
  }, [open]);

  useEffect(() => {
    function onMove(ev: PointerEvent): void {
      if (dragOffset.current === null) return;
      const w = dialogRef.current?.offsetWidth ?? 340;
      const h = dialogRef.current?.offsetHeight ?? 200;
      // Clamp so the title bar can't be dragged fully off-screen.
      const x = Math.min(
        Math.max(ev.clientX - dragOffset.current.dx, 8 - w + 48),
        window.innerWidth - 48,
      );
      const y = Math.min(Math.max(ev.clientY - dragOffset.current.dy, 0), window.innerHeight - 30);
      setPos({ x, y });
    }
    function onUp(): void {
      dragOffset.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  function onTitlePointerDown(ev: React.PointerEvent): void {
    // Ignore drags that start on a button (e.g. the expand icon).
    if ((ev.target as HTMLElement).closest("button") !== null) return;
    const rect = dialogRef.current?.getBoundingClientRect();
    if (rect === undefined) return;
    dragOffset.current = { dx: ev.clientX - rect.left, dy: ev.clientY - rect.top };
  }

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
    <aside
      ref={dialogRef}
      className="setupd"
      role="dialog"
      aria-modal="false"
      aria-label="Setup"
      style={pos !== null ? { top: pos.y, left: pos.x, right: "auto" } : undefined}
    >
      <header className="setupd__title-bar" onPointerDown={onTitlePointerDown}>
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
                  className="setupd__select-btn setupd__select-btn--machine"
                  title={machineLabel(picked)}
                  onClick={() => {
                    setMenuOpen((v) => !v);
                  }}
                >
                  <IconCursor />
                  <span className="setupd__machine-name">{machineLabel(picked)}</span>
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
