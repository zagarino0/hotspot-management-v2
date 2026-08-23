import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import { getSites, type Site } from "../../services/siteService";
import { getPlans, type Plan } from "../../services/planService";
import {
  getVouchers,
  type Voucher,
} from "../../services/voucherService";
import { createSale } from "../../services/saleService";

export default function RecordSale() {
  const navigate = useNavigate();

  const [sites, setSites] = useState<Site[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [refLoading, setRefLoading] = useState(true);

  const [siteId, setSiteId] = useState("");
  const [planId, setPlanId] = useState("");
  const [voucherId, setVoucherId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadRefs() {
      try {
        const [sitesData, plansData, vouchersData] =
          await Promise.all([
            getSites(),
            getPlans(),
            getVouchers({ status: "UNUSED" }),
          ]);

        if (mounted) {
          setSites(sitesData);
          setPlans(plansData);
          setVouchers(vouchersData);
        }
      } catch (err) {
        console.error(
          "Erreur lors du chargement des données :",
          err
        );
      } finally {
        if (mounted) {
          setRefLoading(false);
        }
      }
    }

    loadRefs();

    return () => {
      mounted = false;
    };
  }, []);

  const plansForSite = useMemo(
    () => plans.filter((plan) => plan.siteId === siteId),
    [plans, siteId]
  );

  const vouchersForPlan = useMemo(
    () =>
      vouchers.filter(
        (voucher) =>
          voucher.siteId === siteId &&
          (planId ? voucher.planId === planId : true)
      ),
    [vouchers, siteId, planId]
  );

  const selectedPlan = plans.find((p) => p.id === planId);

  function resetSite(nextSiteId: string) {
    setSiteId(nextSiteId);
    setPlanId("");
    setVoucherId("");
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!siteId.trim()) {
      setError("Le site est obligatoire.");
      return;
    }

    if (!planId.trim()) {
      setError("Le forfait est obligatoire.");
      return;
    }

    const numericQuantity = Number(quantity);

    if (
      !Number.isInteger(numericQuantity) ||
      numericQuantity < 1
    ) {
      setError("La quantité doit être un entier positif.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const sale = await createSale({
        siteId: siteId.trim(),
        planId: planId.trim(),
        voucherId: voucherId.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        quantity: numericQuantity,
      });

      navigate(`/billing/sales?highlight=${sale.id}`);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          "Impossible d'enregistrer cette vente."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestion commerciale"
        title="Nouvelle vente"
        description="Enregistrez la vente d'un forfait ou d'un voucher."
        actions={
          <button
            type="button"
            onClick={() => navigate("/billing/sales")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
        }
      />

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <ShoppingCart size={20} />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Détails de la vente
            </h2>

            <p className="text-sm text-slate-400">
              Le montant est calculé automatiquement à partir du
              prix du forfait.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Site
              </span>

              <select
                value={siteId}
                onChange={(event) =>
                  resetSite(event.target.value)
                }
                disabled={refLoading}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {refLoading
                    ? "Chargement..."
                    : "Sélectionnez un site"}
                </option>

                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} ({site.code})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {siteId && (
            <>
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Forfait
                  </span>

                  <select
                    value={planId}
                    onChange={(event) => {
                      setPlanId(event.target.value);
                      setVoucherId("");
                    }}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="">
                      Sélectionnez un forfait
                    </option>

                    {plansForSite.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} —{" "}
                        {plan.price.toLocaleString("fr-FR")}{" "}
                        {plan.currency}
                      </option>
                    ))}
                  </select>
                </label>

                {plansForSite.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    Aucun forfait pour ce site.{" "}
                    <button
                      type="button"
                      onClick={() => navigate("/vouchers/new")}
                      className="font-semibold underline"
                    >
                      Créer un forfait
                    </button>
                  </p>
                )}
              </div>

              {planId && (
                <div className="sm:col-span-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Voucher (facultatif)
                    </span>

                    <select
                      value={voucherId}
                      onChange={(event) =>
                        setVoucherId(event.target.value)
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    >
                      <option value="">
                        Aucun voucher précis (vente générique)
                      </option>

                      {vouchersForPlan.map((voucher) => (
                        <option
                          key={voucher.id}
                          value={voucher.id}
                        >
                          {voucher.code}
                        </option>
                      ))}
                    </select>
                  </label>

                  <p className="mt-1.5 text-xs text-slate-400">
                    {vouchersForPlan.length} voucher(s)
                    disponible(s) pour ce forfait.
                  </p>
                </div>
              )}

              <Field
                label="Nom du client (facultatif)"
                value={customerName}
                placeholder="Jean Rakoto"
                onChange={setCustomerName}
              />

              <Field
                label="Téléphone (facultatif)"
                value={customerPhone}
                placeholder="034 00 000 00"
                onChange={setCustomerPhone}
              />

              <Field
                label="Quantité"
                value={quantity}
                type="number"
                onChange={setQuantity}
              />

              {selectedPlan && (
                <div className="flex items-end">
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm">
                    <span className="text-slate-400">
                      Total :{" "}
                    </span>
                    <span className="font-bold text-slate-800">
                      {(
                        selectedPlan.price *
                        (Number(quantity) || 1)
                      ).toLocaleString("fr-FR")}{" "}
                      {selectedPlan.currency}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
          <button
            type="submit"
            disabled={saving || !siteId || !planId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && (
              <Loader2 size={16} className="animate-spin" />
            )}

            {saving ? "Enregistrement..." : "Enregistrer la vente"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}

function Field({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        min={type === "number" ? 1 : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}
