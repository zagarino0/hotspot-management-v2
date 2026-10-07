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
  RefreshCw,
  Router,
  ShoppingCart,
  Ticket,
  Users,
  Wifi,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  getDashboardOverview,
  type DashboardOverview,
  type TrendValue,
} from "../../services/statisticsService";

type Period = 7 | 30 | 90;

const periodLabels: Record<Period, string> = {
  7: "7 derniers jours",
  30: "30 derniers jours",
  90: "90 derniers jours",
};

const paymentMethodLabels: Record<string, string> = {
  CASH: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  BANK_TRANSFER: "Virement",
  CARD: "Carte",
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-MG", {
    style: "currency",
    currency: currency || "MGA",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("fr-MG");
}

function Trend({ value, label }: { value: TrendValue; label: string }) {
  if (value.changePercent === null) {
    return <span className="text-xs text-slate-500">Nouveau {label.toLowerCase()}</span>;
  }

  const isPositive = value.changePercent >= 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value.changePercent).toLocaleString("fr-MG", { maximumFractionDigits: 1 })}% {label.toLowerCase()}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail?: string;
  trend?: TrendValue;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <span className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 min-h-5">
        {trend ? <Trend value={trend} label={label} /> : <span className="text-xs text-slate-500">{detail}</span>}
      </div>
    </section>
  );
}

function EquipmentState({
  name,
  type,
  status,
}: DashboardOverview["networkStatus"][number]) {
  const isOnline = status === "ONLINE";
  const isDisabled = status === "DISABLED";
  const Icon = type === "ROUTER" ? Router : Wifi;
  const stateLabel = isOnline ? "En ligne" : isDisabled ? "Désactivé" : status === "UNKNOWN" ? "Inconnu" : "Hors ligne";

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`rounded-lg p-2 ${isOnline ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{name}</p>
          <p className="text-xs text-slate-500">{type === "ROUTER" ? "Routeur" : "Point d'accès"}</p>
        </div>
      </div>
      <span className={`whitespace-nowrap text-xs font-medium ${isOnline ? "text-emerald-600" : isDisabled ? "text-slate-500" : "text-rose-600"}`}>
        {stateLabel}
      </span>
    </li>
  );
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>(30);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [dashboard, setDashboard] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const overview = await getDashboardOverview(period);
        if (isCurrent) {
          setDashboard(overview);
        }
      } catch (loadError) {
        if (isCurrent) {
          setError(loadError instanceof Error ? loadError.message : "Impossible de charger le tableau de bord.");
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();
    return () => {
      isCurrent = false;
    };
  }, [period, refreshIndex]);

  if (isLoading && !dashboard) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <div className="text-center text-slate-600">
          <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-indigo-600" />
          <p>Chargement des données réelles du tableau de bord…</p>
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h1 className="font-semibold">Le tableau de bord n'est pas disponible</h1>
            <p className="mt-1 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => setRefreshIndex((value) => value + 1)}
              className="mt-4 rounded-lg bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-800"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const { counts, trends, recentSales, networkStatus, sessionsSeries, dbHealthy } = dashboard;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Vue d'ensemble</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Tableau de bord</h1>
          <p className="mt-1 text-sm text-slate-500">Source de vérité : MikroTik HotSpot en direct.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="dashboard-period">Période</label>
          <select
            id="dashboard-period"
            value={period}
            onChange={(event) => setPeriod(Number(event.target.value) as Period)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none"
          >
            {([7, 30, 90] as Period[]).map((value) => <option key={value} value={value}>{periodLabels[value]}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setRefreshIndex((value) => value + 1)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Les données affichées ne sont peut-être plus à jour : {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Clients MikroTik" value={counts.clients.toLocaleString("fr-MG")} trend={trends.clients} />
        <StatCard icon={Activity} label="Sessions actives" value={counts.activeSessions.toLocaleString("fr-MG")} trend={trends.sessions} />
        <StatCard icon={Router} label="MikroTik en ligne" value={`${counts.routersOnline}/${counts.routers}`} detail="Source de vérité réseau" />
        <StatCard icon={Wifi} label="Points d'accès en ligne" value={`${counts.accessPointsOnline}/${counts.accessPoints}`} detail="Équipements Wi-Fi" />
        <StatCard icon={Banknote} label="Chiffre d'affaires" value={formatCurrency(trends.revenue.current, "MGA")} trend={trends.revenue} />
        <StatCard icon={Ticket} label="Vouchers disponibles" value={counts.vouchersAvailable.toLocaleString("fr-MG")} detail="Données en direct du MikroTik" />
        <StatCard icon={MapPin} label="Sites" value={counts.sites.toLocaleString("fr-MG")} detail="Sites configurés" />
        <StatCard icon={ShoppingCart} label="Ventes encaissées" value={trends.sales.current.toLocaleString("fr-MG")} trend={trends.sales} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">Sessions par jour</h2>
              <p className="mt-1 text-sm text-slate-500">Sessions créées durant les {periodLabels[period].toLowerCase()}.</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{sessionsSeries.reduce((total, point) => total + point.value, 0)} sessions</span>
          </div>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sessionsSeries} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sessionsGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} minTickGap={24} />
                <Tooltip formatter={(value) => [Number(value).toLocaleString("fr-MG"), "Sessions"]} labelStyle={{ color: "#334155" }} />
                <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} fill="url(#sessionsGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">État du système</h2>
              <p className="mt-1 text-sm text-slate-500">Équipements enregistrés</p>
            </div>
            {dbHealthy ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Base de données disponible" /> : <CircleAlert className="h-5 w-5 text-rose-600" aria-label="Base de données indisponible" />}
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {networkStatus.length > 0 ? networkStatus.map((equipment) => <EquipmentState key={`${equipment.type}-${equipment.id}`} {...equipment} />) : (
              <li className="py-8 text-center text-sm text-slate-500">Aucun équipement n'est encore configuré.</li>
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Dernières ventes</h2>
            <p className="mt-1 text-sm text-slate-500">Ventes avec paiement confirmé.</p>
          </div>
          <ShoppingCart className="h-5 w-5 text-slate-400" />
        </div>
        {recentSales.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Aucune vente confirmée pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3">Forfait</th><th className="px-5 py-3">Paiement</th><th className="px-5 py-3">Date</th><th className="px-5 py-3 text-right">Montant</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-5 py-3 font-medium text-slate-900">{sale.planName}</td>
                    <td className="px-5 py-3">{sale.method ? (paymentMethodLabels[sale.method] ?? sale.method) : "Non renseigné"}</td>
                    <td className="whitespace-nowrap px-5 py-3">{formatDate(sale.soldAt)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-semibold">{formatCurrency(sale.amount, sale.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
