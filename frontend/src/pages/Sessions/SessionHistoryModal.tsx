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

  // L'état réel du groupe est prioritaire : une connexion ACTIVE

  // représente toujours l'état courant, même si un historique plus

  // ancien est encore présent dans la réponse.

  const latestSession =

    history.find((item) => item.status === "ACTIVE") ??

    orderedHistory[0] ??

    session;

  const totalQuota =

    toNumber(latestSession.voucherDurationSeconds);

  const calendarProfile = isCalendarProfile(latestSession.mikrotikProfile);

  const remainingSeconds = calendarProfile

    ? toNumber(latestSession.voucherRemainingSeconds)

    : latestSession.status === "ACTIVE"

      ? toNumber(latestSession.voucherRemainingSeconds)

      : toNumber(latestSession.voucherRemainingSecondsAtEnd);

  const usedSeconds = calendarProfile

    ? getCumulativeUniqueDurationSeconds(history)

    : toNumber(latestSession.voucherUsedSeconds) ?? 0;

  // Le backend calcule les jours calendaires à partir de la première activation.
  // Le frontend affiche la valeur API sans recalculer la validité.
  const isCalendarValidityTarget = calendarProfile;
  const usedDays = isCalendarValidityTarget
    ? toNumber(latestSession.voucherCalendarDaysUsed)
    : null;

  const displayStatus = getDisplayStatus(latestSession);

  return (

    <div

      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-2 backdrop-blur-[2px] sm:p-4"

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

        className="flex max-h-[94dvh] w-full min-w-0 max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[88vh]"

      >

        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">

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

        <div className="grid min-w-0 gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:grid-cols-3 sm:px-6">

          <SummaryCard

            label="Quota total"

            value={

              totalQuota !== null

                ? formatDuration(totalQuota)

                : "Non disponible"

            }

          />

          <SummaryCard

            label={isCalendarValidityTarget ? "Jours utilisés" : "Total utilisé"}

            value={

              isCalendarValidityTarget && usedDays !== null

                ? `${usedDays} j`

                : formatDuration(usedSeconds)

            }

          />

          <SummaryCard

            label={

              calendarProfile || latestSession.status === "ACTIVE"

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

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">

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

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-6 sm:py-4">

          <div className="flex flex-col gap-1 text-[11px] text-slate-400">
            <span>

              {orderedHistory.length} connexion

              {orderedHistory.length > 1 ? "s" : ""}

              {" · "}

              {session.ipAddress || "IP inconnue"}

            </span>
            <span className="font-semibold text-slate-600">
              Temps de connexion cumulé : {formatDuration(usedSeconds)}
            </span>

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

function isCalendarProfile(profile: string | null): boolean {

  return [

    "profil_24h",

    "profil_mothe_1",

    "profil_mothe_2",

    "profil_week",

    "profil_bonus",
  ].indexOf((profile ?? "").trim().toLowerCase()) !== -1;
}

/**
 * Union des intervalles de connexion : évite de compter deux fois une
 * même période si l'historique contient des sessions qui se chevauchent.
 */

function getCumulativeUniqueDurationSeconds(history: Session[]): number {

  const intervals = history

    .map((item) => {

      const start = new Date(item.startedAt).getTime();

      if (!Number.isFinite(start)) return null;

      const duration = Math.max(0, toNumber(item.durationSeconds) ?? 0);

      const recordedEnd = start + duration * 1000;
      const end =
        item.status === "ACTIVE"
          ? Math.max(recordedEnd, Date.now())
          : recordedEnd;
      return { start, end };
    })
    .filter(
      (item): item is { start: number; end: number } =>
        item !== null && item.end > item.start
    )
    .sort((a, b) => a.start - b.start);

  let totalMs = 0;
  let currentStart: number | null = null;
  let currentEnd: number | null = null;

  for (const interval of intervals) {
    if (currentStart === null || currentEnd === null) {
      currentStart = interval.start;
      currentEnd = interval.end;
    } else if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
    } else {
      totalMs += currentEnd - currentStart;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
  }

  if (currentStart !== null && currentEnd !== null) {
    totalMs += currentEnd - currentStart;
  }

  return Math.floor(totalMs / 1000);

}

function getDisplayStatus(session: Session): SessionStatus {

  const remaining = isCalendarProfile(session.mikrotikProfile)
    ? toNumber(session.voucherRemainingSeconds)
    : session.status === "ACTIVE"
      ? toNumber(session.voucherRemainingSeconds)
      : toNumber(session.voucherRemainingSecondsAtEnd);

  // Pour les forfaits calendaires, zéro restant signifie que le voucher
  // a atteint son échéance, même si la dernière session était interrompue.
  const calendarQuotaSeconds = toNumber(session.voucherDurationSeconds);
  const calendarQuotaDays = calendarQuotaSeconds !== null
    ? Math.ceil(calendarQuotaSeconds / 86400)
    : 0;
  const calendarDaysUsed = toNumber(session.voucherCalendarDaysUsed);

  // Pour les profils à validité calendaire, l'échéance est atteinte dès
  // que le temps restant est nul OU que les jours calendaires utilisés
  // atteignent le quota du forfait. Ne pas conserver « Interrompue ».
  if (
    isCalendarProfile(session.mikrotikProfile) &&
    (
      (remaining !== null && remaining <= 0) ||
      (
        calendarQuotaDays > 0 &&
        calendarDaysUsed !== null &&
        calendarDaysUsed >= calendarQuotaDays
      )
    )
  ) {
    return "COMPLETED";
  }

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
