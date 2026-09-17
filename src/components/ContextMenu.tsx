import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface ContextMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  // Drive position through state so the menu is placed correctly on the very
  // first render. Start at the requested point; the layout effect below clamps
  // it to the viewport once the menu's real size is known.
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node) === true) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Keep the menu inside the viewport when opened near the right/bottom edge.
  // useLayoutEffect measures and clamps before the browser paints, so the menu
  // appears in the correct place on the first click (no one-frame flash at the
  // bottom edge). The clamp is derived from the requested x/y props — never from
  // the previously mutated DOM — so it is idempotent across opens.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (menu === null) return;
    const { width, height } = menu.getBoundingClientRect();
    const left = x + width > window.innerWidth ? Math.max(0, window.innerWidth - width - 4) : x;
    const top = y + height > window.innerHeight ? Math.max(0, window.innerHeight - height - 4) : y;
    setPos({ left, top });
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-50 w-max min-w-[190px] rounded-[2px] border border-weave-divider-heavy bg-weave-header py-1 shadow-lg shadow-black/40"
    >
      {items.map((item) => (
        <div key={item.id}>
          {item.separatorBefore === true && (
            <div className="my-1 h-px bg-weave-divider-heavy" />
          )}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled === true}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
            className="block w-full px-3 py-1.5 text-left text-xs text-weave-text hover:bg-weave-selected disabled:cursor-default disabled:text-weave-text-placeholder disabled:opacity-50 disabled:hover:bg-transparent"
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
