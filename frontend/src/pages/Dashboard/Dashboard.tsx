import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  CircleAlert,
  MapPin,
  Router,
  Server,
  ShoppingCart,
  Ticket,
  Users,
  Wifi,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import {
  getDashboardOverview,
  type DashboardOverview,
} from "../../services/statisticsService";
import { useWebSocket } from "../../hooks/useWebSocket";

/* ================================================================
   HELPERS
================================================================ */

function formatCurrency(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR")} Ar`;
}

function formatTrend(changePercent: number | null): {
  text: string;
  type: "positive" | "negative" | "neutral";
} {
  if (changePercent === null) {
    return { text: "Nouveau", type: "neutral" };
  }

  if (Math.abs(changePercent) < 0.5) {
    return { text: "Stable", type: "neutral" };
  }

  const sign = changePercent > 0 ? "+" : "";

  return {
    text: `${sign}${changePercent.toFixed(1).replace(".", ",")} %`,
    type: changePercent > 0 ? "positive" : "negative",
  };
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;

  return new Date(iso).toLocaleDateString("fr-FR");
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  MVOLA: "Mvola",
  ORANGE_MONEY: "Orange Money",
  AIRTEL_MONEY: "Airtel Money",
  BANK: "Banque",
  OTHER: "Autre",
};

const DEFAULT_TREND = { text: "Nouveau", type: "neutral" as const };

/* ================================================================
   STAT CARD
================================================================ */

interface StatCardProps {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  trend?: string;
  trendType?: "positive" | "negative" | "neutral";
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  trend,
  trendType = "positive",
}: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_25px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-500">
            {label}
          </p>
          <p className="mt-2 truncate text-[26px] font-bold tracking-[-0.03em] text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-all duration-200 group-hover:border-slate-300 group-hover:bg-slate-100">
          <Icon size={18} strokeWidth={1.8} />
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-1.5 text-xs">
          {trendType === "positive" && (
            <ArrowUpRight
              size={14}
              strokeWidth={2}
              className="text-emerald-600"
            />
          )}
          {trendType === "negative" && (
            <ArrowDownRight
              size={14}
              strokeWidth={2}
              className="text-red-500"
            />
          )}
          {trendType === "neutral" && (
            <Activity
              size={14}
              strokeWidth={2}
              className="text-slate-500"
            />
          )}

          <span
            className={
              trendType === "positive"
                ? "text-emerald-600"
                : trendType === "negative"
                  ? "text-red-500"
                  : "text-slate-500"
            }
          >
            {trend}
          </span>

          <span className="text-slate-400">
            vs période précédente
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute -bottom-10 -right-10 h-24 w-24 rounded-full bg-slate-100/60 blur-2xl transition-opacity duration-200 group-hover:opacity-80" />
    </div>
  );
}

/* ================================================================
   PAGE
================================================================ */

