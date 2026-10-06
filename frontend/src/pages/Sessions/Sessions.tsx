import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock3,
  LogOut,
  RefreshCw,
  Search,
  Wifi,
} from "lucide-react";

import ActionMenu from "../../components/ui/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import SessionHistoryModal from "./SessionHistoryModal";

import {
  fetchSessions,
  syncSessions,
  terminateSession,
  type RouterSyncResult,
  type Session,
  type SessionStatus,
} from "../../services/sessionService";

/* ============================================================
   POLLING
   Le backend synchronise déjà les routeurs en tâche de fond
   (voir server.ts, LIVE_SYNC_INTERVAL_SECONDS). Cette page se
   contente de relire régulièrement la base — léger, aucune
   connexion MikroTik déclenchée par ce polling.
============================================================ */

const POLL_INTERVAL_MS = 15_000;

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | SessionStatus>("all");

  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<
    RouterSyncResult[]
  >([]);

  const [historySession, setHistorySession] =
    useState<Session | null>(null);

  const [terminatingSession, setTerminatingSession] =
    useState<Session | null>(null);
  const [terminating, setTerminating] = useState(false);
  const [terminateError, setTerminateError] = useState<
    string | null
  >(null);

  /* ============================================================
     CHARGEMENT
  ============================================================ */

  const loadSessions = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        setError(null);

        const data = await fetchSessions();

        setSessions(data);
      } catch (err) {
        console.error(
          "Erreur lors du chargement des sessions :",
          err
        );

        setError("Impossible de charger les sessions.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadSessions();

    const interval = setInterval(() => {
      loadSessions(true);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadSessions]);

  /* ============================================================
     DÉCONNEXION MANUELLE
     Se reconnecte réellement au routeur MikroTik concerné pour
     retirer l'utilisateur (voir session.service.ts côté backend).
  ============================================================ */

  async function handleConfirmTerminate() {
    if (!terminatingSession) return;

    setTerminating(true);
    setTerminateError(null);

    try {
      await terminateSession(terminatingSession.id);
      setTerminatingSession(null);
      await loadSessions(true);
    } catch (err: any) {
      setTerminateError(
        err?.response?.data?.message ??
          "Impossible de déconnecter cet utilisateur."
      );
    } finally {
      setTerminating(false);
    }
  }

  /* ============================================================
     SYNC MANUEL (interroge réellement les routeurs MikroTik)
  ============================================================ */

  async function handleSync() {
    try {
      setSyncing(true);
      setError(null);

      const result = await syncSessions();

      setSessions(result.data.sessions);
      setSyncResults(result.data.syncResults);
    } catch (err) {
      console.error(
        "Erreur lors de la synchronisation :",
        err
      );

      setError(
        "La synchronisation a échoué. Vérifiez la connexion aux routeurs."
      );
    } finally {
      setSyncing(false);
    }
  }

  const failedSyncs = syncResults.filter((r) => !r.success);

  /* ============================================================
     RECHERCHE / FILTRE
  ============================================================ */

  const filteredSessions = useMemo(() => {
    let rows = sessions;

    if (statusFilter !== "all") {
      rows = rows.filter(
        (session) => session.status === statusFilter
      );
    }

    const query = search.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((session) => {
      return [
        session.username,
        session.ipAddress,
        session.macAddress,
        session.routerName,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        );
    });
  }, [sessions, statusFilter, search]);

  /* ============================================================
     KPI
  ============================================================ */

  const activeSessions = sessions.filter(
    (s) => s.status === "ACTIVE"
  );

  const completedToday = sessions.filter((s) => {
    if (
      s.status !== "COMPLETED" &&
      s.status !== "TERMINATED"
    ) {
      return false;
    }

    const endedAt = s.endedAt
      ? new Date(s.endedAt)
      : null;

    if (!endedAt) {
      return false;
    }

    const now = new Date();

    return (
      endedAt.getFullYear() === now.getFullYear() &&
      endedAt.getMonth() === now.getMonth() &&
      endedAt.getDate() === now.getDate()
    );
  });

  const averageDurationSeconds = averageOf(
    sessions
      .map((s) => toFiniteNumber(s.durationSeconds))
      .filter(
        (v): v is number =>
          v !== null &&
          v > 0 &&
          v <= 365 * 24 * 60 * 60
      )
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />

            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Supervision réseau
            </span>
          </div>

          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-slate-950">
            Sessions
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Connexions hotspot lues en direct depuis vos
            routeurs MikroTik.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />

            <span className="text-xs font-semibold text-emerald-700">
              {activeSessions.length} session
              {activeSessions.length > 1 ? "s" : ""} active
              {activeSessions.length > 1 ? "s" : ""}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              strokeWidth={2}
              className={syncing ? "animate-spin" : ""}
            />
            {syncing
              ? "Synchronisation..."
              : "Synchroniser maintenant"}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {failedSyncs.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <p className="font-semibold">
            {failedSyncs.length} routeur
            {failedSyncs.length > 1 ? "s" : ""} injoignable
            {failedSyncs.length > 1 ? "s" : ""} lors de la
            dernière synchronisation :
          </p>

          <ul className="mt-1 list-inside list-disc">
            {failedSyncs.map((r) => (
              <li key={r.routerId}>
                {r.routerName} — {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SessionStat
          label="Sessions actives"
          value={String(activeSessions.length)}
          icon={Activity}
          positive
        />

        <SessionStat
          label="Total (historique récent)"
          value={String(sessions.length)}
          icon={Wifi}
        />

        <SessionStat
          label="Durée moyenne"
          value={formatDuration(averageDurationSeconds)}
          icon={Clock3}
        />

        <SessionStat
          label="Terminées aujourd'hui"
          value={String(completedToday.length)}
          icon={Activity}
        />
      </section>

      {/* TABLE */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search
              size={16}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Rechercher une session..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | "all"
                  | SessionStatus
              )
            }
            className="h-10 w-fit rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-slate-400"
          >
            <option value="all">Toutes les sessions</option>
            <option value="ACTIVE">Actives</option>
            <option value="COMPLETED">Terminées</option>
            <option value="TERMINATED">Interrompues</option>
            <option value="ERROR">Erreur</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1550px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Utilisateur
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Forfait
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Connexion / reconnexion
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Durée
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Déconnexion
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Restant après
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Routeur
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Statut
                </th>

                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-sm text-slate-400"
                  >
                    Chargement des sessions...
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center"
                  >
                    <div className="text-sm font-semibold text-slate-600">
                      Aucune session trouvée
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      {search || statusFilter !== "all"
                        ? "Aucun résultat pour ces filtres."
                        : "Cliquez sur \u00ab Synchroniser maintenant \u00bb pour lire les connexions en cours sur vos routeurs."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onOpenHistory={() => setHistorySession(session)}
                    onTerminate={() => {
                      setTerminatingSession(session);
                      setTerminateError(null);
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {historySession && (
        <SessionHistoryModal
          session={historySession}
          onClose={() => setHistorySession(null)}
        />
      )}

      {/* ============================================================
          TERMINATE CONFIRM
      ============================================================ */}

      <ConfirmDialog
        open={terminatingSession !== null}
        title="Déconnecter cet utilisateur ?"
        message={`L'utilisateur "${terminatingSession?.username ?? "inconnu"}" sera immédiatement déconnecté du hotspot (${terminatingSession?.routerName ?? "routeur"}).`}
        confirmLabel="Déconnecter"
        loading={terminating}
        error={terminateError}
        onConfirm={handleConfirmTerminate}
        onCancel={() => setTerminatingSession(null)}
      />
    </div>
  );
}

/* ================================================================
   HELPERS
================================================================ */

function averageOf(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce((sum, v) => sum + v, 0) / values.length
  );
}

function formatDateTime(value: string | Date): string {
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

function toFiniteNumber(value: number | string | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : null;
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "—";
  }

  const roundedSeconds = Math.floor(totalSeconds);
  const days = Math.floor(roundedSeconds / 86400);
  const hours = Math.floor(
    (roundedSeconds % 86400) / 3600
  );
  const minutes = Math.floor(
    (roundedSeconds % 3600) / 60
  );
  const seconds = roundedSeconds % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} j`);
  }

  if (hours > 0) {
    parts.push(`${hours} h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} s`);
  }

  return parts.join(" ");
}

const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; className: string; dot: string }
> = {
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-600",
    dot: "bg-emerald-500",
  },
  COMPLETED: {
    label: "Terminée",
    className: "bg-slate-100 text-slate-500",
    dot: "bg-slate-400",
  },
  TERMINATED: {
    label: "Interrompue",
    className: "bg-amber-50 text-amber-600",
    dot: "bg-amber-500",
  },
  ERROR: {
    label: "Erreur",
    className: "bg-red-50 text-red-500",
    dot: "bg-red-500",
  },
};

/* ================================================================
   STAT
================================================================ */

interface SessionStatProps {
  label: string;
  value: string;
  icon: typeof Activity;
  positive?: boolean;
}

function SessionStat({
  label,
  value,
  icon: Icon,
  positive,
}: SessionStatProps) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_25px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-slate-500">
            {label}
          </p>

          <p
            className={[
              "mt-2 font-bold tracking-[-0.03em] text-slate-950",
              label === "Durée moyenne"
                ? "whitespace-nowrap text-[22px]"
                : "text-[26px]",
            ].join(" ")}
          >
            {value}
          </p>
        </div>

        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-xl",
            positive
              ? "bg-emerald-50 text-emerald-600"
              : "bg-slate-50 text-slate-600",
          ].join(" ")}
        >
          <Icon size={18} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   SESSION ROW
================================================================ */

function SessionRow({
  session,
  onOpenHistory,
  onTerminate,
}: {
  session: Session;
  onOpenHistory: () => void;
  onTerminate: () => void;
}) {
  const endedRemainingSeconds =
    toFiniteNumber(
      session.voucherRemainingSecondsAtEnd
    );

  const effectiveStatus: SessionStatus =
    session.status !== "ACTIVE" &&
    endedRemainingSeconds !== null &&
    endedRemainingSeconds > 0
      ? "TERMINATED"
      : session.status;

  const statusInfo = STATUS_CONFIG[effectiveStatus];

  const displayName =
    session.username || "Utilisateur inconnu";

  const connectionLabel =
    session.connectionSequence > 1
      ? "Reconnexion"
      : "Première connexion";

  const displayedRemainingAfterEnd =
    session.status === "ACTIVE"
      ? null
      : endedRemainingSeconds !== null
        ? endedRemainingSeconds
        : null;

  const now = Date.now();

  const liveDuration =
    session.status === "ACTIVE" && session.startedAt
      ? Math.max(
          0,
          Math.floor(
            (now - new Date(session.startedAt).getTime()) /
              1000
          )
        )
      : toFiniteNumber(session.durationSeconds);

  const secondsSinceSync =
    session.status === "ACTIVE" && session.updatedAt
      ? Math.max(
          0,
          Math.floor(
            (now - new Date(session.updatedAt).getTime()) /
              1000
          )
        )
      : 0;

  const liveSessionTimeLeft =
    session.status === "ACTIVE" &&
    session.sessionTimeLeftSeconds !== null
      ? Math.max(
          0,
          session.sessionTimeLeftSeconds -
            secondsSinceSync
        )
      : null;

  const liveVoucherRemaining =
    session.status === "ACTIVE" &&
    session.voucherRemainingSeconds !== null
      ? Math.max(
          0,
          session.voucherRemainingSeconds -
            secondsSinceSync
        )
      : null;

  const remainingSeconds =
    liveVoucherRemaining !== null &&
    liveSessionTimeLeft !== null
      ? Math.min(
          liveVoucherRemaining,
          liveSessionTimeLeft
        )
      : liveVoucherRemaining ??
        liveSessionTimeLeft;

  const plannedEndSeconds =
    session.status === "ACTIVE"
      ? remainingSeconds
      : null;

  const loginLabel =
    session.loginMethod
      ? session.loginMethod.replace(/-/g, " ")
      : null;

  return (
    <tr
      className="group cursor-pointer transition-colors hover:bg-slate-50/70"
      onClick={onOpenHistory}
    >
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Wifi size={16} strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {displayName}
            </p>

            <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
              {session.ipAddress || "IP inconnue"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="text-sm font-semibold text-slate-700">
          {session.mikrotikProfile || "—"}
        </div>

        {session.voucherCode && (
          <div className="mt-0.5 font-mono text-[10px] text-slate-400">
            {session.voucherCode}
          </div>
        )}
      </td>

      <td className="px-5 py-4">
        <div className="text-sm font-semibold text-slate-700">
          {connectionLabel}
        </div>

        <div className="mt-0.5 text-xs text-slate-500">
          {formatDateTime(session.startedAt)}
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="text-sm font-semibold text-slate-700">
          {formatDuration(liveDuration ?? 0)}
        </div>

        {toFiniteNumber(session.voucherUsedSeconds) !== null && (
          <div className="mt-0.5 text-[10px] text-slate-400">
            total utilisé :{" "}
            {formatDuration(
              toFiniteNumber(session.voucherUsedSeconds) ?? 0
            )}
          </div>
        )}

        {session.status === "ACTIVE" && (
          <div className="mt-0.5 text-[10px] text-emerald-600">
            en cours
          </div>
        )}
      </td>

      <td className="px-5 py-4">
        {session.endedAt ? (
          <>
            <div className="text-xs font-semibold text-slate-600">
              {formatDateTime(session.endedAt)}
            </div>

            <div className="mt-0.5 text-[10px] text-slate-400">
              {session.terminationReason
                ? session.terminationReason
                : "Déconnexion détectée"}
            </div>
          </>
        ) : (
          <div className="text-xs text-emerald-600">
            Connexion active
          </div>
        )}
      </td>

      <td className="px-5 py-4">
        {session.status === "ACTIVE" ? (
          <>
            <div className="text-sm font-semibold text-emerald-600">
              {remainingSeconds !== null
                ? formatDuration(remainingSeconds)
                : "—"}
            </div>

            <div className="mt-0.5 text-[10px] text-slate-400">
              restant maintenant
            </div>
          </>
        ) : displayedRemainingAfterEnd !== null ? (
          <>
            <div className="text-sm font-semibold text-slate-700">
              {formatDuration(displayedRemainingAfterEnd)}
            </div>

            <div className="mt-0.5 text-[10px] text-slate-400">
              restant à la déconnexion
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-400">
            Non disponible
          </div>
        )}
      </td>

      <td className="px-5 py-4">
        <div className="text-sm font-medium text-slate-600">
          {session.routerName || "—"}
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
          {session.macAddress || "MAC inconnue"}

          {loginLabel && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 uppercase">
              {loginLabel}
            </span>
          )}

          {session.cookiePresent && (
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-600">
              cookie
            </span>
          )}
        </div>
      </td>

      <td className="px-5 py-4">
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
            "text-[10px] font-bold tracking-wide",
            statusInfo.className,
          ].join(" ")}
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              statusInfo.dot,
            ].join(" ")}
          />

          {statusInfo.label}
        </span>
      </td>

      <td
        className="px-5 py-4 text-right"
        onClick={(event) => event.stopPropagation()}
      >
        <ActionMenu
          ariaLabel={`Actions pour ${displayName}`}
          items={[
            {
              label: "Déconnecter",
              icon: LogOut,
              onClick: onTerminate,
              disabled: session.status !== "ACTIVE",
              danger: true,
            },
          ]}
        />
      </td>
    </tr>
  );
}
