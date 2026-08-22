import {
  Activity,
  CheckCircle2,
  Database,
  MoreHorizontal,
  Network,
  Plus,
  Router as RouterIcon,
  Search,
  Server,
  Wifi,
  XCircle,
} from "lucide-react";

import PageHeader from "../../components/ui/PageHeader";

interface InfrastructureRowProps {
  name: string;
  type: string;
  address: string;
  site: string;
  status: "ONLINE" | "OFFLINE";
  uptime: string;
}

interface InfrastructureSummaryProps {
  label: string;
  value: string;
  icon: typeof Server;
  positive?: boolean;
  negative?: boolean;
}

const infrastructure: InfrastructureRowProps[] = [
  {
    name: "MikroTik Router 01",
    type: "Router",
    address: "192.168.88.1",
    site: "WIFI MAHAVOKY",
    status: "ONLINE",
    uptime: "12 j 08 h",
  },
  {
    name: "MikroTik Router 02",
    type: "Router",
    address: "192.168.88.10",
    site: "WIFI MADIROVALO",
    status: "ONLINE",
    uptime: "8 j 14 h",
  },
  {
    name: "Wavlink AP 01",
    type: "Access Point",
    address: "192.168.88.2",
    site: "WIFI MAHAVOKY",
    status: "ONLINE",
    uptime: "12 j 07 h",
  },
  {
    name: "Wavlink AP 02",
    type: "Access Point",
    address: "192.168.88.3",
    site: "WIFI MAHAVOKY",
    status: "ONLINE",
    uptime: "11 j 22 h",
  },
  {
    name: "MikroTik Router 03",
    type: "Router",
    address: "192.168.88.20",
    site: "WIFI MAHAVOKY",
    status: "OFFLINE",
    uptime: "—",
  },
];

