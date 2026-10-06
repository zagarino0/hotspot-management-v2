import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Plus,
  Search,
  Ticket,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  getMikrotikVouchers,
  getVoucherStats,
  type MikrotikVoucher,
  type VoucherStats,
} from "../../services/voucherService";

const STATUS_CONFIG: Record<
  MikrotikVoucher["status"],
  { label: string; className: string; dot: string }
> = {
  UNUSED: {
    label: "Disponible",
    className: "bg-emerald-50 text-emerald-600",
    dot: "bg-emerald-500",
  },
  ACTIVE: {
    label: "Utilisé",
    className: "bg-blue-50 text-blue-600",
    dot: "bg-blue-500",
  },
  EXPIRED: {
    label: "Expiré",
    className: "bg-red-50 text-red-500",
    dot: "bg-red-500",
  },
  DISABLED: {
    label: "Désactivé",
    className: "bg-slate-100 text-slate-500",
    dot: "bg-slate-400",
  },
  REVOKED: {
    label: "Révoqué",
    className: "bg-slate-100 text-slate-500",
    dot: "bg-slate-400",
  },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";

  if (seconds % 86400 === 0) {
    const days = seconds / 86400;
    return `${days} jour${days > 1 ? "s" : ""}`;
  }

  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} heure${hours > 1 ? "s" : ""}`;
  }

  return `${Math.round(seconds / 60)} min`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function Vouchers() {
  const navigate = useNavigate();

  const [vouchers, setVouchers] = useState<MikrotikVoucher[]>([]);
  const [stats, setStats] = useState<VoucherStats>({
    total: 0,
    available: 0,
    used: 0,
    expired: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | MikrotikVoucher["status"]
  >("all");

  const filtered = useMemo(() => {
    let rows = vouchers;

    if (statusFilter !== "all") {
      rows = rows.filter((v) => v.status === statusFilter);
    }

    const query = search.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((v) =>
      [v.code, v.profile, v.siteName, v.comment, v.macAddress]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    );
  }, [vouchers, statusFilter, search]);


  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Presse-papier indisponible (contexte non sécurisé,
      // permission refusée) : on ignore silencieusement, ce
      // n'est pas une erreur bloquante pour l'utilisateur.
    }
  }

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
              Gestion hotspot
            </span>
          </div>

          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-slate-950">
            Vouchers
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Créez et gérez les tickets d'accès WiFi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/vouchers/new")}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Plus size={16} strokeWidth={2} />
            Générer des vouchers
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {/* ============================================================
          KPI
      ============================================================ */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <VoucherStat
          label="Total vouchers"
          value={String(stats.total)}
          icon={Ticket}
        />

        <VoucherStat
          label="Disponibles"
          value={String(stats.available)}
          icon={CheckCircle2}
          positive
        />

        <VoucherStat
          label="Utilisés"
          value={String(stats.used)}
          icon={Copy}
        />

        <VoucherStat
          label="Expirés"
          value={String(stats.expired)}
          icon={XCircle}
        />
      </section>

      {/* ============================================================
          VOUCHERS TABLE
      ============================================================ */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {/* TOOLBAR */}

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
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
              placeholder="Rechercher un voucher..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "all" | MikrotikVoucher["status"]
              )
            }
            className="h-10 w-fit rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-slate-400"
          >
            <option value="all">Tous les statuts</option>
            <option value="UNUSED">Disponibles</option>
            <option value="ACTIVE">Utilisés</option>
            <option value="EXPIRED">Expirés</option>
          </select>
        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Voucher
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Forfait
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Durée
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Site
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Créé le
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Statut
                </th>

                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Adresse MAC
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
                    Chargement des vouchers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >
                    <div className="text-sm font-semibold text-slate-600">
                      Aucun voucher trouvé
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      {search || statusFilter !== "all"
                        ? "Aucun résultat pour ces filtres."
                        : "Générez votre premier lot de vouchers."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((voucher) => (
                  <VoucherRow
                    key={voucher.id}
                    voucher={voucher}
                    onCopy={handleCopy}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}

        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
            <span className="text-xs text-slate-400">
              Affichage de {filtered.length} sur{" "}
              {vouchers.length} voucher
              {vouchers.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

/* ================================================================
   STAT
================================================================ */

interface VoucherStatProps {
  label: string;
  value: string;
  icon: typeof Ticket;
  positive?: boolean;
}

function VoucherStat({
  label,
  value,
  icon: Icon,
  positive,
}: VoucherStatProps) {
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
   ROW
================================================================ */

function VoucherRow({
  voucher,
  onCopy,
}: {
  voucher: MikrotikVoucher;
  onCopy: (code: string) => void;
}) {
  const statusInfo = STATUS_CONFIG[voucher.status];

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Ticket size={16} strokeWidth={1.8} />
          </div>
          <div>
            <p className="font-mono text-sm font-semibold text-slate-800">
              {voucher.code}
            </p>
            <button
              type="button"
              onClick={() => onCopy(voucher.code)}
              className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700"
            >
              <Copy size={11} />
              Copier
            </button>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="text-sm font-semibold text-slate-700">
          {voucher.profile ?? "—"}
        </span>
      </td>
      <td className="px-5 py-4 text-sm text-slate-600">
        {formatDuration(voucher.durationSeconds)}
      </td>
      <td className="px-5 py-4 text-sm font-medium text-slate-600">
        {voucher.siteName}
      </td>
      <td className="px-5 py-4 text-sm text-slate-500">
        {formatDate(voucher.createdAt)}
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
      <td className="px-5 py-4 text-right text-xs text-slate-400">
        {voucher.macAddress ?? "—"}
      </td>
    </tr>
  );
}
