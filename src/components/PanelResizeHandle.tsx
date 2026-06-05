import type { PointerEvent } from "react";

interface PanelResizeHandleProps {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
}

/** Vertical splitter — sits on the left edge of the preview pane (Weave / Fusion pattern). */
export function PanelResizeHandle({
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: PanelResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={(event) => {
        // Keyboard nudge for accessibility prototype
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
      }}
      className={[
        "group relative z-10 flex w-[6px] shrink-0 cursor-col-resize items-center justify-center",
        "border-l border-weave-divider bg-weave-tab-bar",
        "hover:bg-weave-tab-active active:bg-weave-selected",
        "touch-none select-none",
      ].join(" ")}
    >
      <div
        className={[
          "flex flex-col gap-[3px] rounded-sm px-[1px] py-1",
          "opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100",
        ].join(" ")}
        aria-hidden="true"
      >
        <span className="block h-[2px] w-[2px] rounded-full bg-weave-text-placeholder" />
        <span className="block h-[2px] w-[2px] rounded-full bg-weave-text-placeholder" />
        <span className="block h-[2px] w-[2px] rounded-full bg-weave-text-placeholder" />
      </div>
    </div>
  );
}
