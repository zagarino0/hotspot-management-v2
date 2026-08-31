import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  icon?: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
  }>;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  ariaLabel: string;
}

/**
 * Menu d'actions contextuel ("...") réutilisé sur toutes les
 * lignes de tableau de l'app (Routeurs, Sites, Points d'accès,
 * Clients, Vouchers...). Avant, ce bouton n'ouvrait rien nulle
 * part — décoratif partout.
 */
export default function ActionMenu({
  items,
  ariaLabel,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={[
                "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                item.danger
                  ? "text-red-600 hover:bg-red-50"
                  : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {item.icon && (
                <item.icon size={15} strokeWidth={1.8} />
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
