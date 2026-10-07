import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import { getSites, type Site } from "../../services/siteService";
import {
  getSiteProfilePrices,
  updateSiteProfilePrice,
  type SiteProfilePrice,
} from "../../services/sitePricingService";
import {
  getVouchers,
  type Voucher,
} from "../../services/voucherService";
import { createSale } from "../../services/saleService";

export default function RecordSale() {
  const navigate = useNavigate();

  const [sites, setSites] = useState<Site[]>([]);
  const [siteProfiles, setSiteProfiles] = useState<SiteProfilePrice[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [savingSitePrice, setSavingSitePrice] = useState(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [refLoading, setRefLoading] = useState(true);

  const [siteId, setSiteId] = useState("");
  const [profileCode, setProfileCode] = useState("");
  const [voucherId, setVoucherId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadRefs() {
      try {
        const [sitesData, vouchersData] =
          await Promise.all([
            getSites(),
            getVouchers({ status: "UNUSED" }),
          ]);

        if (mounted) {
          setSites(sitesData);
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

  useEffect(() => {
    let cancelled = false;

    async function loadSitePricing() {
      if (!siteId) {
        setSiteProfiles([]);
        setProfileCode("");
        setUnitPrice("");
        return;
      }

      setPricingLoading(true);
      setError("");

      try {
        const data = await getSiteProfilePrices(siteId);

        if (cancelled) return;

        setSiteProfiles(data);
        setProfileCode("");
        setUnitPrice("");
      } catch (err) {
        if (!cancelled) {
          setSiteProfiles([]);
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger les tarifs du site."
          );
        }
      } finally {
        if (!cancelled) {
          setPricingLoading(false);
        }
      }
    }

    void loadSitePricing();

    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const vouchersForProfile = useMemo(
    () =>
      vouchers.filter(
        (voucher) =>
          voucher.siteId === siteId &&
          (!profileCode ||
            (voucher.mikrotikProfile ?? "").trim().toLowerCase() ===
              profileCode)
      ),
    [vouchers, siteId, profileCode]
  );

  const selectedProfile =
    siteProfiles.find((profile) => profile.code === profileCode) ?? null;

  const selectedVoucher =
    vouchers.find((voucher) => voucher.id === voucherId) ?? null;

  function resetSite(nextSiteId: string) {
    setSiteId(nextSiteId);
    setProfileCode("");
    setVoucherId("");
    setUnitPrice("");
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!siteId.trim()) {
      setError("Le site est obligatoire.");
      return;
    }

    if (!profileCode.trim()) {
      setError("Le profil forfait est obligatoire.");
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

    const numericUnitPrice = Number(unitPrice);

    if (
      !Number.isFinite(numericUnitPrice) ||
      numericUnitPrice < 0
    ) {
      setError("Le prix unitaire doit être un nombre positif ou nul.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const sale = await createSale({
        siteId: siteId.trim(),
        planId: selectedVoucher?.planId ?? undefined,
        profileCode: profileCode.trim(),
        voucherId: voucherId.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        quantity: numericQuantity,
        unitPrice: numericUnitPrice,
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

      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
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
              Le prix du site sélectionné est proposé automatiquement.
              Vous pouvez l'ajuster pour cette vente.
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
                    value={profileCode}
                    disabled={pricingLoading}
                    onChange={(event) => {
                      const nextCode = event.target.value;
                      setProfileCode(nextCode);
                      setVoucherId("");

                      const nextProfile = siteProfiles.find(
                        (profile) => profile.code === nextCode
                      );

                      setUnitPrice(
                        nextProfile ? String(nextProfile.price) : ""
                      );
                    }}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
                  >
                    <option value="">
                      {pricingLoading
                        ? "Chargement des forfaits..."
                        : "Sélectionnez un forfait"}
                    </option>

                    {siteProfiles.map((profile) => (
                      <option key={profile.code} value={profile.code}>
                        {profile.name} —{" "}
                        {profile.price.toLocaleString("fr-FR")}{" "}
                        {profile.currency}
                      </option>
                    ))}
                  </select>
                </label>

                {!pricingLoading && siteProfiles.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    Aucun profil forfait n'est disponible pour ce site.
                  </p>
                )}
              </div>

              {profileCode && (
                <>
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

                        {vouchersForProfile.map((voucher) => (
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
                      {vouchersForProfile.length} voucher(s)
                      disponible(s) pour ce forfait.
                    </p>
                  </div>
                </>
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

              <div className="block">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-600">
                    Prix unitaire
                  </span>

                  {selectedProfile && (
                    <button
                      type="button"
                      disabled={savingSitePrice || Number(unitPrice) < 0}
                      onClick={async () => {
                        setSavingSitePrice(true);
                        setError("");

                        try {
                          const updated = await updateSiteProfilePrice(
                            siteId,
                            selectedProfile.code,
                            Number(unitPrice)
                          );

                          setSiteProfiles((current) =>
                            current.map((profile) =>
                              profile.code === updated.code
                                ? updated
                                : profile
                            )
                          );
                          setUnitPrice(String(updated.price));
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Impossible de mettre à jour le tarif du site."
                          );
                        } finally {
                          setSavingSitePrice(false);
                        }
                      }}
                      className="text-[11px] font-semibold text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800 disabled:opacity-50"
                    >
                      {savingSitePrice
                        ? "Enregistrement..."
                        : "Enregistrer comme tarif du site"}
                    </button>
                  )}
                </div>

                <input
                  type="number"
                  value={unitPrice}
                  min={0}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />

                {selectedProfile && (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Tarif actuel du site :{" "}
                    {selectedProfile.price.toLocaleString("fr-FR")}{" "}
                    {selectedProfile.currency}
                  </p>
                )}
              </div>

              <Field
                label="Quantité"
                value={quantity}
                type="number"
                onChange={setQuantity}
              />

              {selectedProfile && (
                <div className="flex items-end">
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm">
                    <span className="text-slate-400">
                      Total :{" "}
                    </span>
                    <span className="font-bold text-slate-800">
                      {(
                        (Number(unitPrice) || 0) *
                        (Number(quantity) || 1)
                      ).toLocaleString("fr-FR")}{" "}
                      {selectedProfile.currency}
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
            disabled={saving || !siteId || !profileCode}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && (
              <Loader2 size={16} className="animate-spin" />
            )}

            {saving ? "Enregistrement..." : "Enregistrer la vente"}
          </button>
        </div>
        </form>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Info size={20} />
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-900">
                À propos de la vente
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                Quelques règles à connaître avant d'enregistrer la vente.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <InfoItem
              title="Site cible"
              text="Le site détermine les forfaits disponibles et leur prix de référence."
            />

            <InfoItem
              title="Prix de vente"
              text="Le prix du forfait est proposé automatiquement. Vous pouvez l'ajuster uniquement pour cette vente."
            />

            <InfoItem
              title="Voucher"
              text="Vous pouvez associer un voucher précis ou enregistrer une vente générique."
            />

            <InfoItem
              title="Montant total"
              text="Le total est calculé automatiquement selon le prix unitaire et la quantité."
            />
          </div>

          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start gap-2.5">
              <CheckCircle2
                size={17}
                className="mt-0.5 shrink-0 text-emerald-600"
              />
              <p className="text-xs leading-5 text-slate-600">
                Une modification du prix ici ne change pas le prix permanent
                du forfait. Elle concerne uniquement cette vente.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

interface InfoItemProps {
  title: string;
  text: string;
}

function InfoItem({ title, text }: InfoItemProps) {
  return (
    <div className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
        {title}
      </p>
      <p className="mt-1.5 text-sm leading-5 text-slate-600">
        {text}
      </p>
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
