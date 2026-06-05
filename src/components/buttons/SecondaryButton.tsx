import type { ButtonHTMLAttributes, ReactNode } from "react";

interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function SecondaryButton({
  children,
  className = "",
  disabled,
  ...props
}: SecondaryButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        "inline-flex h-6 min-w-[52px] items-center justify-center rounded-[2px] px-3",
        "bg-weave-surface-250 text-xs font-semibold text-weave-text",
        "border border-weave-divider-heavy",
        "hover:bg-weave-surface-300 active:brightness-95",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
