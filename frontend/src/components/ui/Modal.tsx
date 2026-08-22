import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  size?: "md" | "lg";
}

const SIZE_CLASSES: Record<"md" | "lg", string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
};

/**
 * Coquille de modal générique utilisée pour tous les formulaires
 * d'édition rapide (Site, Routeur, Point d'accès, Client...).
 */
export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={[
          "w-full rounded-2xl bg-white p-6 shadow-xl",
          SIZE_CLASSES[size],
        ].join(" ")}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {title}
            </h3>

            {description && (
              <p className="mt-1 text-sm text-slate-400">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto pr-1">
          {children}
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-5">
          {footer}
        </div>
      </div>
    </div>
  );
}
