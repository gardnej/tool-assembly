import type { WorkflowState } from "../types";

interface GeneralTabProps {
  generalInfo: WorkflowState["generalInfo"];
  onChange: (patch: Partial<WorkflowState["generalInfo"]>) => void;
}

export function GeneralTab({ generalInfo, onChange }: GeneralTabProps) {
  return (
    <section className="py-2">
      <FormRow
        label="Description"
        value={generalInfo.description}
        onChange={(v) => onChange({ description: v })}
      />
      <FormRow
        label="Vendor"
        value={generalInfo.vendor}
        onChange={(v) => onChange({ vendor: v })}
      />
      <FormRow
        label="Product id"
        value={generalInfo.productId}
        onChange={(v) => onChange({ productId: v })}
      />
      <FormRow
        label="Product link"
        value={generalInfo.productLink}
        onChange={(v) => onChange({ productLink: v })}
      />
    </section>
  );
}

function FormRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-2 flex gap-0.5">
      <label className="w-[155px] shrink-0 py-1 text-xs font-medium text-weave-text">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 min-w-0 flex-1 border-0 bg-weave-input px-2 text-xs outline-none focus:ring-1 focus:ring-weave-focus/40"
      />
    </div>
  );
}