export default function Dashboard() {
  const [data, setData] = useState<DashboardOverview | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(7);

  // WebSocket pour les statistiques en temps réel
  const { connected, stats: liveStats } = useWebSocket();

  // Mettre à jour les données quand les stats live arrivent
  useEffect(() => {
    if (!liveStats) return;

    setData((prevData) => {
      if (!prevData) return prevData;

      return {
        ...prevData,
        counts: {
          ...prevData.counts,
          routersOnline: liveStats.routersOnline,
          routers: liveStats.totalRouters,
        },
      };
    });
  }, [liveStats]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const overview = await getDashboardOverview(days);

        if (mounted) {
          setData(overview);
        }
      } catch (err) {
        console.error(
          "Erreur lors du chargement du dashboard :",
          err
        );

        if (mounted) {
          setError(
            "Impossible de charger les données du tableau de bord."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [days]);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Chargement du tableau de bord...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { counts, trends, recentSales, networkStatus, sessionsSeries } =
    data;

  const clientsTrend = trends.clients
    ? formatTrend(trends.clients.changePercent)
    : DEFAULT_TREND;
  const revenueTrend = trends.revenue
    ? formatTrend(trends.revenue.changePercent)
    : DEFAULT_TREND;
  const vouchersTrend = trends.vouchers
    ? formatTrend(trends.vouchers.changePercent)
    : DEFAULT_TREND;

  const allOnline =
    counts.routers > 0 &&
    counts.routersOnline === counts.routers &&
    counts.accessPointsOnline === counts.accessPoints;

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Vue générale
            </span>
          </div>

          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-slate-950">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Vue globale de votre infrastructure hotspot.
          </p>
        </div>

        <div
          className={[
            "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5",
            allOnline
              ? "border-emerald-100 bg-emerald-50"
              : "border-amber-100 bg-amber-50",
          ].join(" ")}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={[
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                allOnline ? "bg-emerald-400" : "bg-amber-400",
              ].join(" ")}
            />
            <span
              className={[
                "relative inline-flex h-2 w-2 rounded-full",
                allOnline ? "bg-emerald-500" : "bg-amber-500",
              ].join(" ")}
            />
          </span>

          <span
            className={[
              "text-xs font-semibold",
              allOnline ? "text-emerald-700" : "text-amber-700",
            ].join(" ")}
          >
            {allOnline
              ? "Infrastructure opérationnelle"
              : `${counts.routers - counts.routersOnline + (counts.accessPoints - counts.accessPointsOnline)} équipement(s) hors ligne`}
          </span>

          {connected && (
            <span className="text-xs font-semibold text-blue-600 ml-2">
              • Temps réel
            </span>
          )}
        </div>
      </header>

      {/* PRIMARY KPI */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Clients"
            value={String(counts.clients)}
            description="Clients enregistrés"
            icon={Users}
            trend={clientsTrend.text}
            trendType={clientsTrend.type}
          />

          <StatCard
            label="Sessions actives"
            value={
              liveStats
                ? String(liveStats.activeUsers)
                : String(counts.activeSessions)
            }
            description="Connexions en temps réel"
            icon={Wifi}
            trend={connected ? "En direct" : "Sync"}
            trendType={connected ? "positive" : "neutral"}
          />

          <StatCard
            label="Routeurs"
            value={`${counts.routersOnline}/${counts.routers}`}
            description="En ligne / total"
            icon={Router}
            trend={
              counts.routersOnline === counts.routers
                ? "Tous en ligne"
                : "Attention"
            }
            trendType={
              counts.routersOnline === counts.routers
                ? "positive"
                : "negative"
            }
          />

          <StatCard
            label="Points d'accès"
            value={`${counts.accessPointsOnline}/${counts.accessPoints}`}
            description="En ligne / total"
            icon={Wifi}
            trend={
              counts.accessPoints === 0
                ? "Aucun configuré"
                : counts.accessPointsOnline ===
                    counts.accessPoints
                  ? "Tous en ligne"
                  : "Attention"
            }
            trendType={
              counts.accessPoints === 0
                ? "neutral"
                : counts.accessPointsOnline ===
                    counts.accessPoints
                  ? "positive"
                  : "negative"
            }
          />
        </div>
      </section>

      {/* SECONDARY KPI */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Sites"
            value={String(counts.sites)}
            description="Sites WiFi configurés"
            icon={MapPin}
          />

          <StatCard
            label="Vouchers"
            value={counts.vouchersAvailable.toLocaleString(
              "fr-FR"
            )}
            description="Vouchers disponibles"
            icon={Ticket}
            trend={vouchersTrend.text}
            trendType={vouchersTrend.type}
          />

          <StatCard
            label="Ventes (30j)"
            value={String(recentSales.length)}
            description="Dernières ventes visibles ci-dessous"
            icon={ShoppingCart}
          />

          <StatCard
            label="Chiffre d'affaires (30j)"
            value={formatCurrency(trends.revenue.current)}
            description="Paiements encaissés"
            icon={Banknote}
            trend={revenueTrend.text}
            trendType={revenueTrend.type}
          />
        </div>
      </section>

      {/* MAIN CONTENT */}
      <section className="grid gap-6 xl:grid-cols-3">
        {/* SESSION ACTIVITY */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Activity size={16} strokeWidth={1.8} />
                </div>
                <h2 className="text-sm font-semibold text-slate-950">
                  Activité des sessions
                </h2>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Nombre de sessions démarrées par jour
              </p>
            </div>

            <select
              aria-label="Période du graphique"
              value={days}
              onChange={(event) =>
                setDays(Number(event.target.value) as 7 | 30 | 90)
              }
              className="w-fit rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 outline-none transition-colors hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value={7}>7 jours</option>
              <option value={30}>30 jours</option>
              <option value={90}>90 jours</option>
            </select>
          </div>

          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sessionsSeries}>
                <defs>
                  <linearGradient
                    id="sessionsGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#0f172a"
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="95%"
                      stopColor="#0f172a"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  interval={days === 7 ? 0 : "preserveStartEnd"}
                />
                <Tooltip
                  formatter={(value) => [
                    typeof value === "number" ? value : 0,
                    "Sessions",
                  ]}
                  labelStyle={{ fontSize: 12 }}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0f172a"
                  strokeWidth={2}
                  fill="url(#sessionsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SYSTEM STATUS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Server size={16} strokeWidth={1.8} />
                </div>
                <h2 className="text-sm font-semibold text-slate-950">
                  État du système
                </h2>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Supervision de l'infrastructure
              </p>
            </div>

            <CheckCircle2
              size={19}
              className={
                data.dbHealthy
                  ? "text-emerald-500"
                  : "text-red-500"
              }
              strokeWidth={1.8}
            />
          </div>

          <div className="mt-6 divide-y divide-slate-100">
            <SystemStatus
              label="Backend API"
              status="Operational"
              online
            />

            <SystemStatus
              label="PostgreSQL"
              status={
                data.dbHealthy ? "Connected" : "Injoignable"
              }
              online={data.dbHealthy}
            />

            <SystemStatus
              label="Routeurs MikroTik"
              status={`${counts.routersOnline}/${counts.routers} en ligne`}
              online={
                counts.routers === 0 ||
                counts.routersOnline === counts.routers
              }
            />

            <SystemStatus
              label="Points d'accès"
              status={`${counts.accessPointsOnline}/${counts.accessPoints} en ligne`}
              online={
                counts.accessPoints === 0 ||
                counts.accessPointsOnline ===
                  counts.accessPoints
              }
            />
          </div>
        </div>
      </section>

      {/* BOTTOM CONTENT */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* RECENT SALES */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <ShoppingCart size={16} strokeWidth={1.8} />
                </div>
                <h2 className="text-sm font-semibold text-slate-950">
                  Ventes récentes
                </h2>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Dernières transactions
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {recentSales.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                Aucune vente enregistrée pour le moment.
              </p>
            ) : (
              recentSales.map((sale) => (
                <SaleRow
                  key={sale.id}
                  planName={sale.planName}
                  method={
                    sale.method
                      ? (METHOD_LABELS[sale.method] ??
                        sale.method)
                      : "—"
                  }
                  amount={formatCurrency(sale.amount)}
                  status={sale.status}
                  time={timeAgo(sale.soldAt)}
                />
              ))
            )}
          </div>
        </div>

        {/* NETWORK */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Router size={16} strokeWidth={1.8} />
              </div>
              <h2 className="text-sm font-semibold text-slate-950">
                Infrastructure réseau
              </h2>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              État des équipements
            </p>
          </div>

          <div className="mt-5 space-y-2">
            {networkStatus.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                Aucun équipement configuré pour le moment.
              </p>
            ) : (
              networkStatus.map((item) => (
                <NetworkRow
                  key={item.id}
                  name={item.name}
                  type={
                    item.type === "ROUTER"
                      ? "Routeur"
                      : "Point d'accès"
                  }
                  status={item.status}
                />
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ================================================================
   SYSTEM STATUS
================================================================ */

function SystemStatus({
  label,
  status,
  online,
}: {
  label: string;
  status: string;
  online: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span
            className={[
              "absolute inline-flex h-full w-full rounded-full opacity-40",
              online ? "bg-emerald-400" : "bg-red-400",
            ].join(" ")}
          />
          <span
            className={[
              "relative inline-flex h-2.5 w-2.5 rounded-full",
              online ? "bg-emerald-500" : "bg-red-500",
            ].join(" ")}
          />
        </span>
        <span className="truncate text-sm font-medium text-slate-600">
          {label}
        </span>
      </div>

      <span
        className={[
          "shrink-0 text-xs font-semibold",
          online ? "text-emerald-600" : "text-red-500",
        ].join(" ")}
      >
        {status}
      </span>
    </div>
  );
}

/* ================================================================
   SALES ROW
================================================================ */

function SaleRow({
  planName,
  method,
  amount,
  status,
  time,
}: {
  planName: string;
  method: string;
  amount: string;
  status: string;
  time: string;
}) {
  return (
    <div className="group flex items-center justify-between rounded-xl border border-slate-100 px-3.5 py-3 transition-all duration-200 hover:border-slate-200 hover:bg-slate-50">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-white">
          <Ticket size={15} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {planName}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {method} · {time}
          </p>
        </div>
      </div>

      <div className="ml-4 text-right">
        <p className="text-sm font-semibold text-slate-800">
          {amount}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-emerald-600">
          {status}
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   NETWORK ROW
================================================================ */

function NetworkRow({
  name,
  type,
  status,
}: {
  name: string;
  type: string;
  status: string;
}) {
  const online = status === "ONLINE";

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-3.5 py-3 transition-all duration-200 hover:border-slate-200 hover:bg-slate-50">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            online
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-500",
          ].join(" ")}
        >
          {online ? (
            <Wifi size={15} strokeWidth={1.8} />
          ) : (
            <CircleAlert size={15} strokeWidth={1.8} />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {name}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {type}
          </p>
        </div>
      </div>

      <span
        className={[
          "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold tracking-wide",
          online
            ? "bg-emerald-50 text-emerald-600"
            : "bg-red-50 text-red-500",
        ].join(" ")}
      >
        {status}
      </span>
    </div>
  );
}
