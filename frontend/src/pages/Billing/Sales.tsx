import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CreditCard,
  Plus,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  Wallet,
  Wallet2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import ActionMenu from "../../components/ui/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Modal from "../../components/ui/Modal";

import {
  cancelSale,
  deleteSale,
  getSales,
  getSalesSummary,
  recordPayment,
  type PaymentMethod,
  type Sale,
  type SaleStatus,
  type SalesSummary,
} from "../../services/saleService";

const STATUS_CONFIG: Record<
  SaleStatus,
  { label: string; className: string; dot: string }
> = {
  PENDING: {
    label: "En attente",
    className: "bg-amber-50 text-amber-600",
    dot: "bg-amber-500",
  },
  PAID: {
    label: "Payé",
    className: "bg-emerald-50 text-emerald-600",
    dot: "bg-emerald-500",
  },
  PARTIALLY_PAID: {
    label: "Partiellement payé",
    className: "bg-blue-50 text-blue-600",
    dot: "bg-blue-500",
  },
  CANCELLED: {
    label: "Annulé",
    className: "bg-slate-100 text-slate-500",
    dot: "bg-slate-400",
  },
  REFUNDED: {
    label: "Remboursé",
    className: "bg-red-50 text-red-500",
    dot: "bg-red-500",
  },
};

const METHOD_OPTIONS: Array<{
  value: PaymentMethod;
  label: string;
}> = [
  { value: "CASH", label: "Cash" },
  { value: "MVOLA", label: "MVola" },
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "AIRTEL_MONEY", label: "Airtel Money" },
  { value: "BANK", label: "Banque" },
  { value: "OTHER", label: "Autre" },
];

function getMethodLabel(method: PaymentMethod): string {
  return (
    METHOD_OPTIONS.find((option) => option.value === method)
      ?.label ?? method
  );
}

