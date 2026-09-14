import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export type FileActionItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick: () => void;
};

type FileActionsMenuProps = {
  items: FileActionItem[];
  align?: "left" | "right";
  variant?: "file" | "folder";
};

type MenuPosition = { top: number; left: number; minWidth: number };

const FILE_MENU_WIDTH = 178;
const FOLDER_MENU_WIDTH = 154;
const VIEWPORT_GAP = 10;

export default function FileActionsMenu({ items, align = "right", variant = "file" }: FileActionsMenuProps) {
  const menuWidth = variant === "folder" ? FOLDER_MENU_WIDTH : FILE_MENU_WIDTH;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const reposition = () => {
    const trigger = rootRef.current?.querySelector<HTMLButtonElement>(".file-actions-trigger");
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menu = menuRef.current;
    const measuredHeight = menu?.getBoundingClientRect().height || Math.min(360, items.length * 42 + 12);

    let left = align === "left" ? rect.left : rect.right - menuWidth;
    left = Math.max(VIEWPORT_GAP, Math.min(left, window.innerWidth - menuWidth - VIEWPORT_GAP));

    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_GAP;
    const openAbove = spaceBelow < measuredHeight && rect.top - VIEWPORT_GAP >= measuredHeight;
    let top = openAbove ? rect.top - measuredHeight - 6 : rect.bottom + 6;
    top = Math.max(VIEWPORT_GAP, Math.min(top, window.innerHeight - measuredHeight - VIEWPORT_GAP));

    setPosition({ top, left, minWidth: menuWidth });
  };

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const frame = window.requestAnimationFrame(reposition);
    return () => window.cancelAnimationFrame(frame);
  }, [open, items.length, align, menuWidth]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onViewportChange = () => reposition();

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, items.length, align, menuWidth]);

  if (!items.length) return null;

  const dropdown = open && position && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={menuRef}
          className={`file-actions-dropdown file-actions-dropdown-portal ${variant === "folder" ? "folder-actions-dropdown" : ""}`}
          role="menu"
          style={{ top: position.top, left: position.left, minWidth: position.minWidth }}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`file-actions-item ${item.danger ? "danger" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onClick();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="file-actions-menu" ref={rootRef}>
      <button
        type="button"
        className={`icon-btn file-actions-trigger ${open ? "active" : ""}`}
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <MoreVertical size={16} />
      </button>
      {dropdown}
    </div>
  );
}
