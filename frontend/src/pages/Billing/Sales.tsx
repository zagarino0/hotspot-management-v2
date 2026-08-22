import {
  CreditCard,
  Download,
  MoreHorizontal,
  Plus,
  Search,
  ShoppingCart,
  Smartphone,
  Wallet,
} from "lucide-react";

interface SaleRowProps {
  reference: string;
  voucher: string;
  client: string;
  amount: string;
  method: "MVOLA" | "ORANGE_MONEY" | "CASH";
  site: string;
  date: string;
  status: "PAID" | "PENDING" | "CANCELLED";
}

export default function Sales() {
  return (
    <div className="space-y-6">
      {/* ============================================================
          HEADER
      ============================================================ */}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />

            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Gestion commerciale
            </span>
          </div>

          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-slate-950">
            Ventes
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Suivez les ventes de vouchers et les paiements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Download size={16} strokeWidth={1.8} />
            Exporter
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Plus size={16} strokeWidth={2} />
            Nouvelle vente
          </button>
        </div>
      </header>

      {/* ============================================================
          KPI
      ============================================================ */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SalesStat
          label="Chiffre d'affaires"
          value="1 284 000 Ar"
          icon={Wallet}
          positive
        />

        <SalesStat
          label="Ventes"
          value="428"
          icon={ShoppingCart}
        />

        <SalesStat
          label="Panier moyen"
          value="3 000 Ar"
          icon={CreditCard}
        />

        <SalesStat
          label="Paiements mobile"
          value="71 %"
          icon={Smartphone}
        />
      </section>

      {/* ============================================================
          FILTERS + TABLE
      ============================================================ */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-sm">
            <Search
              size={16}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              placeholder="Rechercher une vente..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              defaultValue="all"
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-slate-400"
            >
              <option value="all">Tous les paiements</option>
              <option value="mvola">MVola</option>
              <option value="orange">Orange Money</option>
              <option value="cash">Cash</option>
            </select>

            <select
              defaultValue="all"
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-slate-400"
            >
              <option value="all">Tous les statuts</option>
              <option value="paid">Payés</option>
              <option value="pending">En attente</option>
              <option value="cancelled">Annulés</option>
            </select>

            <select
              defaultValue="month"
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-slate-400"
            >
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="year">Cette année</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Référence
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Voucher
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Client
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Montant
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Paiement
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Site
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Date
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
              <SaleRow
                reference="VNT-000428"
                voucher="WIFI-1000"
                client="Jean Rakoto"
                amount="1 000 Ar"
                method="MVOLA"
                site="WIFI MAHAVOKY"
                date="16/08/2026 16:42"
                status="PAID"
              />

              <SaleRow
                reference="VNT-000427"
                voucher="WIFI-3000"
                client="Mamy Andria"
                amount="3 000 Ar"
                method="CASH"
                site="WIFI MAHAVOKY"
                date="16/08/2026 16:18"
                status="PAID"
              />

              <SaleRow
                reference="VNT-000426"
                voucher="WIFI-500"
                client="Hery Randria"
                amount="500 Ar"
                method="ORANGE_MONEY"
                site="WIFI MADIROVALO"
                date="16/08/2026 15:57"
                status="PAID"
              />

              <SaleRow
                reference="VNT-000425"
                voucher="WIFI-10000"
                client="Toky Rakoto"
                amount="10 000 Ar"
                method="MVOLA"
                site="WIFI MAHAVOKY"
                date="16/08/2026 15:21"
                status="PENDING"
              />
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-slate-400">
            428 ventes enregistrées ce mois
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              Précédent
            </button>

            <span className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white">
              1
            </span>

            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              Suivant
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ================================================================
   STAT
================================================================ */

interface SalesStatProps {
  label: string;
  value: string;
  icon: typeof Wallet;
  positive?: boolean;
}

function SalesStat({
  label,
  value,
  icon: Icon,
  positive,
}: SalesStatProps) {
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
   SALE ROW
================================================================ */

function SaleRow({
  reference,
  voucher,
  client,
  amount,
  method,
  site,
  date,
  status,
}: SaleRowProps) {
  const paymentConfig = {
    MVOLA: {
      label: "MVola",
      className: "bg-blue-50 text-blue-600",
    },
    ORANGE_MONEY: {
      label: "Orange Money",
      className: "bg-orange-50 text-orange-600",
    },
    CASH: {
      label: "Cash",
      className: "bg-slate-100 text-slate-600",
    },
  };

  const statusConfig = {
    PAID: {
      label: "PAYÉ",
      className: "bg-emerald-50 text-emerald-600",
      dot: "bg-emerald-500",
    },
    PENDING: {
      label: "EN ATTENTE",
      className: "bg-amber-50 text-amber-600",
      dot: "bg-amber-500",
    },
    CANCELLED: {
      label: "ANNULÉ",
      className: "bg-red-50 text-red-500",
      dot: "bg-red-500",
    },
  };

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <span className="font-mono text-xs font-semibold text-slate-600">
          {reference}
        </span>
      </td>

      <td className="px-5 py-4">
        <span className="text-sm font-semibold text-slate-800">
          {voucher}
        </span>
      </td>

      <td className="px-5 py-4">
        <span className="text-sm text-slate-600">
          {client}
        </span>
      </td>

      <td className="px-5 py-4">
        <span className="text-sm font-bold text-slate-800">
          {amount}
        </span>
      </td>

      <td className="px-5 py-4">
        <span
          className={[
            "inline-flex rounded-full px-2.5 py-1",
            "text-[10px] font-bold",
            paymentConfig[method].className,
          ].join(" ")}
        >
          {paymentConfig[method].label}
        </span>
      </td>

      <td className="px-5 py-4 text-sm text-slate-600">
        {site}
      </td>

      <td className="px-5 py-4 text-xs text-slate-500">
        {date}
      </td>

      <td className="px-5 py-4">
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
            "text-[10px] font-bold tracking-wide",
            statusConfig[status].className,
          ].join(" ")}
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              statusConfig[status].dot,
            ].join(" ")}
          />

          {statusConfig[status].label}
        </span>
      </td>

      <td className="px-5 py-4 text-right">
        <button
          type="button"
          aria-label={`Actions pour ${reference}`}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <MoreHorizontal size={18} />
        </button>
      </td>
    </tr>
  );
}