function formatAmount(amount: number, currency: string): string {
  return `${amount.toLocaleString("fr-FR")} ${currency}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Sales() {
  const navigate = useNavigate();

  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<SalesSummary | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | SaleStatus
  >("all");

  const [payingSale, setPayingSale] = useState<Sale | null>(
    null
  );
  const [payForm, setPayForm] = useState({
    amount: "",
    method: "CASH" as PaymentMethod,
  });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(
    null
  );

  const [cancellingSale, setCancellingSale] =
    useState<Sale | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<
    string | null
  >(null);

  const [deletingSale, setDeletingSale] =
    useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<
    string | null
  >(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const [salesData, summaryData] = await Promise.all([
        getSales(),
        getSalesSummary(),
      ]);

      setSales(salesData);
      setSummary(summaryData);
    } catch (err) {
      console.error(
        "Erreur lors du chargement des ventes :",
        err
      );

      setError("Impossible de charger les ventes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let rows = sales;

    if (statusFilter !== "all") {
      rows = rows.filter((s) => s.status === statusFilter);
    }

    const query = search.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((s) =>
      [
        s.voucherCode,
        s.planName,
        s.customerName,
        s.customerPhone,
        s.siteName,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    );
  }, [sales, statusFilter, search]);

  function openPayment(sale: Sale) {
    setPayingSale(sale);
    setPayForm({
      amount: String(
        Math.max(sale.totalAmount - sale.paidAmount, 0)
      ),
      method: "CASH",
    });
    setPayError(null);
  }

  async function handleConfirmPayment() {
    if (!payingSale) return;

    const amount = Number(payForm.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setPayError("Le montant doit être un nombre positif.");
      return;
    }

    setPaying(true);
    setPayError(null);

    try {
      await recordPayment(payingSale.id, {
        amount,
        method: payForm.method,
        markAsPaid: true,
      });

      setPayingSale(null);
      await load();
    } catch (err: any) {
      setPayError(
        err?.response?.data?.message ??
          "Impossible d'enregistrer ce paiement."
      );
    } finally {
      setPaying(false);
    }
  }

  async function handleConfirmCancel() {
    if (!cancellingSale) return;

    setCancelling(true);
    setCancelError(null);

    try {
      await cancelSale(cancellingSale.id);
      setCancellingSale(null);
      await load();
    } catch (err: any) {
      setCancelError(
        err?.response?.data?.message ??
          "Impossible d'annuler cette vente."
      );
    } finally {
      setCancelling(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingSale) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteSale(deletingSale.id);
      setDeletingSale(null);
      await load();
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.message ??
          "Impossible de supprimer cette vente."
      );
    } finally {
      setDeleting(false);
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

        <button
          type="button"
          onClick={() => navigate("/billing/sales/new")}
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          <Plus size={16} strokeWidth={2} />
          Nouvelle vente
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {/* ============================================================
          KPI (calculés depuis les vraies données, pas simulés)
      ============================================================ */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SalesStat
          label="Chiffre d'affaires"
          value={
            summary
              ? formatAmount(summary.totalRevenue, "MGA")
              : "—"
          }
          icon={Wallet}
          positive
        />

        <SalesStat
          label="Ventes payées"
          value={summary ? String(summary.salesCount) : "—"}
          icon={ShoppingCart}
        />

        <SalesStat
          label="Panier moyen"
          value={
            summary
              ? formatAmount(
                  Math.round(summary.averageBasket),
                  "MGA"
                )
              : "—"
          }
          icon={CreditCard}
        />

        <SalesStat
          label="Paiements mobile"
          value={
            summary
              ? `${Math.round(summary.mobilePaymentShare)} %`
              : "—"
          }
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
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Rechercher une vente..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "all" | SaleStatus
              )
            }
            className="h-10 w-fit rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-slate-400"
          >
            <option value="all">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="PAID">Payées</option>
            <option value="PARTIALLY_PAID">
              Partiellement payées
            </option>
            <option value="CANCELLED">Annulées</option>
            <option value="REFUNDED">Remboursées</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Voucher / Forfait
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
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-slate-400"
                  >
                    Chargement des ventes...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center"
                  >
                    <div className="text-sm font-semibold text-slate-600">
                      Aucune vente trouvée
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      {search || statusFilter !== "all"
                        ? "Aucun résultat pour ces filtres."
                        : "Enregistrez votre première vente."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((sale) => (
                  <SaleRow
                    key={sale.id}
                    sale={sale}
                    onPay={() => openPayment(sale)}
                    onCancel={() => {
                      setCancellingSale(sale);
                      setCancelError(null);
                    }}
                    onDelete={() => {
                      setDeletingSale(sale);
                      setDeleteError(null);
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-4">
            <span className="text-xs text-slate-400">
              {filtered.length} vente
              {filtered.length > 1 ? "s" : ""} affichée
              {filtered.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </section>

      {/* ============================================================
          RECORD PAYMENT MODAL
      ============================================================ */}

      <Modal
        open={payingSale !== null}
        title="Enregistrer un paiement"
        description={payingSale?.voucherCode ?? payingSale?.planName}
        onClose={() => setPayingSale(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setPayingSale(null)}
              disabled={paying}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleConfirmPayment}
              disabled={paying}
              className="rounded-lg bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {paying
                ? "Enregistrement..."
                : "Enregistrer le paiement"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {payingSale && (
            <p className="text-xs text-slate-400">
              Reste à payer :{" "}
              <span className="font-semibold text-slate-700">
                {formatAmount(
                  Math.max(
                    payingSale.totalAmount -
                      payingSale.paidAmount,
                    0
                  ),
                  payingSale.currency
                )}
              </span>
            </p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Montant
            </span>

            <input
              type="number"
              min={1}
              value={payForm.amount}
              onChange={(event) =>
                setPayForm((f) => ({
                  ...f,
                  amount: event.target.value,
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Méthode de paiement
            </span>

            <select
              value={payForm.method}
              onChange={(event) =>
                setPayForm((f) => ({
                  ...f,
                  method: event.target.value as PaymentMethod,
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              {METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {payError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {payError}
          </div>
        )}
      </Modal>

      {/* ============================================================
          CANCEL CONFIRM
      ============================================================ */}

      <ConfirmDialog
        open={cancellingSale !== null}
        title="Annuler cette vente ?"
        message="La vente sera marquée comme annulée. Impossible si un paiement a déjà été reçu."
        confirmLabel="Annuler la vente"
        loading={cancelling}
        error={cancelError}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancellingSale(null)}
      />

      {/* ============================================================
          DELETE CONFIRM
      ============================================================ */}

      <ConfirmDialog
        open={deletingSale !== null}
        title="Supprimer cette vente ?"
        message="Cette vente sera définitivement supprimée. Possible uniquement si elle est en attente et n'a reçu aucun paiement."
        confirmLabel="Supprimer"
        loading={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingSale(null)}
      />
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
  sale,
  onPay,
  onCancel,
  onDelete,
}: {
  sale: Sale;
  onPay: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const statusInfo = STATUS_CONFIG[sale.status];

  const canPay =
    sale.status === "PENDING" || sale.status === "PARTIALLY_PAID";
  const canCancel = sale.status === "PENDING" && sale.paidAmount === 0;
  const canDelete = canCancel;

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <p className="font-mono text-xs font-semibold text-slate-700">
          {sale.voucherCode ?? "—"}
        </p>

        <p className="mt-0.5 text-xs text-slate-400">
          {sale.planName}
        </p>
      </td>

      <td className="px-5 py-4">
        <span className="text-sm text-slate-600">
          {sale.customerName || sale.customerPhone || "—"}
        </span>
      </td>

      <td className="px-5 py-4">
        <span className="text-sm font-bold text-slate-800">
          {formatAmount(sale.totalAmount, sale.currency)}
        </span>

        {sale.status === "PARTIALLY_PAID" && (
          <p className="mt-0.5 text-[11px] text-blue-500">
            {formatAmount(sale.paidAmount, sale.currency)} reçu
          </p>
        )}
      </td>

      <td className="px-5 py-4">
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
          {sale.lastPaymentMethod
            ? getMethodLabel(sale.lastPaymentMethod)
            : "—"}
        </span>
      </td>

      <td className="px-5 py-4 text-sm text-slate-600">
        {sale.siteName}
      </td>

      <td className="px-5 py-4 text-xs text-slate-500">
        {formatDate(sale.soldAt)}
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

      <td className="px-5 py-4 text-right">
        <ActionMenu
          ariaLabel={`Actions pour cette vente`}
          items={[
            {
              label: "Enregistrer un paiement",
              icon: Wallet2,
              onClick: onPay,
              disabled: !canPay,
            },
            {
              label: "Annuler",
              icon: Ban,
              onClick: onCancel,
              disabled: !canCancel,
              danger: true,
            },
            {
              label: "Supprimer",
              icon: Trash2,
              onClick: onDelete,
              disabled: !canDelete,
              danger: true,
            },
          ]}
        />
      </td>
    </tr>
  );
}
