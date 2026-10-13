import type React from "react";
import { useEffect, useMemo, useState } from "react";
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
import { getRouters, type Router } from "../../services/routerService";
import { getPointOfSales, type PointOfSale } from "../../services/saleService";
import {
  getPlans,
  type Plan,
} from "../../services/planService";
import {
  createHotspotProfile,
  getHotspotProfiles,
  type HotspotProfile,
} from "../../services/mikrotikService";
import {
  generateVouchers,
  type Voucher,
} from "../../services/voucherService";

export default function GenerateVouchers() {
  const navigate = useNavigate();

  const [sites, setSites] = useState<Site[]>([]);
  const [routers, setRouters] = useState<Router[]>([]);
  const [pointOfSales, setPointOfSales] = useState<PointOfSale[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [hotspotProfiles, setHotspotProfiles] = useState<HotspotProfile[]>([]);
  const [refLoading, setRefLoading] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const [siteId, setSiteId] = useState("");
  const [routerId, setRouterId] = useState("");
  const [pointOfSaleId, setPointOfSaleId] = useState("");
  const [mode, setMode] = useState<"existing" | "new">(
    "existing"
  );

  // Forfait existant : profil Hotspot réel du MikroTik lié au site
  const [mikrotikProfile, setMikrotikProfile] = useState("");
  const [planId, setPlanId] = useState("");

  // Nouveau forfait
  const [newPlanName, setNewPlanName] = useState("");
  const [newProfileDuration, setNewProfileDuration] = useState("1h");
  const [newProfileRateLimit, setNewProfileRateLimit] = useState("");
  const [newIdleTimeout, setNewIdleTimeout] = useState("none");
  const [newKeepaliveTimeout, setNewKeepaliveTimeout] = useState("2m");
  const [newSharedUsers, setNewSharedUsers] = useState("1");
  const [newMacCookieTimeout, setNewMacCookieTimeout] = useState("3d");
  const [newAddMacCookie, setNewAddMacCookie] = useState(true);
  const [newAddressPool, setNewAddressPool] = useState<"none" | "dhcp" | "vpn">("none");
  const [profileCreatedMessage, setProfileCreatedMessage] = useState("");
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
        const [sitesData, plansData, routersData, pointOfSalesData] = await Promise.all([
          getSites(),
          getPlans(),
          getRouters(),
          getPointOfSales(),
        ]);

        if (mounted) {
          setSites(sitesData);
          setPlans(plansData);
          setRouters(routersData);
          setPointOfSales(pointOfSalesData);
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

  const plansForSite = useMemo(
    () => plans.filter((plan) => plan.siteId === siteId),
    [plans, siteId]
  );

  const routersForSite = useMemo(
    () => routers.filter((router) => router.siteId === siteId && router.syncEnabled && Boolean(router.managementIp)),
    [routers, siteId]
  );

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === siteId) ?? null,
    [sites, siteId]
  );

  const activePointOfSales = useMemo(
    () =>
      pointOfSales.filter(
        (point) =>
          point.status === "ACTIVE" &&
          (!selectedSite || point.organizationId === selectedSite.organizationId)
      ),
    [pointOfSales, selectedSite]
  );

  const selectedPointOfSale = useMemo(
    () => activePointOfSales.find((point) => point.id === pointOfSaleId) ?? null,
    [activePointOfSales, pointOfSaleId]
  );

  const selectedProfile = useMemo(
    () => hotspotProfiles.find((profile) => profile.name === mikrotikProfile) ?? null,
    [hotspotProfiles, mikrotikProfile]
  );

  useEffect(() => {
    if (!siteId || !routerId) {
      setHotspotProfiles([]);
      setMikrotikProfile("");
      return;
    }

    let mounted = true;

    async function loadHotspotProfiles() {
      setProfilesLoading(true);
      setMikrotikProfile("");
      setError("");

      try {
        const profiles = await getHotspotProfiles(siteId, routerId);
        if (mounted) {
          setHotspotProfiles(profiles);
        }
      } catch (err: any) {
        if (mounted) {
          setHotspotProfiles([]);
          setError(
            err?.response?.data?.message ??
              "Impossible de récupérer les User Profiles du routeur MikroTik associé à ce site."
          );
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
  }, [siteId, routerId]);

  function resetPlanSelection(nextSiteId: string) {
    setSiteId(nextSiteId);
    setRouterId("");
    setPointOfSaleId("");
    setPlanId("");
    setMikrotikProfile("");
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
    if (!routerId.trim()) {
      setError("Le routeur MikroTik est obligatoire.");
      return;
    }
    if (mode === "existing" && !pointOfSaleId.trim()) {
      setError("Le point de vente actif est obligatoire pour générer des vouchers.");
      return;
    }

    if (mode === "existing") {
      const numericQuantity = Number(quantity);
      if (!Number.isInteger(numericQuantity) || numericQuantity < 1) {
        setError("La quantité doit être un nombre entier positif.");
        return;
      }
    }

    setSaving(true);

    try {
      if (mode === "new") {
        if (!newPlanName.trim()) {
          setError("Le nom du nouveau profil MikroTik est obligatoire.");
          return;
        }
        if (!/^\d+[wdhms](?:\s*\d+[wdhms])*$/.test(newProfileDuration.trim())) {
          setError("Saisissez une durée RouterOS valide, par exemple 1h, 12h ou 1d.");
          return;
        }
        const createdProfile = await createHotspotProfile(siteId.trim(), {
          routerId: routerId.trim(),
          name: newPlanName.trim(),
          sessionTimeout: newProfileDuration.trim(),
          idleTimeout: newIdleTimeout,
          keepaliveTimeout: newKeepaliveTimeout,
          sharedUsers: Number(newSharedUsers),
          macCookieTimeout: newMacCookieTimeout,
          addMacCookie: newAddMacCookie,
          addressPool: newAddressPool,
          rateLimit: newProfileRateLimit.trim() || undefined,
        });
        setHotspotProfiles((current) => [...current.filter((profile) => profile.name !== createdProfile.name), createdProfile]);
        setMikrotikProfile(createdProfile.name);
        setProfileCreatedMessage(`Le profil MikroTik « ${createdProfile.name} » a été créé et vérifié sur le routeur. Aucun voucher n’a été généré.`);
        return;
      }

      if (!mikrotikProfile.trim()) {
        setError("Sélectionnez un profil MikroTik existant.");
        return;
      }
      if (!selectedPointOfSale) {
        setError("Sélectionnez un point de vente actif appartenant à l’organisation du site.");
        return;
      }
      const finalPlanId = planId;

      if (!finalPlanId) {
        setError(
          mode === "existing"
            ? "Aucun forfait commercial associé à ce User Profile MikroTik. Le profil doit d'abord être associé à un forfait dans la gestion des forfaits."
            : "Le forfait est obligatoire."
        );
        setSaving(false);
        return;
      }

      const generated = await generateVouchers({
        siteId: siteId.trim(),
        planId: finalPlanId,
        routerId: routerId.trim(),
        pointOfSaleId: pointOfSaleId.trim(),
        quantity: Number(quantity),
        batchName: batchName.trim() || undefined,
        prefix: prefix.trim() || undefined,
        mikrotikProfile,
      });

      setResult(generated);
      setProfileCreatedMessage("");
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
      <div id="voucher-print-root" className="space-y-6">
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

        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Imprimer en A4
          </button>
        </div>

        <div id="voucher-print-area" className="max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 p-5 print:hidden">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-600" size={22} />

            <p className="text-sm font-semibold text-emerald-700">
              {result.quantity} voucher(s) prêt(s) à être
              distribué(s) ou imprimé(s).
            </p>
          </div>
        </div>

        <div className="max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] print:max-w-none print:overflow-visible print:border-0 print:shadow-none">
          <div className="flex items-center justify-between border-b border-slate-100 p-4 print:border-b-2 print:border-slate-900">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Codes générés</h2>
              <p className="mt-1 text-xs text-slate-500">Site : {sites.find((site) => site.id === siteId)?.name ?? siteId} · Routeur : {routers.find((router) => router.id === routerId)?.name ?? routerId} · Point de vente : {activePointOfSales.find((point) => point.id === pointOfSaleId)?.code ?? pointOfSaleId}</p>
            </div>

            <button
              type="button"
              onClick={copyAllCodes}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Copy size={14} />
              Copier tous les codes
            </button>
          </div>

          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto print:grid print:grid-cols-3 print:gap-2 print:overflow-visible">
            {result.vouchers.map((voucher) => (
              <div
                key={voucher.id}
                className="flex items-center justify-between px-5 py-3 print:break-inside-avoid print:rounded print:border print:border-slate-200 print:px-3 print:py-2"
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

      <div className="mx-auto grid w-full max-w-6xl items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
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

        {/* ROUTEUR ET POINT DE VENTE */}
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Routeur MikroTik</span>
            <select value={routerId} onChange={(event) => setRouterId(event.target.value)} disabled={!siteId || refLoading}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
              <option value="">Sélectionnez un routeur</option>
              {routersForSite.map((router) => <option key={router.id} value={router.id}>{router.name} — {router.status}</option>)}
            </select>
            {siteId && routersForSite.length === 0 && <span className="mt-1 block text-xs text-amber-600">Aucun routeur avec synchronisation active et adresse de gestion pour ce site.</span>}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Point de vente actif</span>
            <select value={pointOfSaleId} onChange={(event) => setPointOfSaleId(event.target.value)} disabled={!siteId || refLoading}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
              <option value="">Sélectionnez un point de vente</option>
              {activePointOfSales.map((point) => <option key={point.id} value={point.id}>{point.code} — {point.name}</option>)}
            </select>
            {selectedPointOfSale && (
              <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Code unique du point de vente : <span className="font-semibold text-slate-900">{selectedPointOfSale.code}</span>
              </div>
            )}
            {siteId && pointOfSales.length > 0 && activePointOfSales.length === 0 && <span className="mt-1 block text-xs text-amber-600">Aucun point de vente actif pour l’organisation de ce site.</span>}
          </label>
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
                    Forfait MikroTik
                  </span>

                  <select
                    value={mikrotikProfile}
                    onChange={(event) => {
                      const profileName = event.target.value;
                      setMikrotikProfile(profileName);

                      const matchingPlan = plansForSite.find(
                        (plan) => plan.mikrotikProfileCode === profileName || plan.name === profileName
                      );

                      setPlanId(matchingPlan?.id ?? "");
                    }}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="">
                      {profilesLoading
                        ? "Connexion au MikroTik..."
                        : "Sélectionnez un User Profile"}
                    </option>

                    {hotspotProfiles.map((profile) => (
                      <option key={profile.name} value={profile.name}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </label>

                {hotspotProfiles.length === 0 && !profilesLoading && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    Aucun User Profile n'a été récupéré depuis le MikroTik associé à ce site.
                  </p>
                )}

                {selectedProfile && (
                  <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Profil MikroTik réel : <span className="font-semibold text-slate-700">{selectedProfile.name}</span>
                    {selectedProfile["session-timeout"] && (
                      <> · Session timeout : <span className="font-semibold text-slate-700">{selectedProfile["session-timeout"]}</span></>
                    )}
                    {selectedProfile["rate-limit"] && (
                      <> · Rate limit : <span className="font-semibold text-slate-700">{selectedProfile["rate-limit"]}</span></>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <Field label="Nom du nouveau profil MikroTik" value={newPlanName} placeholder="test02" onChange={setNewPlanName} />
                <Field label="Session Timeout" value={newProfileDuration} placeholder="2d" onChange={setNewProfileDuration} />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Idle Timeout</span>
                  <select value={newIdleTimeout} onChange={e => setNewIdleTimeout(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    <option value="none">none</option><option value="5m">5 min</option><option value="10m">10 min</option><option value="30m">30 min</option><option value="1h">1 heure</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Keepalive Timeout</span>
                  <select value={newKeepaliveTimeout} onChange={e => setNewKeepaliveTimeout(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    <option value="1m">1 min</option><option value="2m">2 min</option><option value="5m">5 min</option><option value="10m">10 min</option>
                  </select>
                </label>
                <Field label="Shared Users" value={newSharedUsers} type="number" onChange={setNewSharedUsers} />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">MAC Cookie Timeout</span>
                  <select value={newMacCookieTimeout} onChange={e => setNewMacCookieTimeout(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    <option value="3d">3 jours</option><option value="1d">1 jour</option><option value="7d">7 jours</option><option value="none">Aucun (none)</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
                  <input type="checkbox" checked={newAddMacCookie} onChange={e => setNewAddMacCookie(e.target.checked)} />
                  Add MAC Cookie
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Address Pool</span>
                  <select value={newAddressPool} onChange={e => setNewAddressPool(e.target.value as "none" | "dhcp" | "vpn")} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    <option value="none">none</option><option value="dhcp">dhcp</option><option value="vpn">vpn</option>
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <Field label="Rate Limit (facultatif)" value={newProfileRateLimit} placeholder="ex. 2M/2M" onChange={setNewProfileRateLimit} />
                </div>
              </div>
              <p className="mb-5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Cette action crée uniquement le profil sur le routeur sélectionné. Elle ne crée ni forfait commercial ni voucher.</p>
              </>
            )}

            {/* GÉNÉRATION : uniquement pour un forfait existant */}
            {mode === "existing" && <div className="grid gap-4 sm:grid-cols-2">
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
            </div>}
          </>
        )}

        {profileCreatedMessage && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{profileCreatedMessage}</div>}

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
          <button
            type="submit"
            disabled={saving || !siteId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && (
              <Loader2 size={16} className="animate-spin" />
            )}

            {saving ? (mode === "new" ? "Création du profil..." : "Génération...") : (mode === "new" ? "Créer le profil MikroTik" : "Générer les vouchers")}
          </button>
        </div>
      </form>
      <aside className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg font-semibold text-slate-700">i</div>
          <h2 className="text-base font-semibold text-slate-900">Générer des vouchers correctement</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">Un voucher est un ticket d’accès Wi‑Fi généré pour un site et un profil MikroTik.</p>
          <ul className="mt-5 space-y-3 text-sm leading-5 text-slate-600">
            <li className="flex gap-2"><span className="mt-0.5 font-bold text-slate-400">•</span><span>Site et routeur : sélectionnez l’infrastructure sur laquelle les tickets seront créés.</span></li>
            <li className="flex gap-2"><span className="mt-0.5 font-bold text-slate-400">•</span><span>Profil/forfait : choisissez un profil existant réellement disponible sur le MikroTik.</span></li>
            <li className="flex gap-2"><span className="mt-0.5 font-bold text-slate-400">•</span><span>Quantité : vérifiez le nombre de tickets à générer avant de lancer l’opération.</span></li>
            <li className="flex gap-2"><span className="mt-0.5 font-bold text-slate-400">•</span><span>Préfixe/commentaire : utilisez-les pour identifier un lot ou une campagne, si ces champs sont proposés.</span></li>
            <li className="flex gap-2"><span className="mt-0.5 font-bold text-slate-400">•</span><span>Durée et quota : ils doivent correspondre aux règles du profil sélectionné.</span></li>
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-base font-semibold text-slate-900">Conditions avant validation</h2>
          <ul className="mt-4 space-y-3 text-sm leading-5 text-slate-600">
            <li className="flex gap-2"><span className="font-bold text-emerald-600">✓</span><span>Sélectionnez le site et le routeur cible avant de générer.</span></li>
            <li className="flex gap-2"><span className="font-bold text-emerald-600">✓</span><span>Le profil doit exister sur le MikroTik sélectionné ; ne supposez pas qu’un profil similaire existe ailleurs.</span></li>
            <li className="flex gap-2"><span className="font-bold text-emerald-600">✓</span><span>Vérifiez la quantité et les paramètres du lot avant validation : la génération crée de vrais tickets.</span></li>
            <li className="flex gap-2"><span className="font-bold text-emerald-600">✓</span><span>Le prix commercial doit être configuré pour le profil et le site dans les tarifs applicables ; le prix ne se déduit pas uniquement du nom du voucher.</span></li>
          </ul>
        </section>
      </aside>
      </div>
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
