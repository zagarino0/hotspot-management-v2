import type React from "react";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import { createClient } from "../../services/clientService";
import { getMikrotikVouchers, type MikrotikVoucher } from "../../services/voucherService";
import { getSiteProfilePrices, type SiteProfilePrice } from "../../services/sitePricingService";
import { getSites, type Site } from "../../services/siteService";

interface ClientForm {
  siteId: string;
  username: string;
  displayName: string;
  phone: string;
  email: string;
  paymentStatus: "PAID" | "PENDING" | "UNPAID";
  paymentDate: string;
}

const INITIAL_FORM: ClientForm = {
  siteId: "",
  username: "",
  displayName: "",
  phone: "",
  email: "",
  paymentStatus: "PENDING",
  paymentDate: "",
};

export default function AddClient() {
  const navigate = useNavigate();

  const [form, setForm] = useState<ClientForm>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [vouchers, setVouchers] = useState<MikrotikVoucher[]>([]);
  const [profilePrices, setProfilePrices] = useState<SiteProfilePrice[]>([]);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const selectedVoucher = vouchers.find(v => v.siteId === form.siteId && v.code.toLowerCase() === form.username.trim().toLowerCase());
  const selectedPrice = selectedVoucher?.profile ? profilePrices.find(p => p.code.toLowerCase() === selectedVoucher.profile?.toLowerCase()) : undefined;

  useEffect(() => {
    let mounted = true;

    async function loadSites() {
      try {
        const data = await getSites();

        if (mounted) {
          setSites(data);
        }
      } catch (err) {
        console.error(
          "Erreur lors du chargement des sites :",
          err
        );
      } finally {
        if (mounted) {
          setSitesLoading(false);
        }
      }
    }

    loadSites();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!form.siteId) { setVouchers([]); setProfilePrices([]); return; }
    let mounted = true;
    setVoucherLoading(true);
    setVoucherError("");
    Promise.all([getMikrotikVouchers(), getSiteProfilePrices(form.siteId)])
      .then(([allVouchers, prices]) => { if (mounted) { setVouchers(allVouchers.filter(v => v.siteId === form.siteId)); setProfilePrices(prices); } })
      .catch((err) => { if (mounted) setVoucherError(err?.response?.data?.message ?? "Impossible de charger les vouchers et tarifs du site."); })
      .finally(() => { if (mounted) setVoucherLoading(false); });
    return () => { mounted = false; };
  }, [form.siteId]);

  function updateField(field: keyof ClientForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function validateForm(): string | null {
    if (!form.siteId.trim()) {
      return "Le site est obligatoire.";
    }

    if (!form.displayName.trim() && !form.username.trim()) {
      return "Renseignez au moins un nom ou un identifiant.";
    }

    return null;
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await createClient({
        siteId: form.siteId.trim(),
        username: form.username.trim() || undefined,
        displayName: form.displayName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        paymentStatus: form.paymentStatus,
        paymentDate: form.paymentStatus === "PAID" ? (form.paymentDate || new Date().toISOString().slice(0, 10)) : null,
      });

      navigate("/clients");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          "Impossible d'enregistrer le client."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestion des utilisateurs"
        title="Ajouter un client"
        description="Enregistrez un nouveau client rattaché à un site."
        actions={
          <button
            type="button"
            onClick={() => navigate("/clients")}
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
            <UserPlus size={20} />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Informations du client
            </h2>

            <p className="text-sm text-slate-400">
              Nom, téléphone et email sont facultatifs mais
              recommandés pour le suivi.
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
                value={form.siteId}
                onChange={(event) =>
                  updateField("siteId", event.target.value)
                }
                disabled={sitesLoading}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {sitesLoading
                    ? "Chargement des sites..."
                    : "Sélectionnez un site"}
                </option>

                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} ({site.code})
                  </option>
                ))}
              </select>
            </label>

            {!sitesLoading && sites.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-600">
                Aucun site n'existe encore.{" "}
                <button
                  type="button"
                  onClick={() => navigate("/sites/new")}
                  className="font-semibold underline"
                >
                  Créer un site
                </button>{" "}
                avant d'ajouter un client.
              </p>
            )}
          </div>

          <Field
            label="Nom affiché"
            value={form.displayName}
            placeholder="Jean Rakoto"
            onChange={(value) =>
              updateField("displayName", value)
            }
          />

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Voucher / ticket MikroTik</span>
            <input list="client-voucher-options" value={form.username} placeholder={voucherLoading ? "Chargement des vouchers..." : "Saisir ou sélectionner un voucher"} onChange={event => updateField("username", event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
            <datalist id="client-voucher-options">
              {vouchers.map(v => <option key={v.id} value={v.code}>{v.profile ?? "Profil inconnu"}</option>)}
            </datalist>
            {selectedVoucher && <p className="mt-2 text-xs text-emerald-700">Profil : <strong>{selectedVoucher.profile ?? "non renseigné"}</strong> · Forfait : <strong>{selectedPrice?.name ?? selectedVoucher.profile ?? "non identifié"}</strong> · Prix : <strong>{selectedPrice ? new Intl.NumberFormat("fr-FR").format(selectedPrice.price) + " " + selectedPrice.currency : "tarif du profil non configuré"}</strong></p>}
            {voucherError && <p className="mt-1 text-xs text-amber-600">{voucherError}</p>}
          </label>

          <Field
            label="Téléphone"
            value={form.phone}
            placeholder="034 00 000 00"
            onChange={(value) => updateField("phone", value)}
          />

          <Field
            label="Email"
            value={form.email}
            placeholder="jean@example.com"
            onChange={(value) => updateField("email", value)}
          />
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Statut de paiement</span>
            <select value={form.paymentStatus} onChange={event => updateField("paymentStatus", event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <option value="PENDING">En attente</option><option value="PAID">Payé</option><option value="UNPAID">Non payé</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Date de paiement</span>
            <input type="date" value={form.paymentDate} disabled={form.paymentStatus !== "PAID"} onChange={event => updateField("paymentDate", event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:bg-slate-50 disabled:text-slate-400" />
          </label>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && (
              <Loader2 size={16} className="animate-spin" />
            )}

            {saving ? "Enregistrement..." : "Enregistrer le client"}
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
  onChange: (value: string) => void;
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}
