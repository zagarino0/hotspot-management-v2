import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  CircleAlert,
  Database,
  Network,
  Plus,
  RefreshCw,
  Router as RouterIcon,
  Search,
  Wifi,
  XCircle,
} from "lucide-react";
import { getAccessPoints, type AccessPoint } from "../../services/accessPointService";
import { getRouters, type Router } from "../../services/routerService";
import { getSites } from "../../services/siteService";
import { getDashboardOverview } from "../../services/statisticsService";

type EquipmentStatus = "ONLINE" | "OFFLINE" | "UNKNOWN" | "DISABLED";

interface Equipment {
  id: string;
  name: string;
  type: "ROUTER" | "ACCESS_POINT";
  address: string | null;
  site: string;
  status: EquipmentStatus;
  uptime: number | null;
  lastUpdate: string | null;
  lastError: string | null;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || seconds < 0) return "—";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days} j ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function statusText(status: EquipmentStatus) {
  return status === "ONLINE" ? "En ligne" : status === "OFFLINE" ? "Hors ligne" : status === "DISABLED" ? "Désactivé" : "Inconnu";
}

function statusClass(status: EquipmentStatus) {
  return status === "ONLINE" ? "bg-emerald-50 text-emerald-700" : status === "OFFLINE" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600";
}

export default function InfrastructureLive() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [databaseAvailable, setDatabaseAvailable] = useState(false);
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [routers, accessPoints, sites, dashboard] = await Promise.all([
          getRouters(),
          getAccessPoints(),
          getSites(),
          getDashboardOverview(7),
        ]);
        if (!active) return;
        const siteNames = new Map(sites.map((site) => [site.id, site.name]));
        const routerEquipment = routers.map((router: Router): Equipment => ({
          id: router.id,
          name: router.name,
          type: "ROUTER",
          address: router.managementIp,
          site: siteNames.get(router.siteId) ?? "Site inconnu",
          status: router.status,
          uptime: router.uptimeSeconds,
          lastUpdate: router.lastCheckAt ?? router.lastSeenAt,
          lastError: router.lastError,
        }));
        const accessPointEquipment = accessPoints.map((accessPoint: AccessPoint): Equipment => ({
          id: accessPoint.id,
          name: accessPoint.name,
          type: "ACCESS_POINT",
          address: accessPoint.managementIp,
          site: accessPoint.siteName || siteNames.get(accessPoint.siteId) || "Site inconnu",
          status: accessPoint.status,
          uptime: null,
          lastUpdate: accessPoint.updatedAt,
          lastError: null,
        }));
        setEquipment([...routerEquipment, ...accessPointEquipment]);
        setDatabaseAvailable(dashboard.dbHealthy);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Impossible de charger l'infrastructure.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  const filteredEquipment = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    if (!normalized) return equipment;
    return equipment.filter((item) => [item.name, item.site, item.address, item.type].some((value) => value?.toLocaleLowerCase("fr").includes(normalized)));
  }, [equipment, query]);

  const routers = equipment.filter((item) => item.type === "ROUTER");
  const accessPoints = equipment.filter((item) => item.type === "ACCESS_POINT");
  const online = equipment.filter((item) => item.status === "ONLINE").length;
  const offline = equipment.filter((item) => item.status === "OFFLINE").length;

  if (loading && equipment.length === 0) return <Loading />;
  if (error && equipment.length === 0) return <LoadFailure message={error} onRetry={() => setRetry((value) => value + 1)} />;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-medium text-indigo-600">Administration</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Infrastructure</h1><p className="mt-1 text-sm text-slate-500">Équipements chargés depuis les routeurs, points d'accès et sites enregistrés.</p></div>
        <div className="flex flex-wrap gap-2"><Link to="/routers/new" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"><Plus className="h-4 w-4" />Routeur</Link><Link to="/access-points/new" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" />Point d'accès</Link><button type="button" onClick={() => setRetry((value) => value + 1)} disabled={loading} aria-label="Actualiser l'infrastructure" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
      </header>

      {error ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Actualisation impossible : {error}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary icon={Network} label="Équipements" value={equipment.length} />
        <Summary icon={CheckCircle2} label="En ligne" value={online} positive />
        <Summary icon={XCircle} label="Hors ligne" value={offline} negative />
        <Summary icon={Database} label="PostgreSQL" value={databaseAvailable ? "Disponible" : "Indisponible"} positive={databaseAvailable} negative={!databaseAvailable} />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-slate-900">Équipements réseau</h2><p className="mt-1 text-sm text-slate-500">{routers.length} routeur(s) et {accessPoints.length} point(s) d'accès enregistrés.</p></div>
          <label className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><span className="sr-only">Rechercher un équipement</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher…" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-indigo-500" /></label>
        </div>
        {filteredEquipment.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">{equipment.length === 0 ? "Aucun équipement n'est configuré." : "Aucun équipement ne correspond à la recherche."}</p> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100 text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Équipement</th><th className="px-5 py-3">Adresse</th><th className="px-5 py-3">Site</th><th className="px-5 py-3">Dernière mise à jour</th><th className="px-5 py-3">Uptime</th><th className="px-5 py-3">Statut</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredEquipment.map((item) => <EquipmentRow key={`${item.type}-${item.id}`} item={item} />)}</tbody></table></div>}
      </section>
    </div>
  );
}

function Summary({ icon: Icon, label, value, positive, negative }: { icon: typeof Network; label: string; value: string | number; positive?: boolean; negative?: boolean }) {
  const color = positive ? "bg-emerald-50 text-emerald-600" : negative ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600";
  return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div><span className={`rounded-lg p-2.5 ${color}`}><Icon className="h-5 w-5" /></span></div></article>;
}

function EquipmentRow({ item }: { item: Equipment }) {
  const Icon = item.type === "ROUTER" ? RouterIcon : Wifi;
  return <tr className="hover:bg-slate-50"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="rounded-lg bg-slate-100 p-2 text-slate-600"><Icon className="h-4 w-4" /></span><div><p className="font-medium text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.type === "ROUTER" ? "Routeur" : "Point d'accès"}</p></div></div></td><td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-600">{item.address ?? "—"}</td><td className="px-5 py-4 text-slate-700">{item.site}</td><td className="whitespace-nowrap px-5 py-4 text-slate-600">{item.lastUpdate ? new Date(item.lastUpdate).toLocaleString("fr-MG") : "—"}{item.lastError ? <p className="mt-1 max-w-56 truncate text-xs text-rose-600" title={item.lastError}>{item.lastError}</p> : null}</td><td className="whitespace-nowrap px-5 py-4 text-slate-600">{item.type === "ROUTER" ? formatDuration(item.uptime) : "Non disponible"}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(item.status)}`}>{statusText(item.status)}</span></td></tr>;
}

function Loading() {
  return <div className="flex min-h-80 items-center justify-center text-slate-600"><div className="text-center"><RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-indigo-600" /><p>Chargement de l'infrastructure réelle…</p></div></div>;
}

function LoadFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><h1 className="font-semibold">L'infrastructure n'est pas disponible</h1><p className="mt-1 text-sm">{message}</p><button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-800">Réessayer</button></div></div></div>;
}
