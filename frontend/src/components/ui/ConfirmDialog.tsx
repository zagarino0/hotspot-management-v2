import { AlertTriangle, Loader2, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dialogue de confirmation générique, utilisé avant toute
 * suppression ou action destructrice à travers l'app.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  danger = true,
  loading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={[
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                danger
                  ? "bg-red-50 text-red-500"
                  : "bg-slate-100 text-slate-600",
              ].join(" ")}
            >
              <AlertTriangle size={18} strokeWidth={1.8} />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {title}
              </h3>

              <p className="mt-1 text-sm leading-5 text-slate-500">
                {message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Fermer"
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={[
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60",
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-slate-950 hover:bg-slate-800",
            ].join(" ")}
          >
            {loading && (
              <Loader2 size={13} className="animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
