import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Clock3,
  History,
  LogIn,
  LogOut,
  X,
} from "lucide-react";

import {
  fetchSessionHistory,
  type Session,
  type SessionStatus,
} from "../../services/sessionService";

interface SessionHistoryModalProps {
  session: Session;
  onClose: () => void;
}

export default function SessionHistoryModal({
  session,
  onClose,
}: SessionHistoryModalProps) {
  const [history, setHistory] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchSessionHistory(
          session.username ?? "",
          session.siteId,
          session.routerId
        );

        if (!cancelled) {
          setHistory(data);
        }
      } catch (err) {
        console.error(
          "Erreur lors du chargement de l'historique :",
          err
        );

        if (!cancelled) {
          setError(
            "Impossible de charger l'historique de cette session."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [session.username, session.siteId, session.routerId]);

  const orderedHistory = useMemo(
    () =>
      [...history].sort(
        (a, b) =>
          new Date(b.startedAt).getTime() -
          new Date(a.startedAt).getTime()
      ),
    [history]
  );

  const latestSession =
    orderedHistory[0] ?? session;

  const totalQuota =
    toNumber(latestSession.voucherDurationSeconds);

  const usedSeconds =
    toNumber(latestSession.voucherUsedSeconds) ?? 0;

  const remainingSeconds =
    latestSession.status === "ACTIVE"
      ? toNumber(latestSession.voucherRemainingSeconds)
      : toNumber(
          latestSession.voucherRemainingSecondsAtEnd
        );

  const displayStatus = getDisplayStatus(latestSession);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-history-title"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              <History size={14} />
              Historique des connexions
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2
                id="session-history-title"
                className="text-xl font-bold tracking-[-0.03em] text-slate-950"
              >
                {session.username || "Utilisateur inconnu"}
              </h2>

              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(displayStatus)}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot(displayStatus)}`} />
                {statusLabel(displayStatus)}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {latestSession.mikrotikProfile || "Forfait inconnu"}
              {" · "}
              {latestSession.routerName || "Routeur inconnu"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'historique"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4 sm:grid-cols-3">
          <SummaryCard
            label="Quota total"
            value={
              totalQuota !== null
                ? formatDuration(totalQuota)
                : "Non disponible"
            }
          />

          <SummaryCard
            label="Total utilisé"
            value={formatDuration(usedSeconds)}
          />

          <SummaryCard
            label={
              latestSession.status === "ACTIVE"
                ? "Restant maintenant"
                : "Restant à la déconnexion"
            }
            value={
              remainingSeconds !== null
                ? formatDuration(remainingSeconds)
                : "Non disponible"
            }
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Chargement de l'historique...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : orderedHistory.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Aucun historique disponible.
            </div>
          ) : (
            <div className="relative">
              <div className="absolute bottom-3 left-[11px] top-3 w-px bg-slate-200" />

              <div className="space-y-4">
                {orderedHistory.map((item, index) => (
                  <HistoryItem
                    key={item.id}
                    session={item}
                    sequence={orderedHistory.length - index}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <div className="text-[11px] text-slate-400">
            {orderedHistory.length} connexion
            {orderedHistory.length > 1 ? "s" : ""}
            {" · "}
            {session.ipAddress || "IP inconnue"}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
}

function HistoryItem({
  session,
  sequence,
}: {
  session: Session;
  sequence: number;
}) {
  const status = getDisplayStatus(session);
  const remaining =
    session.status === "ACTIVE"
      ? toNumber(session.voucherRemainingSeconds)
      : toNumber(session.voucherRemainingSecondsAtEnd);

  return (
    <div className="relative flex gap-4 pl-0">
      <div className={`relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white ${statusIconClass(status)}`}>
        {session.status === "ACTIVE" ? (
          <LogIn size={12} />
        ) : (
          <LogOut size={12} />
        )}
      </div>

      <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-slate-800">
                {sequence === 1
                  ? "Première connexion"
                  : "Reconnexion"}
              </span>

              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(status)}`}>
                {statusLabel(status)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span>{formatDateTime(session.startedAt)}</span>

              <span className="text-slate-300">→</span>

              <span>
                {session.endedAt
                  ? formatDateTime(session.endedAt)
                  : "Connexion active"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Clock3 size={13} />
            {formatDuration(
              toNumber(session.durationSeconds) ?? 0
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
          <Detail label="Déconnexion">
            {session.terminationReason || (
              session.status === "ACTIVE"
                ? "Connexion active"
                : "Déconnexion détectée"
            )}
          </Detail>

          <Detail label="Restant">
            {remaining !== null
              ? formatDuration(remaining)
              : "Non disponible"}
          </Detail>

          <Detail label="Connexion">
            {session.loginMethod
              ? session.loginMethod.replace(/-/g, " ")
              : "—"}
          </Detail>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-slate-800">
        {value}
      </div>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-xs font-medium capitalize text-slate-600">
        {children}
      </div>
    </div>
  );
}

function getDisplayStatus(session: Session): SessionStatus {
  const remaining =
    session.status === "ACTIVE"
      ? toNumber(session.voucherRemainingSeconds)
      : toNumber(session.voucherRemainingSecondsAtEnd);

  if (
    session.status !== "ACTIVE" &&
    remaining !== null &&
    remaining > 0
  ) {
    return "TERMINATED";
  }

  return session.status;
}

function statusLabel(status: SessionStatus): string {
  return {
    ACTIVE: "Active",
    COMPLETED: "Terminée",
    TERMINATED: "Interrompue",
    ERROR: "Erreur",
  }[status];
}

function statusClass(status: SessionStatus): string {
  return {
    ACTIVE: "bg-emerald-50 text-emerald-600",
    COMPLETED: "bg-slate-100 text-slate-500",
    TERMINATED: "bg-amber-50 text-amber-600",
    ERROR: "bg-red-50 text-red-500",
  }[status];
}

function statusDot(status: SessionStatus): string {
  return {
    ACTIVE: "bg-emerald-500",
    COMPLETED: "bg-slate-400",
    TERMINATED: "bg-amber-500",
    ERROR: "bg-red-500",
  }[status];
}

function statusIconClass(status: SessionStatus): string {
  return {
    ACTIVE: "text-emerald-600",
    COMPLETED: "text-slate-500",
    TERMINATED: "text-amber-600",
    ERROR: "text-red-500",
  }[status];
}

function toNumber(value: number | string | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "0 s";
  }

  const seconds = Math.floor(totalSeconds);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];

  if (days > 0) parts.push(`${days} j`);
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0) parts.push(`${minutes} min`);
  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds} s`);
  }

  return parts.join(" ");
}
