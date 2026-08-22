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
  const trendStyles = {
    positive: "text-emerald-600",
    negative: "red-500",
    neutral: "text-slate-500",
  };

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border border-slate-200",
        "bg-white p-5",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        "transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-slate-300",
        "hover:shadow-[0_8px_25px_rgba(15,23,42,0.07)]",
      ].join(" ")}
    >
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

        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center",
            "rounded-xl border border-slate-200",
            "bg-slate-50 text-slate-600",
            "transition-all duration-200",
            "group-hover:border-slate-300 group-hover:bg-slate-100",
          ].join(" ")}
        >
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
              trendType === "negative"
                ? "text-red-500"
                : trendStyles[trendType]
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

export default function Dashboard() {
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

        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>

          <span className="text-xs font-semibold text-emerald-700">
            WIFI MAHAVOKY opérationnel
          </span>
        </div>
      </header>

      {/* PRIMARY KPI */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Clients"
            value="124"
            description="Clients enregistrés"
            icon={Users}
            trend="+8,4 %"
          />

          <StatCard
            label="Sessions actives"
            value="37"
            description="Connexions actuellement actives"
            icon={Activity}
            trend="+12,1 %"
          />

          <StatCard
            label="Routers"
            value="3"
            description="Infrastructure réseau"
            icon={Router}
            trend="Stable"
            trendType="neutral"
          />

          <StatCard
            label="Access Points"
            value="8"
            description="Points d'accès configurés"
            icon={Wifi}
            trend="+1"
          />
        </div>
      </section>

      {/* SECONDARY KPI */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Sites"
            value="2"
            description="Sites WiFi configurés"
            icon={MapPin}
          />

          <StatCard
            label="Vouchers"
            value="1 842"
            description="Vouchers disponibles"
            icon={Ticket}
            trend="+15,7 %"
          />

          <StatCard
            label="Ventes"
            value="428"
            description="Ventes du mois"
            icon={ShoppingCart}
            trend="+9,2 %"
          />

          <StatCard
            label="Chiffre d'affaires"
            value="1 284 000 Ar"
            description="CA du mois"
            icon={Banknote}
            trend="+11,8 %"
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
                Sessions hotspot des 7 derniers jours
              </p>
            </div>

            <select
              aria-label="Période du graphique"
              className={[
                "w-fit rounded-lg border border-slate-200",
                "bg-white px-3 py-2",
                "text-xs font-medium text-slate-600",
                "outline-none transition-colors",
                "hover:border-slate-300",
                "focus:border-slate-400 focus:ring-2 focus:ring-slate-100",
              ].join(" ")}
              defaultValue="7"
            >
              <option value="7">7 jours</option>
              <option value="30">30 jours</option>
              <option value="90">90 jours</option>
            </select>
          </div>

          {/* CHART AREA */}
          <div
            className={[
              "relative mt-6 h-64 overflow-hidden rounded-xl",
              "border border-slate-100 bg-slate-50/80",
              "bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)]",
              "bg-[length:48px_48px]",
            ].join(" ")}
          >
            <div className="relative flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-300 shadow-sm">
                  <Activity size={21} strokeWidth={1.6} />
                </div>

                <p className="mt-3 text-sm font-semibold text-slate-600">
                  Graphique des sessions
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Les données seront connectées à l'API V2.
                </p>
              </div>
            </div>
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
              className="text-emerald-500"
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
              status="Connected"
              online
            />

            <SystemStatus
              label="MikroTik"
              status="Online"
              online
            />

            <SystemStatus
              label="Hotspot"
              status="Operational"
              online
            />
          </div>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-medium text-slate-500">
                Dernière synchronisation
              </span>

              <span className="whitespace-nowrap text-xs font-semibold text-slate-700">
                Il y a 2 min
              </span>
            </div>
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

            <button
              type="button"
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Voir tout
            </button>
          </div>

          <div className="mt-5 space-y-2">
            <SaleRow
              voucher="WIFI-1000"
              method="Mvola"
              amount="1 000 Ar"
              status="Payé"
            />

            <SaleRow
              voucher="WIFI-3000"
              method="Cash"
              amount="3 000 Ar"
              status="Payé"
            />

            <SaleRow
              voucher="WIFI-500"
              method="Orange Money"
              amount="500 Ar"
              status="Payé"
            />

            <SaleRow
              voucher="WIFI-10000"
              method="Mvola"
              amount="10 000 Ar"
              status="Payé"
            />
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
            <NetworkRow
              name="MikroTik Router 01"
              type="Router"
              status="ONLINE"
            />

            <NetworkRow
              name="Wavlink AP 01"
              type="Access Point"
              status="ONLINE"
            />

            <NetworkRow
              name="Wavlink AP 02"
              type="Access Point"
              status="ONLINE"
            />

            <NetworkRow
              name="MikroTik Router 02"
              type="Router"
              status="OFFLINE"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ================================================================
   SYSTEM STATUS
================================================================ */

interface SystemStatusProps {
  label: string;
  status: string;
  online: boolean;
}

function SystemStatus({
  label,
  status,
  online,
}: SystemStatusProps) {
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

interface SaleRowProps {
  voucher: string;
  method: string;
  amount: string;
  status: string;
}

function SaleRow({
  voucher,
  method,
  amount,
  status,
}: SaleRowProps) {
  return (
    <div className="group flex items-center justify-between rounded-xl border border-slate-100 px-3.5 py-3 transition-all duration-200 hover:border-slate-200 hover:bg-slate-50">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-white">
          <Ticket size={15} strokeWidth={1.8} />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {voucher}
          </p>

          <p className="mt-0.5 text-xs text-slate-400">
            {method}
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

interface NetworkRowProps {
  name: string;
  type: string;
  status: "ONLINE" | "OFFLINE";
}

function NetworkRow({
  name,
  type,
  status,
}: NetworkRowProps) {
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