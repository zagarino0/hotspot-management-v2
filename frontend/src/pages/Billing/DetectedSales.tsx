import { useEffect, useMemo, useState } from "react";

import { CalendarClock, CheckCircle2, CircleAlert, LockKeyhole, Pencil, Plus, MoreHorizontal, RefreshCw, Save, Trash2, Wallet, X } from "lucide-react";

import {

  activatePointOfSale,

  createPointOfSale,

  deactivatePointOfSale,

  getPointOfSales,

  updatePointOfSale,

  deletePointOfSale,

  type PointOfSale,

} from "../../services/saleService";

import {

  createPosRemittance,

  getPosDailyClosures,

  getPosRemittances,

  getPosTicketEvents,

  type PosDailyClosure,

  type PosRemittance,

  type PosTicketEvent,

} from "../../services/posSalesService";

function money(value: number | string | null | undefined) {

  return `${Number(value ?? 0).toLocaleString("fr-FR")} MGA`;

}

function dateLabel(value: string | null | undefined) {

  if (!value) return "—";

  return new Date(value).toLocaleString("fr-FR", {

    day: "2-digit", month: "2-digit", year: "numeric",

    hour: "2-digit", minute: "2-digit",

  });

}

/**
 * Retourne la journée commerciale dans le fuseau horaire de Madagascar.
 * PostgreSQL sérialise business_date en UTC : minuit à Madagascar apparaît
 * à 21 h UTC la veille. Le résultat ne dépend pas du fuseau du navigateur.
 */
function businessDateKey(value: string | null | undefined) {

  if (!value) return "";

  // Une valeur PostgreSQL DATE peut arriver sous forme de timestamp UTC.

  // Pour Madagascar (UTC+3), minuit local est sérialisé à 21 h UTC la veille.

  // On ajoute donc explicitement 3 h, sans dépendre du fuseau du navigateur

  // ni de la prise en charge d'Intl.DateTimeFormat par la cible TypeScript.

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  if (value.includes("T")) {

    date.setUTCHours(date.getUTCHours() + 3);

    const month = date.getUTCMonth() + 1;

    const day = date.getUTCDate();

    return `${date.getUTCFullYear()}-${month < 10 ? "0" : ""}${month}-${day < 10 ? "0" : ""}${day}`;

  }

  // Les valeurs déjà au format YYYY-MM-DD sont des dates sans fuseau.

  return value.slice(0, 10);

}

