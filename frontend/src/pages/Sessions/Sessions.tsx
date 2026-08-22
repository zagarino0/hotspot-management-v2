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
      .map((s) => s.durationSeconds)
      .filter((v): v is number => v !== null)
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
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Utilisateur
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Adresse IP
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Adresse MAC
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Routeur
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Durée
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
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-slate-400"
                  >
                    Chargement des sessions...
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
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

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) {
    return "—";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }

  if (minutes > 0) {
    return `${minutes} min`;
  }

  return `${Math.floor(totalSeconds)} s`;
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

          <p className="mt-2 text-[26px] font-bold tracking-[-0.03em] text-slate-950">
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
  onTerminate,
}: {
  session: Session;
  onTerminate: () => void;
}) {
  const statusInfo = STATUS_CONFIG[session.status];

  const displayName =
    session.username || "Utilisateur inconnu";

  const liveDuration =
    session.status === "ACTIVE" && session.startedAt
      ? Math.floor(
          (Date.now() -
            new Date(session.startedAt).getTime()) /
            1000
        )
      : session.durationSeconds;

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Wifi size={16} strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {displayName}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4 font-mono text-xs text-slate-500">
        {session.ipAddress || "—"}
      </td>

      <td className="px-5 py-4 font-mono text-xs text-slate-500">
        {session.macAddress || "—"}
      </td>

      <td className="px-5 py-4 text-sm font-medium text-slate-600">
        {session.routerName || "—"}
      </td>

      <td className="px-5 py-4 text-sm text-slate-600">
        {formatDuration(liveDuration ?? 0)}
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

      <td className="px-5 py-4 text-right">
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
