import type React from "react";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Loader2,
  Ticket,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import { getSites, type Site } from "../../services/siteService";
import { createPlan } from "../../services/planService";
import {
  generateVouchers,
  type Voucher,
} from "../../services/voucherService";
import {
  getHotspotProfiles,
  type HotspotProfile,
} from "../../services/mikrotikService";

/* ============================================================
   DURÉES PRÉDÉFINIES (en secondes)
============================================================ */

const DURATION_PRESETS = [
  { label: "1 heure", seconds: 3600 },
  { label: "3 heures", seconds: 10800 },
  { label: "24 heures", seconds: 86400 },
  { label: "7 jours", seconds: 604800 },
  { label: "30 jours", seconds: 2592000 },
];

export default function GenerateVouchers() {
  const navigate = useNavigate();

  const [sites, setSites] = useState<Site[]>([]);
  const [hotspotProfiles, setHotspotProfiles] = useState<HotspotProfile[]>([]);
  const [refLoading, setRefLoading] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const [siteId, setSiteId] = useState("");
  const [mode, setMode] = useState<"existing" | "new">(
    "existing"
  );

  // Forfait existant (maintenant basé sur les profils MikroTik)
  const [selectedProfile, setSelectedProfile] = useState("");

  // Nouveau forfait
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState("");
  const [newPlanDuration, setNewPlanDuration] = useState(
    String(DURATION_PRESETS[0].seconds)
  );

  // Génération
  const [quantity, setQuantity] = useState("10");
  const [prefix, setPrefix] = useState("");
  const [batchName, setBatchName] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    quantity: number;
    vouchers: Voucher[];
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadRefs() {
      try {
        const sitesData = await getSites();

        if (mounted) {
          setSites(sitesData);
        }
      } catch (err) {
        console.error(
          "Erreur lors du chargement des sites/forfaits :",
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

  // Charger les profils MikroTik quand le site change
  useEffect(() => {
    let mounted = true;

    async function loadHotspotProfiles() {
      if (!siteId) {
        setHotspotProfiles([]);
        return;
      }

      setProfilesLoading(true);
      try {
        const profiles = await getHotspotProfiles(siteId);
        if (mounted) {
          setHotspotProfiles(profiles);
        }
      } catch (err) {
        console.error(
          "Erreur lors du chargement des profils MikroTik :",
          err
        );
        if (mounted) {
          setHotspotProfiles([]);
        }
      } finally {
        if (mounted) {
          setProfilesLoading(false);
        }
      }
    }

    loadHotspotProfiles();

    return () => {
      mounted = false;
    };
  }, [siteId]);

  function resetPlanSelection(nextSiteId: string) {
    setSiteId(nextSiteId);
    setSelectedProfile("");
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (!siteId.trim()) {
      setError("Le site est obligatoire.");
      return;
    }

    const numericQuantity = Number(quantity);

    if (
      !Number.isInteger(numericQuantity) ||
      numericQuantity < 1
    ) {
      setError(
        "La quantité doit être un nombre entier positif."
      );
      return;
    }

    setSaving(true);

    try {
      let finalPlanId: string | undefined;
      let finalMikrotikProfile: string | undefined;

      if (mode === "existing") {
        // Mode "Forfait existant" : utiliser directement le profil MikroTik sélectionné
        if (!selectedProfile) {
          setError("Le profil MikroTik est obligatoire.");
          setSaving(false);
          return;
        }

        finalMikrotikProfile = selectedProfile;
        finalPlanId = undefined; // Pas de plan local
      } else if (mode === "new") {
        if (!newPlanName.trim()) {
          setError("Le nom du forfait est obligatoire.");
          setSaving(false);
          return;
        }

        const price = Number(newPlanPrice);

        if (!Number.isFinite(price) || price < 0) {
          setError(
            "Le prix du forfait doit être un nombre positif."
          );
          setSaving(false);
          return;
        }

        const createdPlan = await createPlan({
          siteId: siteId.trim(),
          name: newPlanName.trim(),
          code: newPlanName
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "-")
            .slice(0, 40),
          price,
          durationSeconds: Number(newPlanDuration),
        });

        finalPlanId = createdPlan.id;
      }

      if (!finalPlanId && !finalMikrotikProfile) {
        setError("Le forfait ou le profil MikroTik est obligatoire.");
        setSaving(false);
        return;
      }

      const generated = await generateVouchers({
        siteId: siteId.trim(),
        planId: finalPlanId,
        mikrotikProfile: finalMikrotikProfile,
        quantity: numericQuantity,
        batchName: batchName.trim() || undefined,
        prefix: prefix.trim() || undefined,
      });

      setResult(generated);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          "Impossible de générer les vouchers."
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyAllCodes() {
    if (!result) return;

    const codes = result.vouchers
      .map((v) => v.code)
      .join("\n");

    try {
      await navigator.clipboard.writeText(codes);
    } catch {
      // Presse-papier indisponible : pas bloquant.
    }
  }

  /* ============================================================
     ÉCRAN DE RÉSULTAT
  ============================================================ */

  if (result) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Gestion hotspot"
          title="Vouchers générés"
          description={`${result.quantity} voucher(s) créé(s) avec succès.`}
          actions={
            <button
              type="button"
              onClick={() => navigate("/vouchers")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
              Retour aux vouchers
            </button>
          }
        />

        <div className="max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-600" size={22} />

            <p className="text-sm font-semibold text-emerald-700">
              {result.quantity} voucher(s) prêt(s) à être
              distribué(s) ou imprimé(s).
            </p>
          </div>
        </div>

        <div className="max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Codes générés
            </h2>

            <button
              type="button"
              onClick={copyAllCodes}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Copy size={14} />
              Copier tous les codes
            </button>
          </div>

          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {result.vouchers.map((voucher) => (
              <div
                key={voucher.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <span className="font-mono text-sm font-semibold text-slate-800">
                  {voucher.code}
                </span>

                <span className="text-xs text-slate-400">
                  {voucher.planName}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setResult(null);
            setQuantity("10");
            setBatchName("");
          }}
          className="text-sm font-semibold text-slate-600 underline hover:text-slate-900"
        >
          Générer un autre lot
        </button>
      </div>
    );
  }

  /* ============================================================
     FORMULAIRE
  ============================================================ */

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestion hotspot"
        title="Générer des vouchers"
        description="Créez un lot de tickets d'accès WiFi pour un site et un forfait."
        actions={
          <button
            type="button"
            onClick={() => navigate("/vouchers")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
        }
      />

      <form
        onSubmit={handleSubmit}
        className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Ticket size={20} />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Paramètres du lot
            </h2>

            <p className="text-sm text-slate-400">
              Chaque voucher hérite de la durée/quota du forfait au
              moment de la génération.
            </p>
          </div>
        </div>

        {/* SITE */}
        <div className="mb-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Site
            </span>

            <select
              value={siteId}
              onChange={(event) =>
                resetPlanSelection(event.target.value)
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

          {!refLoading && sites.length === 0 && (
            <p className="mt-1.5 text-xs text-amber-600">
              Aucun site n'existe encore.{" "}
              <button
                type="button"
                onClick={() => navigate("/sites/new")}
                className="font-semibold underline"
              >
                Créer un site
              </button>
            </p>
          )}
        </div>

        {/* MODE FORFAIT */}
        {siteId && (
          <>
            <div className="mb-4 flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={[
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  mode === "existing"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                Forfait existant
              </button>

              <button
                type="button"
                onClick={() => setMode("new")}
                className={[
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  mode === "new"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                Nouveau forfait
              </button>
            </div>

            {mode === "existing" ? (
              <div className="mb-5">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Profil MikroTik
                  </span>
                </label>

                {profilesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-slate-400" size={24} />
                    <span className="ml-2 text-sm text-slate-500">Chargement des profils...</span>
                  </div>
                ) : hotspotProfiles.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-600">
                    Aucun profil MikroTik disponible pour ce site. Vérifiez la connexion au routeur.
                  </div>
                ) : (
                  <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">Nom</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">Session Timeout</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">Idle Timeout</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">Rate Limit</th>
                          <th className="px-4 py-2 text-center font-semibold text-slate-700">Sélection</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {hotspotProfiles.map((profile) => (
                          <tr
                            key={profile.name}
                            className={`cursor-pointer transition-colors ${
                              selectedProfile === profile.name
                                ? "bg-blue-50"
                                : "hover:bg-slate-50"
                            }`}
                            onClick={() => setSelectedProfile(profile.name)}
                          >
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {profile.name}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {profile["session-timeout"] || "none"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {profile["idle-timeout"] || "none"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {profile["rate-limit"] || "none"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div
                                className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                                  selectedProfile === profile.name
                                    ? "border-blue-500 bg-blue-500"
                                    : "border-slate-300"
                                }`}
                              >
                                {selectedProfile === profile.name && (
                                  <CheckCircle2 size={12} className="text-white" />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-5 grid gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:grid-cols-2">
                <Field
                  label="Nom du forfait"
                  value={newPlanName}
                  placeholder="Forfait 1 jour"
                  onChange={setNewPlanName}
                />

                <Field
                  label="Prix"
                  value={newPlanPrice}
                  placeholder="1000"
                  type="number"
                  onChange={setNewPlanPrice}
                />

                <div className="sm:col-span-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Durée
                    </span>

                    <select
                      value={newPlanDuration}
                      onChange={(event) =>
                        setNewPlanDuration(event.target.value)
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    >
                      {DURATION_PRESETS.map((preset) => (
                        <option
                          key={preset.seconds}
                          value={preset.seconds}
                        >
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}

            {/* GÉNÉRATION */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Quantité"
                value={quantity}
                type="number"
                onChange={setQuantity}
              />

              <Field
                label="Préfixe (facultatif)"
                value={prefix}
                placeholder="WMK"
                onChange={(v) => setPrefix(v.toUpperCase())}
              />

              <div className="sm:col-span-2">
                <Field
                  label="Nom du lot (facultatif)"
                  value={batchName}
                  placeholder="Lot rentrée scolaire"
                  onChange={setBatchName}
                />
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
          <button
            type="submit"
            disabled={saving || !siteId || (mode === "existing" && !selectedProfile)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && (
              <Loader2 size={16} className="animate-spin" />
            )}

            {saving ? "Génération..." : "Générer les vouchers"}
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