export default function Infrastructure() {
  const total = infrastructure.length;

  const online = infrastructure.filter(
    (item) => item.status === "ONLINE",
  ).length;

  const offline = infrastructure.filter(
    (item) => item.status === "OFFLINE",
  ).length;

  const routers = infrastructure.filter(
    (item) => item.type === "Router",
  ).length;

  const accessPoints = infrastructure.filter(
    (item) => item.type === "Access Point",
  ).length;

  return (
    <div className="space-y-6">
      {/* ============================================================
          PAGE HEADER
      ============================================================ */}

      <PageHeader
        eyebrow="Administration"
        title="Infrastructure"
        description="Supervisez l'ensemble des équipements et services de votre infrastructure hotspot."
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Plus size={16} strokeWidth={2} />
            Ajouter un équipement
          </button>
        }
      />

      {/* ============================================================
          SERVICE STATUS
      ============================================================ */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ServiceCard
          label="Backend API"
          description="Service applicatif"
          status="Operational"
          icon={Server}
        />

        <ServiceCard
          label="PostgreSQL"
          description="Base de données"
          status="Connected"
          icon={Database}
        />

        <ServiceCard
          label="Hotspot"
          description="Service réseau"
          status="Operational"
          icon={Wifi}
        />

        <ServiceCard
          label="Monitoring"
          description="Supervision"
          status="Active"
          icon={Activity}
        />
      </section>

      {/* ============================================================
          EQUIPMENT
      ============================================================ */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {/* TOOLBAR */}

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Network
                  size={16}
                  strokeWidth={1.8}
                />
              </div>

              <h2 className="text-sm font-semibold text-slate-950">
                Équipements réseau
              </h2>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Routeurs et points d'accès actuellement enregistrés.
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search
              size={16}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              placeholder="Rechercher..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Équipement
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Adresse
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Site
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Uptime
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
              {infrastructure.map((item) => (
                <InfrastructureRow
                  key={item.name}
                  {...item}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============================================================
          SUMMARY
      ============================================================ */}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfrastructureSummary
          label="Équipements"
          value={String(total)}
          icon={Network}
        />

        <InfrastructureSummary
          label="En ligne"
          value={String(online)}
          icon={CheckCircle2}
          positive
        />

        <InfrastructureSummary
          label="Hors ligne"
          value={String(offline)}
          icon={XCircle}
          negative
        />

        <InfrastructureSummary
          label="Routeurs"
          value={String(routers)}
          icon={RouterIcon}
        />
      </section>

      {/* ============================================================
          NETWORK OVERVIEW
      ============================================================ */}

      <section className="grid gap-6 lg:grid-cols-2">
        {/* ACCESS POINTS */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Wifi
                    size={16}
                    strokeWidth={1.8}
                  />
                </div>

                <h2 className="text-sm font-semibold text-slate-950">
                  Access Points
                </h2>
              </div>

              <p className="mt-2 text-xs text-slate-400">
                État des points d'accès réseau.
              </p>
            </div>

            <span className="text-lg font-bold text-slate-950">
              {accessPoints}
            </span>
          </div>

          <div className="mt-5 space-y-2">
            <MiniNetworkRow
              name="Wavlink AP 01"
              site="WIFI MAHAVOKY"
              status="ONLINE"
            />

            <MiniNetworkRow
              name="Wavlink AP 02"
              site="WIFI MAHAVOKY"
              status="ONLINE"
            />

            <MiniNetworkRow
              name="Wavlink AP 03"
              site="WIFI MADIROVALO"
              status="ONLINE"
            />
          </div>
        </div>

        {/* NETWORK HEALTH */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Activity
                    size={16}
                    strokeWidth={1.8}
                  />
                </div>

                <h2 className="text-sm font-semibold text-slate-950">
                  Santé du réseau
                </h2>
              </div>

              <p className="mt-2 text-xs text-slate-400">
                Indicateurs de supervision.
              </p>
            </div>

            <CheckCircle2
              size={19}
              strokeWidth={1.8}
              className="text-emerald-500"
            />
          </div>

          <div className="mt-5 space-y-4">
            <HealthMetric
              label="Disponibilité"
              value="98,7 %"
            />

            <HealthMetric
              label="Latence moyenne"
              value="24 ms"
            />

            <HealthMetric
              label="Paquets perdus"
              value="0,4 %"
            />

            <HealthMetric
              label="Dernière synchronisation"
              value="Il y a 2 min"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ================================================================
   SERVICE CARD
================================================================ */

interface ServiceCardProps {
  label: string;
  description: string;
  status: string;
  icon: typeof Server;
}

function ServiceCard({
  label,
  description,
  status,
  icon: Icon,
}: ServiceCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_25px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Icon
              size={17}
              strokeWidth={1.8}
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {label}
            </p>

            <p className="mt-0.5 truncate text-xs text-slate-400">
              {description}
            </p>
          </div>
        </div>

        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />

          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <span className="text-xs font-semibold text-emerald-600">
          {status}
        </span>
      </div>
    </div>
  );
}

/* ================================================================
   INFRASTRUCTURE ROW
================================================================ */

function InfrastructureRow({
  name,
  type,
  address,
  site,
  status,
  uptime,
}: InfrastructureRowProps) {
  const online = status === "ONLINE";

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      {/* EQUIPMENT */}

      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              online
                ? "bg-slate-100 text-slate-600"
                : "bg-red-50 text-red-500",
            ].join(" ")}
          >
            {type === "Router" ? (
              <RouterIcon
                size={17}
                strokeWidth={1.8}
              />
            ) : (
              <Wifi
                size={17}
                strokeWidth={1.8}
              />
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
      </td>

      {/* ADDRESS */}

      <td className="px-5 py-4">
        <code className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
          {address}
        </code>
      </td>

      {/* SITE */}

      <td className="px-5 py-4 text-sm font-medium text-slate-600">
        {site}
      </td>

      {/* UPTIME */}

      <td className="px-5 py-4 text-sm font-medium text-slate-500">
        {uptime}
      </td>

      {/* STATUS */}

      <td className="px-5 py-4">
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
            "text-[10px] font-bold tracking-wide",
            online
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-500",
          ].join(" ")}
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              online
                ? "bg-emerald-500"
                : "bg-red-500",
            ].join(" ")}
          />

          {status}
        </span>
      </td>

      {/* ACTIONS */}

      <td className="px-5 py-4 text-right">
        <button
          type="button"
          aria-label={`Actions pour ${name}`}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <MoreHorizontal size={18} />
        </button>
      </td>
    </tr>
  );
}

/* ================================================================
   SUMMARY
================================================================ */

function InfrastructureSummary({
  label,
  value,
  icon: Icon,
  positive,
  negative,
}: InfrastructureSummaryProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">
            {label}
          </p>

          <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-950">
            {value}
          </p>
        </div>

        <div
          className={[
            "flex h-9 w-9 items-center justify-center rounded-lg",
            positive
              ? "bg-emerald-50 text-emerald-600"
              : negative
                ? "bg-red-50 text-red-500"
                : "bg-slate-100 text-slate-600",
          ].join(" ")}
        >
          <Icon
            size={17}
            strokeWidth={1.8}
          />
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MINI NETWORK ROW
================================================================ */

interface MiniNetworkRowProps {
  name: string;
  site: string;
  status: "ONLINE" | "OFFLINE";
}

function MiniNetworkRow({
  name,
  site,
  status,
}: MiniNetworkRowProps) {
  const online = status === "ONLINE";

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3.5 py-3 transition-colors hover:border-slate-200 hover:bg-slate-50">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={[
            "h-2 w-2 shrink-0 rounded-full",
            online
              ? "bg-emerald-500"
              : "bg-red-500",
          ].join(" ")}
        />

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-700">
            {name}
          </p>

          <p className="mt-0.5 truncate text-xs text-slate-400">
            {site}
          </p>
        </div>
      </div>

      <span
        className={[
          "text-[10px] font-bold",
          online
            ? "text-emerald-600"
            : "text-red-500",
        ].join(" ")}
      >
        {status}
      </span>
    </div>
  );
}

/* ================================================================
   HEALTH METRIC
================================================================ */

interface HealthMetricProps {
  label: string;
  value: string;
}

function HealthMetric({
  label,
  value,
}: HealthMetricProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-sm font-medium text-slate-500">
        {label}
      </span>

      <span className="text-sm font-semibold text-slate-800">
        {value}
      </span>
    </div>
  );
}