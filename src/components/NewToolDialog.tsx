import { useState, type MouseEvent } from "react";
import { NEW_TOOL_CATEGORIES } from "../data/newToolTypes";
import "./new-tool-dialog.css";

interface NewToolDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectToolType: (toolTypeId: string) => void;
}

function ToolTypeIcon({ optionId }: { optionId: string }) {
  if (optionId === "tool-assembly") {
    return (
      <svg width="48" height="36" viewBox="0 0 48 36" aria-hidden>
        <rect x="8" y="10" width="14" height="18" rx="1" fill="#9aa5b5" stroke="#6a7585" />
        <polygon points="24,8 36,14 36,28 24,34 12,28 12,14" fill="#f0c060" stroke="#c89430" />
        <rect x="30" y="4" width="10" height="28" rx="1" fill="#b8c0cc" stroke="#7a8696" />
      </svg>
    );
  }

  if (optionId.startsWith("turning")) {
    return (
      <svg width="48" height="36" viewBox="0 0 48 36" aria-hidden>
        <rect x="6" y="14" width="22" height="10" rx="1" fill="#9aa5b5" />
        <polygon points="28,10 40,18 40,28 28,26" fill="#f0c060" stroke="#c89430" />
      </svg>
    );
  }

  if (
    optionId.includes("mill") ||
    optionId.includes("drill") ||
    optionId.includes("bore") ||
    optionId.includes("tap") ||
    optionId.includes("reamer")
  ) {
    return (
      <svg width="48" height="36" viewBox="0 0 48 36" aria-hidden>
        <rect x="20" y="4" width="8" height="28" rx="1" fill="#c5cdd8" stroke="#8a96a8" />
        <path d="M18 30 L24 34 L30 30 Z" fill="#a8b4c4" />
      </svg>
    );
  }

  if (optionId === "probe") {
    return (
      <svg width="48" height="36" viewBox="0 0 48 36" aria-hidden>
        <circle cx="24" cy="18" r="6" fill="#e85d5d" />
        <rect x="22" y="4" width="4" height="12" fill="#9aa5b5" />
      </svg>
    );
  }

  if (optionId === "tool-block" || optionId === "holder") {
    return (
      <svg width="48" height="36" viewBox="0 0 48 36" aria-hidden>
        <rect x="10" y="8" width="28" height="20" rx="2" fill="#9aa5b5" stroke="#6a7585" />
      </svg>
    );
  }

  return (
    <svg width="48" height="36" viewBox="0 0 48 36" aria-hidden>
      <rect x="14" y="10" width="20" height="16" rx="2" fill="#8a96a8" stroke="#6a7585" />
    </svg>
  );
}

export function NewToolDialog({ open, onClose, onSelectToolType }: NewToolDialogProps) {
  const [selectedId, setSelectedId] = useState<string>("turning-threading");

  if (!open) {
    return null;
  }

  const handleBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSelect = (optionId: string) => {
    setSelectedId(optionId);
    if (optionId === "tool-assembly") {
      onSelectToolType(optionId);
    }
  };

  return (
    <div className="nt-overlay" role="presentation" onMouseDown={handleBackdrop}>
      <section
        className="nt-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nt-title"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <header className="nt-head">
          <h2 id="nt-title" className="nt-head__title">
            New tool
          </h2>
          <button
            type="button"
            className="nt-head__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="nt-body">
          {NEW_TOOL_CATEGORIES.map((category) => (
            <section key={category.id} className="nt-category" aria-label={category.label}>
              <h3 className="nt-category__title">{category.label}</h3>
              <div className="nt-grid">
                {category.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={[
                      "nt-card",
                      selectedId === option.id ? "nt-card--selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      handleSelect(option.id);
                    }}
                  >
                    <span className="nt-card__icon">
                      <ToolTypeIcon optionId={option.id} />
                    </span>
                    <span className="nt-card__label">{option.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="nt-footer">
          <button type="button" className="nt-footer__close" onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