export default function Sales() {

  const [points, setPoints] = useState<PointOfSale[]>([]);

  const [selectedId, setSelectedId] = useState("");

  const [events, setEvents] = useState<PosTicketEvent[]>([]);

  const [closures, setClosures] = useState<PosDailyClosure[]>([]);

  const [remittances, setRemittances] = useState<PosRemittance[]>([]);

  const [businessDate, setBusinessDate] = useState("");

  const [amount, setAmount] = useState("");

  const [note, setNote] = useState("");

  const [newCode, setNewCode] = useState("");

  const [newName, setNewName] = useState("");

  const [editingPoint, setEditingPoint] = useState(false);

  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  const [editCode, setEditCode] = useState("");

  const [editName, setEditName] = useState("");

  const [editOpeningTime, setEditOpeningTime] = useState("08:00");

  const [editClosingTime, setEditClosingTime] = useState("20:00");

  const [busy, setBusy] = useState(false);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const selectedPos = points.find((point) => point.id === selectedId);

  const soldEvents = useMemo(

    () => events.filter((event) => event.event_type === "SOLD"),

    [events],

  );

  const selectedClosure = closures.find((closure) => businessDateKey(closure.business_date) === businessDate);

  const selectedRemittance = remittances.find((item) => businessDateKey(item.business_date) === businessDate);

  async function loadPoints() {

    const result = await getPointOfSales();

    setPoints(result);
    setSelectedId((current) => {
      if (current && result.some((point) => point.id === current)) return current;

      const preferredPoint =
        result.find((point) => point.type === "EXTERNAL" && point.status === "ACTIVE") ??
        result.find((point) => point.status === "ACTIVE") ??
        result[0];

      return preferredPoint?.id ?? "";
    });
  }

  async function loadPosData(id: string) {
    if (!id) {
      setEvents([]);
      setClosures([]);
      setRemittances([]);
      setBusinessDate("");
      return;
    }

    // Les événements sont consultables pour les points internes et externes.
    const eventRows = await getPosTicketEvents(id);
    setEvents(eventRows);    // Clôtures et versements suivent les mêmes règles pour INTERNAL et EXTERNAL.

const [closureRows, remittanceRows] = await Promise.all([
      getPosDailyClosures(id),
      getPosRemittances(id),
    ]);
setClosures(
          [...closureRows].sort((a, b) =>
            businessDateKey(b.business_date).localeCompare(businessDateKey(a.business_date))
          )
        );
        setRemittances(
          [...remittanceRows].sort((a, b) =>
            businessDateKey(b.business_date).localeCompare(businessDateKey(a.business_date))
          )
        );
        setBusinessDate((current) =>
          closureRows.some((c) => businessDateKey(c.business_date) === current)
            ? current
            : businessDateKey(closureRows[0]?.business_date) || ""
        );
  }

  useEffect(() => {

    let active = true;

    setLoading(true);

    loadPoints()

      .catch(() => { if (active) setError("Impossible de charger les points de vente."); })

      .then(() => { if (active) setLoading(false); }, () => { if (active) setLoading(false); });

    return () => { active = false; };

  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    if (!selectedId) {
      setEvents([]);
      setClosures([]);
      setRemittances([]);
      setBusinessDate("");
      setLoading(false);
      return () => { active = false; };
    }

    const dataPromise = (async () => {
      const eventRows = await getPosTicketEvents(selectedId);const [closureRows, remittanceRows] = await Promise.all([
        getPosDailyClosures(selectedId),
        getPosRemittances(selectedId),
      ]);
      return [eventRows, closureRows, remittanceRows] as const;
    })();

    dataPromise
      .then(([eventRows, closureRows, remittanceRows]) => {
        if (!active) return;
        setEvents(eventRows);
        setClosures(
          [...closureRows].sort((a, b) =>
            businessDateKey(b.business_date).localeCompare(businessDateKey(a.business_date))
          )
        );
        setRemittances(
          [...remittanceRows].sort((a, b) =>
            businessDateKey(b.business_date).localeCompare(businessDateKey(a.business_date))
          )
        );
        setBusinessDate((current) =>
          closureRows.some((c) => businessDateKey(c.business_date) === current)
            ? current
            : businessDateKey(closureRows[0]?.business_date) || ""
        );
      })
      .catch((e: any) => {
        if (!active) return;
        setError(
          e?.response?.status === 403
            ? "Accès refusé : seul l’administrateur peut consulter ces historiques."
            : e?.response?.status === 401
              ? "Session expirée. Reconnectez-vous pour continuer."
              : "Impossible de charger les ventes détectées, les clôtures ou les versements."
        );
      })
      .then(
        () => { if (active) setLoading(false); },
        () => { if (active) setLoading(false); }
      );

    return () => { active = false; };
  }, [selectedId, points]);

  async function refresh() {

    if (!selectedId) return;

    setBusy(true);

    setError("");

    try {

      await loadPosData(selectedId);

    } catch {

      setError("Actualisation impossible. Réessayez.");

    } finally {

      setBusy(false);

    }

  }

  async function handleCreatePoint() {

    if (!newCode.trim() || !newName.trim()) {

      setError("Le code et le nom du point de vente sont obligatoires.");

      return;

    }

    setBusy(true);

    setError("");

    try {

      await createPointOfSale({ code: newCode.trim(), name: newName.trim(), type: "EXTERNAL" });

      setNewCode("");

      setNewName("");

      const result = await getPointOfSales();

      setPoints(result);

      const created = result.find((point) => point.code.toLowerCase() === newCode.trim().toLowerCase());

      if (created) setSelectedId(created.id);

    } catch (e: any) {

      setError(e?.response?.data?.message ?? "Création du point de vente impossible.");

    } finally {

      setBusy(false);

    }

  }

  function beginEditPoint(point: PointOfSale) {

    setEditCode(point.code);

    setEditName(point.name);

    setEditOpeningTime(point.openingTime || "08:00");

    setEditClosingTime(point.closingTime || "20:00");

    setActionsMenuOpen(false);

    setEditingPoint(true);

    setError("");

  }

  async function handleUpdatePoint() {

    if (!selectedPos || !editCode.trim() || !editName.trim()) {

      setError("Le code et le nom du point de vente sont obligatoires.");

      return;

    }

    setBusy(true);

    setError("");

    try {

      const updated = await updatePointOfSale(selectedPos.id, {

        code: editCode.trim(), name: editName.trim(),

        openingTime: editOpeningTime, closingTime: editClosingTime,

      });

      setPoints((current) => current.map((point) => point.id === updated.id ? updated : point));

      setEditingPoint(false);

    } catch (e: any) {

      setError(e?.response?.data?.message ?? "Modification du point de vente impossible.");

    } finally {

      setBusy(false);

    }

  }

  async function handleDeletePoint(point: PointOfSale) {

    if (!window.confirm(`Supprimer définitivement « ${point.name} » ? Cette action est possible uniquement si aucun voucher ni historique commercial n'y est associé. Sinon, désactivez le point de vente.`)) return;

    setBusy(true);

    setError("");

    try {

      await deletePointOfSale(point.id);

      const remaining = await getPointOfSales();

      setPoints(remaining);

      setSelectedId(remaining[0]?.id ?? "");

      setEditingPoint(false);

      setBusinessDate("");

      setAmount("");

    } catch (e: any) {

      setError(e?.response?.data?.message ?? "Suppression du point de vente impossible.");

    } finally {

      setBusy(false);

    }

  }

  async function handleToggle(point: PointOfSale) {

    const action = point.status === "ACTIVE" ? "désactiver" : "réactiver";

    if (!window.confirm(`Voulez-vous ${action} « ${point.name} » sur les routeurs MikroTik ?`)) return;

    setBusy(true);

    setError("");

    try {

      if (point.status === "ACTIVE") await deactivatePointOfSale(point.id);

      else await activatePointOfSale(point.id);

      setPoints(await getPointOfSales());

    } catch (e: any) {

      setError(e?.response?.data?.message ?? `Impossible de ${action} ce point de vente.`);

    } finally {

      setBusy(false);

    }

  }

  async function handleRemittance() {

    if (busy) return;if (!selectedId || !businessDate || !selectedClosure) {

      setError("Sélectionnez une clôture existante avant de confirmer le versement.");

      return;

    }

    if (remittances.some((item) => businessDateKey(item.business_date) === businessDate)) {

      setError("Un versement existe déjà pour cette journée. Consultez l’historique ; aucun nouveau versement n’a été créé.");

      return;

    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {

      setError("Le montant réellement remis doit être positif ou nul.");

      return;

    }

    setBusy(true);

    setError("");

    try {

      await createPosRemittance(selectedId, {

        businessDate,

        remittedAmount: parsedAmount,

        note: note.trim() || undefined,

      });

      setAmount("");

      setNote("");

      setRemittances(await getPosRemittances(selectedId));

    } catch (e: any) {

      if (e?.response?.status === 409) {

        try {

          setRemittances(await getPosRemittances(selectedId));

        } catch {

          // Conserver les données affichées si l’actualisation échoue.

        }

        setError(e?.response?.data?.message ?? "Un versement existe déjà pour cette journée. Consultez l’historique.");

      } else {

        setError(e?.response?.data?.message ?? "Impossible d'enregistrer le versement.");

      }

    } finally {

      setBusy(false);

    }

  }

  return (

    <div className="space-y-6">

      <div className="flex items-start gap-3 rounded-xl border-0 bg-transparent p-4 font-bold text-slate-800 dark:text-slate-100">

        <LockKeyhole size={19} className="mt-0.5 shrink-0" />

        <div>

          <p className="text-sm font-semibold">Historique réservé à l’administrateur</p>

          <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">Les ventes détectées, clôtures et versements de tous les points de vente sont consultables uniquement par un compte administrateur autorisé. Les responsables n’ont pas encore d’accès.</p>

        </div>

      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Gestion commerciale</p>

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Ventes détectées</h1>

          <p className="mt-1 max-w-2xl text-sm font-medium text-slate-600">

            Les ventes sont détectées automatiquement à la première connexion réussie du voucher. Aucun enregistrement manuel par ticket.

          </p>

        </div>

        <button type="button" onClick={refresh} disabled={busy || !selectedId} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">

          <RefreshCw size={16} className={busy ? "animate-spin" : ""} /> Actualiser

        </button>

      </header>

      {error && <div role="alert" className="rounded-xl border-0 bg-transparent px-4 py-3 text-sm font-bold text-red-700 dark:text-red-300">{error}</div>}

      {selectedPos?.type === "INTERNAL" && (

        <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">

          « {selectedPos.name} » est un point de vente interne. Les ventes, clôtures et versements suivent les mêmes règles que pour les points externes.

        </div>

      )}

      <section className="rounded-2xl border-0 bg-white p-5">

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">

          <label className="block text-sm font-semibold text-slate-800">

            Point de vente

            <select value={selectedId} onChange={(e) => { setBusinessDate(""); setAmount(""); setSelectedId(e.target.value); }} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">

              <option value="">Sélectionner un point de vente</option>

              {points.map((point) => (

                <option key={point.id} value={point.id}>

                  {point.name} ({point.code}){point.status === "INACTIVE" ? " — Inactif" : ""}

                  {point.type === "INTERNAL" ? " — Interne" : ""}

                </option>

              ))}

            </select>

          </label>

          <label className="block text-sm font-semibold text-slate-800">

            Code du point de vente

            <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Ex. CASHPOINTWIFI" className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />

          </label>

          <label className="block text-sm font-semibold text-slate-800">

            Nom du point de vente

            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom commercial" className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />

          </label>

          <button type="button" onClick={handleCreatePoint} disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-50"><Plus size={15} /> Ajouter</button>

        </div>

        {selectedPos && <div className="mt-4 rounded-xl bg-slate-50 p-3">

          {editingPoint ? (

            <div className="grid gap-3 sm:grid-cols-2">

              <label className="block text-sm font-semibold text-slate-800">Code

                <input value={editCode} onChange={(e) => setEditCode(e.target.value)} disabled={selectedPos.type === "INTERNAL"} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100" />

              </label>

              <label className="block text-sm font-semibold text-slate-800">Nom

                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" />

              </label>

              <label className="block text-sm font-semibold text-slate-800">Heure d'ouverture de la caisse

                <input type="time" required value={editOpeningTime} onChange={(e) => setEditOpeningTime(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" />

              </label>

              <label className="block text-sm font-semibold text-slate-800">Heure de fermeture de la caisse

                <input type="time" required value={editClosingTime} onChange={(e) => setEditClosingTime(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" />

              </label>

              <p className="text-xs font-medium text-slate-600 sm:col-span-2">Ces horaires sont enregistrés pour ce point de vente. La fermeture reste indépendante des autres points de vente.</p>

              <div className="flex flex-wrap gap-2 sm:col-span-2">

                <button type="button" onClick={handleUpdatePoint} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={15} /> Enregistrer</button>

                <button type="button" onClick={() => setEditingPoint(false)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"><X size={15} /> Annuler</button>

              </div>

            </div>

          ):(

            <div className="flex flex-wrap items-center justify-between gap-3">

              <div><p className="font-semibold text-slate-800">{selectedPos.name}</p><p className="text-xs font-medium text-slate-600">{selectedPos.code} · {selectedPos.status === "ACTIVE" ? "Actif" : "Inactif"}</p><p className="mt-1 text-xs font-medium text-slate-600">Caisse : {selectedPos.openingTime || "08:00"} – {selectedPos.closingTime || "20:00"}</p></div>

              <div className="relative">

                <button

                  type="button"

                  aria-label="Actions du point de vente"

                  aria-haspopup="menu"

                  aria-expanded={actionsMenuOpen}

                  onClick={() => setActionsMenuOpen((open) => !open)}

                  disabled={busy}

                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"

                ><MoreHorizontal size={19} /></button>

                {actionsMenuOpen && (

                  <div role="menu" className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">

                    <button role="menuitem" type="button" onClick={() => beginEditPoint(selectedPos)} disabled={busy} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Pencil size={15} /> Modifier</button>

                    <button role="menuitem" type="button" onClick={() => { setActionsMenuOpen(false); void handleToggle(selectedPos); }} disabled={busy} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">{selectedPos.status === "ACTIVE" ? "Désactiver" : "Réactiver"}</button>

                    {selectedPos.type === "EXTERNAL" && <button role="menuitem" type="button" onClick={() => { setActionsMenuOpen(false); void handleDeletePoint(selectedPos); }} disabled={busy} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} /> Supprimer</button>}

                  </div>

                )}

              </div>

            </div>

          )}

        </div>}

      </section>

      <section className="grid gap-4 sm:grid-cols-3">

        <div className="rounded-2xl border-0 bg-white p-5"><p className="text-sm font-medium text-slate-600">Tickets vendus détectés</p><p className="mt-2 text-2xl font-extrabold text-slate-950">{soldEvents.length}</p></div>

        <div className="rounded-2xl border-0 bg-white p-5"><p className="text-sm font-medium text-slate-600">Montant brut détecté</p><p className="mt-2 text-2xl font-extrabold text-slate-950">{money(soldEvents.reduce((sum, event) => sum + Number(event.unit_price), 0))}</p></div>

        <div className="rounded-2xl border-0 bg-white p-5"><p className="text-sm font-medium text-slate-600">Clôtures disponibles</p><p className="mt-2 text-2xl font-extrabold text-slate-950">{closures.length}</p></div>

      </section>

      <section className="overflow-hidden rounded-2xl border-0 bg-white">

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">

          <div><h2 className="font-bold font-semibold text-slate-950">Tickets vendus détectés</h2><p className="mt-1 text-sm font-medium text-slate-600">Une ligne par voucher, lors de sa première session enregistrée.</p></div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{soldEvents.length} ticket(s)</span>

        </div>

        {loading ? <p className="p-5 text-sm font-medium text-slate-600">Chargement…</p> : soldEvents.length === 0 ? <p className="p-5 text-sm font-medium text-slate-600">Aucune vente détectée pour ce point de vente.</p> :

          <div className="max-h-[420px] overflow-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Voucher</th><th className="px-4 py-3">Montant attendu</th><th className="px-4 py-3">Date de détection</th><th className="px-4 py-3">Source</th></tr></thead><tbody>{soldEvents.map((event) => <tr key={event.id} className="border-t border-slate-100"><td className="px-4 py-3 font-mono font-semibold text-slate-800">{event.voucher_code}</td><td className="px-4 py-3">{money(event.unit_price)}</td><td className="px-4 py-3 text-slate-600">{dateLabel(event.occurred_at)}</td><td className="px-4 py-3 text-slate-600">{event.metadata?.detection === "FIRST_SUCCESSFUL_SESSION" ? "Première connexion" : "Événement enregistré"}</td></tr>)}</tbody></table></div>

        }

      </section>

      <section className="overflow-hidden rounded-2xl border-0 bg-white">

        <div className="flex items-center gap-2 border-b border-slate-100 p-4"><CalendarClock size={18} /><div><h2 className="font-bold font-semibold text-slate-950">Clôtures quotidiennes</h2><p className="text-sm font-medium text-slate-600">La clôture automatique est prévue à 20 h, heure de Madagascar.</p></div></div>

        {closures.length === 0 ? <p className="p-5 text-sm font-medium text-slate-600">Aucune clôture disponible pour ce point de vente.</p> :

          <div className="max-h-[50vh] overflow-auto overscroll-contain"><table className="w-full min-w-[800px] text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Journée</th><th className="px-4 py-3">Tickets</th><th className="px-4 py-3">Montant brut</th><th className="px-4 py-3">Remboursements</th><th className="px-4 py-3">Montant attendu</th><th className="px-4 py-3">Versement</th><th className="px-4 py-3">Versement réel</th></tr></thead><tbody>{closures.map((closure) => <tr key={closure.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{businessDateKey(closure.business_date)}</td><td className="px-4 py-3">{closure.tickets_sold}</td><td className="px-4 py-3">{money(closure.gross_revenue)}</td><td className="px-4 py-3">{money(closure.refunds)}</td><td className="px-4 py-3 font-bold">{money(closure.net_revenue)}</td><td className="px-4 py-3">{(() => {

              const remittance = remittances.find((item) => businessDateKey(item.business_date) === businessDateKey(closure.business_date));

              return remittance

                ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> Versement reçu</span>

                : <span className="inline-flex items-center gap-1 text-amber-700"><CircleAlert size={14} /> En attente</span>;

            })()}</td><td className="px-4 py-3 font-semibold">{(() => {

              const remittance = remittances.find((item) => businessDateKey(item.business_date) === businessDateKey(closure.business_date));

              return remittance ? money(remittance.remitted_amount) : "—";

            })()}</td></tr>)}</tbody></table></div>

        }

      </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">

          <div className="rounded-2xl border-0 bg-white p-5">

            <div className="mb-4 flex items-center gap-2"><Wallet size={18} /><h2 className="font-bold font-semibold text-slate-950">Confirmer un versement</h2></div>

            <p className="mb-4 text-sm font-medium text-slate-600">La personne responsable saisit le montant réellement remis. La vente elle-même n'est pas saisie manuellement.</p>

            <label className="mb-3 block text-sm font-semibold text-slate-800">Journée clôturée

              <select value={businessDate} onChange={(e) => { setBusinessDate(e.target.value); setAmount(""); }} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3">

                {closures.filter((closure) => closure.status === "CLOSED").map((closure) => <option key={closure.id} value={businessDateKey(closure.business_date)}>{businessDateKey(closure.business_date)} — attendu {money(closure.net_revenue)}</option>)}

              </select>

            </label>

            <div className="mb-3 rounded-xl bg-slate-50 p-3"><p className="text-xs font-medium text-slate-600">Montant attendu</p><p className="text-lg font-extrabold font-semibold text-slate-950">{selectedClosure ? money(selectedClosure.net_revenue) : "Aucune clôture sélectionnée"}</p></div>

            <label className="mb-3 block text-sm font-semibold text-slate-800">Montant réellement remis (MGA)

              <input type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3" placeholder="Saisir le montant reçu" />

            </label>

            <label className="mb-4 block text-sm font-semibold text-slate-800">Note (facultatif)

              <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3" placeholder="Commentaire sur le versement" />

            </label>

            {selectedRemittance && <div role="status" className="mb-3 rounded-xl border-0 bg-transparent p-3 text-sm font-bold text-emerald-700 dark:text-emerald-300">Versement déjà enregistré pour cette journée : {money(selectedRemittance.remitted_amount)} reçu, écart de {money(selectedRemittance.difference)}. Aucun nouveau versement ne peut être créé.</div>}

            <button type="button" onClick={handleRemittance} disabled={busy || !selectedClosure || !businessDate || amount === "" || Boolean(selectedRemittance)} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Enregistrement…" : selectedRemittance ? "Versement déjà enregistré" : "Confirmer la réception"}</button>

            <p className="mt-3 text-xs font-medium text-slate-600">Le système conserve l'écart entre le montant attendu et le montant reçu. Un versement unique est autorisé par point de vente et par journée.</p>

          </div>

          <div className="overflow-hidden rounded-2xl border-0 bg-white">

            <div className="border-b border-slate-100 p-4"><h2 className="font-bold font-semibold text-slate-950">Historique des versements</h2><p className="mt-1 text-sm font-medium text-slate-600">Montants reçus et écarts conservés par journée.</p></div>

            {remittances.length === 0 ? <p className="p-5 text-sm font-medium text-slate-600">Aucun versement enregistré.</p> :

              <div className="max-h-[50vh] overflow-auto overscroll-contain"><table className="w-full min-w-[560px] text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Journée</th><th className="px-4 py-3">Attendu</th><th className="px-4 py-3">Reçu</th><th className="px-4 py-3">Écart</th><th className="px-4 py-3">Date de réception</th></tr></thead><tbody>{remittances.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-3">{businessDateKey(item.business_date)}</td><td className="px-4 py-3">{money(item.expected_amount)}</td><td className="px-4 py-3">{money(item.remitted_amount)}</td><td className={`px-4 py-3 font-semibold ${Number(item.difference) === 0 ? "text-emerald-700" : "text-amber-700"}`}>{money(item.difference)}</td><td className="px-4 py-3 text-slate-500">{dateLabel(item.remitted_at)}</td></tr>)}</tbody></table></div>

            }

          </div>

        </section>

    </div>

  );

}
