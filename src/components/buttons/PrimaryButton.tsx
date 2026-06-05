import type { ButtonHTMLAttributes, ReactNode } from "react";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  split?: boolean;
}

export function PrimaryButton({
  children,
  className = "",
  disabled,
  split = false,
  ...props
}: PrimaryButtonProps) {
  if (split) {
    return (
      <div className="inline-flex h-6 overflow-hidden rounded-[2px]">
        <button
          type="button"
          disabled={disabled}
          className={[
            "inline-flex min-w-[44px] items-center justify-center px-3",
            "bg-weave-primary text-xs font-semibold text-white",
            "hover:bg-weave-primary-hover active:brightness-95",
            "disabled:cursor-not-allowed disabled:opacity-45",
            className,
          ].join(" ")}
          {...props}
        >
          {children}
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label="More options"
          className={[
            "flex w-5 items-center justify-center border-l border-white/20",
            "bg-weave-primary text-[8px] text-white",
            "hover:bg-weave-primary-hover disabled:opacity-45",
          ].join(" ")}
        >
          ▾
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        "inline-flex h-6 min-w-[52px] items-center justify-center rounded-[2px] px-3",
        "bg-weave-primary text-xs font-semibold text-white",
        "hover:bg-weave-primary-hover active:brightness-95",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
