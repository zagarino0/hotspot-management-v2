import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Download,
  RefreshCw,
  ShoppingCart,
  Users,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  getDashboardOverview,
  type DashboardOverview,
  type TrendValue,
} from "../../services/statisticsService";

type Period = 7 | 30 | 90;

const periods: Record<Period, string> = {
  7: "7 derniers jours",
  30: "30 derniers jours",
  90: "90 derniers jours",
};

const paymentLabels: Record<string, string> = {
  CASH: "Espèces",
  MVOLA: "MVola",
  ORANGE_MONEY: "Orange Money",
  AIRTEL_MONEY: "Airtel Money",
  BANK: "Virement bancaire",
  OTHER: "Autre",
};

function money(amount: number, currency = "MGA") {
  return new Intl.NumberFormat("fr-MG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function Trend({ trend }: { trend: TrendValue }) {
  if (trend.changePercent === null) {
    return <span className="text-xs text-slate-500">Nouvelle activité</span>;
  }

  const isPositive = trend.changePercent >= 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(trend.changePercent).toLocaleString("fr-MG", { maximumFractionDigits: 1 })}% vs période précédente
    </span>
  );
}

function Kpi({ label, value, trend, icon: Icon }: { label: string; value: string; trend: TrendValue; icon: typeof Activity }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p></div>
        <span className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600"><Icon className="h-5 w-5" /></span>
      </div>
      <div className="mt-4"><Trend trend={trend} /></div>
    </article>
  );
}

export default function StatisticsLive() {
  const [period, setPeriod] = useState<Period>(30);
  const [retry, setRetry] = useState(0);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getDashboardOverview(period);
        if (active) setOverview(result);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Impossible de charger les statistiques.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [period, retry]);

  function exportRecentSales() {
    if (!overview) return;
    const quote = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = overview.recentSales.map((sale) => [
      quote(sale.planName),
      quote(sale.method ? (paymentLabels[sale.method] ?? sale.method) : ""),
      quote(new Date(sale.soldAt).toLocaleString("fr-MG")),
      quote(sale.amount),
      quote(sale.currency),
    ].join(","));
    const url = URL.createObjectURL(new Blob([["Forfait,Paiement,Date,Montant,Devise", ...rows].join("\n")], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ventes-recentes.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !overview) return <Loading />;
  if (error && !overview) return <LoadFailure message={error} onRetry={() => setRetry((value) => value + 1)} />;
  if (!overview) return null;

  const totalSessions = overview.sessionsSeries.reduce((total, point) => total + point.value, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-medium text-indigo-600">Analyse & performance</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Statistiques</h1><p className="mt-1 text-sm text-slate-500">Calculées en temps réel depuis les ventes, sessions et clients PostgreSQL.</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="statistics-period">Période</label>
          <select id="statistics-period" value={period} onChange={(event) => setPeriod(Number(event.target.value) as Period)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none">
            {([7, 30, 90] as Period[]).map((value) => <option key={value} value={value}>{periods[value]}</option>)}
          </select>
          <button type="button" onClick={exportRecentSales} disabled={overview.recentSales.length === 0} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" />Exporter</button>
          <button type="button" onClick={() => setRetry((value) => value + 1)} disabled={loading} aria-label="Actualiser" className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </header>

      {error ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Actualisation impossible : {error}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Chiffre d'affaires encaissé" value={money(overview.trends.revenue.current)} trend={overview.trends.revenue} icon={BarChart3} />
        <Kpi label="Ventes encaissées" value={overview.trends.sales.current.toLocaleString("fr-MG")} trend={overview.trends.sales} icon={ShoppingCart} />
        <Kpi label="Sessions démarrées" value={overview.trends.sessions.current.toLocaleString("fr-MG")} trend={overview.trends.sessions} icon={Activity} />
        <Kpi label="Nouveaux clients" value={overview.trends.clients.current.toLocaleString("fr-MG")} trend={overview.trends.clients} icon={Users} />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-slate-900">Sessions quotidiennes</h2><p className="mt-1 text-sm text-slate-500">{totalSessions.toLocaleString("fr-MG")} sessions démarrées durant les {periods[period].toLowerCase()}.</p></div><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">Données réelles</span></div>
          <div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={overview.sessionsSeries} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}><defs><linearGradient id="statisticsSessions" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} /><stop offset="95%" stopColor="#4f46e5" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} minTickGap={24} /><Tooltip formatter={(value) => [Number(value).toLocaleString("fr-MG"), "Sessions"]} /><Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} fill="url(#statisticsSessions)" /></AreaChart></ResponsiveContainer></div>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">Infrastructure</h2><p className="mt-1 text-sm text-slate-500">État actuellement enregistré.</p><dl className="mt-5 space-y-4"><Metric label="Routeurs en ligne" value={`${overview.counts.routersOnline} / ${overview.counts.routers}`} /><Metric label="Points d'accès en ligne" value={`${overview.counts.accessPointsOnline} / ${overview.counts.accessPoints}`} /><Metric label="Sites configurés" value={overview.counts.sites.toLocaleString("fr-MG")} /><Metric label="Base PostgreSQL" value={overview.dbHealthy ? "Disponible" : "Indisponible"} online={overview.dbHealthy} /></dl></article>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Dernières ventes</h2><p className="mt-1 text-sm text-slate-500">Paiements confirmés les plus récents.</p></div>{overview.dbHealthy ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <CircleAlert className="h-5 w-5 text-rose-600" />}</div>
        {overview.recentSales.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">Aucun paiement confirmé n'est disponible.</p> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100 text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Forfait</th><th className="px-5 py-3">Paiement</th><th className="px-5 py-3">Date</th><th className="px-5 py-3 text-right">Montant</th></tr></thead><tbody className="divide-y divide-slate-100 text-slate-700">{overview.recentSales.map((sale) => <tr key={sale.id}><td className="px-5 py-3 font-medium text-slate-900">{sale.planName}</td><td className="px-5 py-3">{sale.method ? (paymentLabels[sale.method] ?? sale.method) : "Non renseigné"}</td><td className="whitespace-nowrap px-5 py-3">{new Date(sale.soldAt).toLocaleString("fr-MG")}</td><td className="whitespace-nowrap px-5 py-3 text-right font-semibold">{money(sale.amount, sale.currency)}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}

function Metric({ label, value, online }: { label: string; value: string; online?: boolean }) {
  return <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"><dt className="text-sm text-slate-500">{label}</dt><dd className={`text-sm font-semibold ${online ? "text-emerald-600" : "text-slate-800"}`}>{value}</dd></div>;
}

function Loading() {
  return <div className="flex min-h-80 items-center justify-center text-slate-600"><div className="text-center"><RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-indigo-600" /><p>Chargement des statistiques réelles…</p></div></div>;
}

function LoadFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><h1 className="font-semibold">Les statistiques ne sont pas disponibles</h1><p className="mt-1 text-sm">{message}</p><button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-800">Réessayer</button></div></div></div>;
}
