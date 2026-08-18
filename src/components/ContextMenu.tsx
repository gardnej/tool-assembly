import { useEffect, useRef } from "react";

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
  useEffect(() => {
    const menu = menuRef.current;
    if (menu === null) return;
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${Math.max(0, window.innerWidth - rect.width - 4)}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${Math.max(0, window.innerHeight - rect.height - 4)}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{ left: x, top: y }}
      className="fixed z-50 min-w-[190px] rounded-[2px] border border-weave-divider-heavy bg-weave-header py-1 shadow-lg shadow-black/40"
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
