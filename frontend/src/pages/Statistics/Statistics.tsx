import {
  Activity,
  BarChart3,
  CreditCard,
  Download,
  TrendingUp,
  Users,
} from "lucide-react";

export default function Statistics() {
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />

            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Analyse & performance
            </span>
          </div>

          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-slate-950">
            Statistiques
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Analyse des ventes, sessions et performances du réseau.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            defaultValue="month"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="today">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="year">Cette année</option>
          </select>

          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Download size={15} />
            Exporter
          </button>
        </div>
      </header>

      {/* KPI */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Chiffre d'affaires"
          value="1 284 000 Ar"
          description="+11,8 % vs période précédente"
          icon={TrendingUp}
          positive
        />

        <Stat
          label="Ventes"
          value="428"
          description="+9,2 % vs période précédente"
          icon={CreditCard}
          positive
        />

        <Stat
          label="Sessions"
          value="2 846"
          description="+14,6 % vs période précédente"
          icon={Activity}
          positive
        />

        <Stat
          label="Clients actifs"
          value="124"
          description="+8,4 % vs période précédente"
          icon={Users}
          positive
        />
      </section>

      {/* MAIN ANALYTICS */}
      <section className="grid gap-6 xl:grid-cols-3">
        {/* REVENUE CHART */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <BarChart3 size={16} strokeWidth={1.8} />
                </div>

                <h2 className="text-sm font-semibold text-slate-950">
                  Évolution du chiffre d'affaires
                </h2>
              </div>

              <p className="mt-2 text-xs text-slate-400">
                Performance commerciale sur la période sélectionnée
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-900" />
                <span className="text-slate-500">CA</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                <span className="text-slate-500">Période précédente</span>
              </div>
            </div>
          </div>

          <div className="relative mt-6 h-72 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/70">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:48px_48px]" />

            <div className="relative flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-300 shadow-sm">
                  <BarChart3 size={21} strokeWidth={1.6} />
                </div>

                <p className="mt-3 text-sm font-semibold text-slate-600">
                  Graphique du chiffre d'affaires
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Les données seront alimentées par l'API V2.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PAYMENT METHODS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">
              Moyens de paiement
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Répartition des ventes
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <PaymentRow
              label="MVola"
              value="48 %"
              amount="616 320 Ar"
            />

            <PaymentRow
              label="Orange Money"
              value="23 %"
              amount="295 320 Ar"
            />

            <PaymentRow
              label="Cash"
              value="29 %"
              amount="372 360 Ar"
            />
          </div>

          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Total
              </span>

              <span className="text-sm font-bold text-slate-800">
                1 284 000 Ar
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECONDARY ANALYTICS */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* VOUCHERS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <CreditCard size={16} strokeWidth={1.8} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                Ventes par tarif
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Performance des différents vouchers
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <TariffRow
              label="500 Ar"
              sales="146 ventes"
              percentage="34 %"
              width="34%"
            />

            <TariffRow
              label="1 000 Ar"
              sales="121 ventes"
              percentage="28 %"
              width="28%"
            />

            <TariffRow
              label="3 000 Ar"
              sales="103 ventes"
              percentage="24 %"
              width="24%"
            />

            <TariffRow
              label="10 000 Ar"
              sales="58 ventes"
              percentage="14 %"
              width="14%"
            />
          </div>
        </div>

        {/* SESSIONS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Activity size={16} strokeWidth={1.8} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                Activité réseau
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Sessions et utilisateurs
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <MiniMetric
              label="Sessions aujourd'hui"
              value="386"
            />

            <MiniMetric
              label="Pic simultané"
              value="61"
            />

            <MiniMetric
              label="Durée moyenne"
              value="42 min"
            />

            <MiniMetric
              label="Clients actifs"
              value="124"
            />
          </div>

          <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />

              <span className="text-xs font-semibold text-emerald-700">
                Infrastructure stable
              </span>
            </div>

            <p className="mt-1 text-xs text-emerald-600/80">
              Aucun incident réseau critique détecté.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ================================================================
   STAT
================================================================ */

interface StatProps {
  label: string;
  value: string;
  description: string;
  icon: typeof TrendingUp;
  positive?: boolean;
}

function Stat({
  label,
  value,
  description,
  icon: Icon,
  positive,
}: StatProps) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_25px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 truncate text-[25px] font-bold tracking-[-0.03em] text-slate-950">
            {value}
          </p>

          <p
            className={[
              "mt-1 text-xs",
              positive
                ? "text-emerald-600"
                : "text-slate-400",
            ].join(" ")}
          >
            {description}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
          <Icon size={18} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   PAYMENT
================================================================ */

interface PaymentRowProps {
  label: string;
  value: string;
  amount: string;
}

function PaymentRow({
  label,
  value,
  amount,
}: PaymentRowProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">
          {label}
        </span>

        <span className="text-xs font-bold text-slate-600">
          {value}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900"
          style={{ width: value }}
        />
      </div>

      <div className="mt-1 text-right text-[11px] text-slate-400">
        {amount}
      </div>
    </div>
  );
}

/* ================================================================
   TARIFF
================================================================ */

interface TariffRowProps {
  label: string;
  sales: string;
  percentage: string;
  width: string;
}

function TariffRow({
  label,
  sales,
  percentage,
  width,
}: TariffRowProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-slate-700">
            {label}
          </span>

          <span className="ml-2 text-xs text-slate-400">
            {sales}
          </span>
        </div>

        <span className="text-xs font-bold text-slate-600">
          {percentage}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-800"
          style={{ width }}
        />
      </div>
    </div>
  );
}

/* ================================================================
   MINI METRIC
================================================================ */

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold tracking-tight text-slate-800">
        {value}
      </p>
    </div>
  );
}