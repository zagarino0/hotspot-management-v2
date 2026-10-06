import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Pencil,
  Plus,
  Save,
  X,
  Search,
  Ticket,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  getMikrotikVouchers,
  getVoucherStats,
  updateMikrotikVoucherComment,
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

  useEffect(() => {
    let cancelled = false;

    async function loadVouchers() {
      setLoading(true);
      setError(null);

      try {
        const [data, voucherStats] = await Promise.all([
          getMikrotikVouchers(),
          getVoucherStats(),
        ]);

        if (cancelled) return;

        setVouchers(data);
        setStats(voucherStats);
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les vouchers."
        );
        setVouchers([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadVouchers();

    return () => {
      cancelled = true;
    };
  }, []);

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

        <div className="max-h-[600px] overflow-auto">
          <table className="w-full min-w-[1000px] table-fixed">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[14%]" />
              <col className="w-[11%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[15%]" />
            </colgroup>

            <thead className="sticky top-0 z-20">
              <tr className="border-b border-slate-100 bg-white">
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

                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
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
                    onCommentSaved={(updated) => {
                      setVouchers((current) =>
                        current.map((item) =>
                          item.id === updated.id ? updated : item
                        )
                      );
                    }}
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
  onCommentSaved,
}: {
  voucher: MikrotikVoucher;
  onCopy: (code: string) => void;
  onCommentSaved: (voucher: MikrotikVoucher) => void;
}) {
  const [editingComment, setEditingComment] = useState(false);
  const [comment, setComment] = useState(voucher.comment ?? "");
  const [savingComment, setSavingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    setComment(voucher.comment ?? "");
  }, [voucher.comment]);

  async function handleSaveComment() {
    setSavingComment(true);
    setCommentError(null);

    try {
      const updated = await updateMikrotikVoucherComment(
        voucher.routerId,
        voucher.code,
        comment
      );

      onCommentSaved(updated);
      setComment(updated.comment ?? "");
      setEditingComment(false);
    } catch (err) {
      setCommentError(
        err instanceof Error
          ? err.message
          : "Impossible de modifier le commentaire."
      );
    } finally {
      setSavingComment(false);
    }
  }
  const statusInfo = STATUS_CONFIG[voucher.status];

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Ticket size={16} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            {editingComment ? (
              <div className="mb-2 flex items-center gap-1.5">
                <input
                  autoFocus
                  value={comment}
                  maxLength={255}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Ajouter un commentaire..."
                  className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 px-2 text-xs text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleSaveComment();
                    }
                    if (event.key === "Escape") {
                      setComment(voucher.comment ?? "");
                      setCommentError(null);
                      setEditingComment(false);
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={savingComment}
                  onClick={() => void handleSaveComment()}
                  title="Enregistrer"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <Save size={14} />
                </button>
                <button
                  type="button"
                  disabled={savingComment}
                  onClick={() => {
                    setComment(voucher.comment ?? "");
                    setCommentError(null);
                    setEditingComment(false);
                  }}
                  title="Annuler"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="mb-1 flex min-w-0 items-center gap-1.5">
                <p
                  className="max-w-[260px] truncate text-[11px] text-slate-400"
                  title={voucher.comment ?? "Aucun commentaire"}
                >
                  {voucher.comment ?? "Aucun commentaire"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCommentError(null);
                    setEditingComment(true);
                  }}
                  title="Modifier le commentaire"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil size={12} />
                </button>
              </div>
            )}

            {commentError && (
              <p className="mb-1 text-[10px] font-medium text-red-500">
                {commentError}
              </p>
            )}

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
      <td className="px-4 py-4 text-left text-xs text-slate-400">
        <span className="block truncate font-mono" title={voucher.macAddress ?? "—"}>
          {voucher.macAddress ?? "—"}
        </span>
      </td>
    </tr>
  );
}
