import type { ValidationIssue, ValidationStatus } from "../types";
import { PrimaryButton } from "./buttons/PrimaryButton";
import { SecondaryButton } from "./buttons/SecondaryButton";

interface ValidationPanelProps {
  status: ValidationStatus;
  issues: ValidationIssue[];
  onValidate: () => void;
  onContinue: () => void;
}

export function ValidationPanel({
  status,
  issues,
  onValidate,
  onContinue,
}: ValidationPanelProps) {
  const statusMeta = getStatusMeta(status);

  return (
    <section
      className={[
        "rounded-[2px] border p-3",
        statusMeta.borderClass,
        statusMeta.bgClass,
      ].join(" ")}
    >
      <div className="mb-2 flex items-start gap-2">
        <StatusIcon status={status} />
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-bold text-weave-text">{statusMeta.title}</h3>
          <p className="text-[11px] text-weave-text-placeholder">{statusMeta.subtitle}</p>
        </div>
      </div>

      {issues.length > 0 && (
        <ul className="mb-3 space-y-1">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className={[
                "flex items-start gap-2 rounded px-2 py-1 text-[11px]",
                issue.severity === "error"
                  ? "bg-weave-error-bg text-weave-error-text"
                  : "bg-weave-warning-bg text-weave-warning-text",
              ].join(" ")}
            >
              <span className="mt-px shrink-0 font-bold">
                {issue.severity === "error" ? "✕" : "!"}
              </span>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}

      {status === "idle" && (
        <p className="mb-3 text-[11px] text-weave-text-placeholder">
          Run compatibility checks for geometry, connection interfaces, and cutting
          parameters before finalizing the assembly.
        </p>
      )}

      <div className="flex gap-2">
        <PrimaryButton onClick={onValidate}>
          {status === "checking" ? "Checking…" : "Validate Assembly"}
        </PrimaryButton>
        {(status === "pass" || status === "warning") && (
          <SecondaryButton onClick={onContinue}>Continue to Review</SecondaryButton>
        )}
      </div>

      {/* Future: POST /api/tool-assemblies/validate or Fusion CAM compatibility service */}
    </section>
  );
}

function getStatusMeta(status: ValidationStatus) {
  switch (status) {
    case "pass":
      return {
        title: "Assembly compatible",
        subtitle: "All checks passed. Ready for review.",
        borderClass: "border-weave-success/30",
        bgClass: "bg-weave-success-bg",
      };
    case "warning":
      return {
        title: "Compatibility warnings",
        subtitle: "Assembly can proceed with noted warnings.",
        borderClass: "border-weave-warning/40",
        bgClass: "bg-weave-warning-bg",
      };
    case "fail":
      return {
        title: "Compatibility issues found",
        subtitle: "Resolve errors before completing the assembly.",
        borderClass: "border-weave-error-border",
        bgClass: "bg-weave-error-bg",
      };
    case "checking":
      return {
        title: "Validating…",
        subtitle: "Checking component fit and parameters.",
        borderClass: "border-weave-divider",
        bgClass: "bg-weave-input/50",
      };
    default:
      return {
        title: "Compatibility check",
        subtitle: "Not yet validated.",
        borderClass: "border-weave-divider",
        bgClass: "bg-weave-input/50",
      };
  }
}

function StatusIcon({ status }: { status: ValidationStatus }) {
  const map: Record<ValidationStatus, { glyph: string; className: string }> = {
    idle: { glyph: "○", className: "text-weave-text-placeholder" },
    checking: { glyph: "…", className: "text-weave-primary" },
    pass: { glyph: "✓", className: "text-weave-success" },
    warning: { glyph: "!", className: "text-weave-warning" },
    fail: { glyph: "✕", className: "text-weave-error-text" },
  };
  const { glyph, className } = map[status];
  return (
    <span
      className={[
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold",
        className,
      ].join(" ")}
    >
      {glyph}
    </span>
  );
}
