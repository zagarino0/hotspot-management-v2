import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, CircleAlert, Plus, RefreshCw, Wallet } from "lucide-react";
import {
  activatePointOfSale,
  createPointOfSale,
  deactivatePointOfSale,
  getPointOfSales,
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
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedPos = points.find((point) => point.id === selectedId);
  const externalPoints = points.filter((point) => point.type === "EXTERNAL");
  const soldEvents = useMemo(
    () => events.filter((event) => event.event_type === "SOLD"),
    [events],
  );
  const selectedClosure = closures.find((closure) => closure.business_date.slice(0, 10) === businessDate);

  async function loadPoints() {
    const result = await getPointOfSales();
    setPoints(result);
    setSelectedId((current) => current || result.find((point) => point.type === "EXTERNAL")?.id || "");
  }

  async function loadPosData(id: string) {
    if (!id) {
      setEvents([]);
      setClosures([]);
      setRemittances([]);
      return;
    }
    const [eventRows, closureRows, remittanceRows] = await Promise.all([
      getPosTicketEvents(id),
      getPosDailyClosures(id),
      getPosRemittances(id),
    ]);
    setEvents(eventRows);
    setClosures(closureRows);
    setRemittances(remittanceRows);
    setBusinessDate((current) => current || closureRows[0]?.business_date.slice(0, 10) || "");
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
      setLoading(false);
      return () => { active = false; };
    }
    Promise.all([
      getPosTicketEvents(selectedId),
      getPosDailyClosures(selectedId),
      getPosRemittances(selectedId),
    ])
      .then(([eventRows, closureRows, remittanceRows]) => {
        if (!active) return;
        setEvents(eventRows);
        setClosures(closureRows);
        setRemittances(remittanceRows);
        setBusinessDate((current) => closureRows.some((c) => c.business_date.slice(0, 10) === current)
          ? current
          : closureRows[0]?.business_date.slice(0, 10) || "");
      })
      .catch(() => { if (active) setError("Impossible de charger les ventes détectées, les clôtures ou les versements."); })
      .then(() => { if (active) setLoading(false); }, () => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

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
    if (!selectedId || !businessDate || !selectedClosure) {
      setError("Sélectionnez une clôture existante avant de confirmer le versement.");
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
      setError(e?.response?.data?.message ?? "Impossible d'enregistrer le versement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Gestion commerciale</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Ventes détectées</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Les ventes sont détectées automatiquement à la première connexion réussie du voucher. Aucun enregistrement manuel par ticket.
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={busy || !selectedId} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">
          <RefreshCw size={16} className={busy ? "animate-spin" : ""} /> Actualiser
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <label className="block text-sm font-medium text-slate-700">
            Point de vente
            <select value={selectedId} onChange={(e) => { setBusinessDate(""); setAmount(""); setSelectedId(e.target.value); }} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
              <option value="">Sélectionner un point de vente externe</option>
              {externalPoints.map((point) => <option key={point.id} value={point.id}>{point.name} ({point.code})</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Code du point de vente
            <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Ex. CASHPOINTWIFI" className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Nom du point de vente
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom commercial" className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <button type="button" onClick={handleCreatePoint} disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-50"><Plus size={15} /> Ajouter</button>
        </div>
        {selectedPos && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <div><p className="font-semibold text-slate-800">{selectedPos.name}</p><p className="text-xs text-slate-500">{selectedPos.code} · {selectedPos.status === "ACTIVE" ? "Actif" : "Inactif"}</p></div>
          <button type="button" onClick={() => handleToggle(selectedPos)} disabled={busy} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">{selectedPos.status === "ACTIVE" ? "Désactiver le point de vente" : "Réactiver le point de vente"}</button>
        </div>}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Tickets vendus détectés</p><p className="mt-2 text-2xl font-bold text-slate-950">{soldEvents.length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Montant brut détecté</p><p className="mt-2 text-2xl font-bold text-slate-950">{money(soldEvents.reduce((sum, event) => sum + Number(event.unit_price), 0))}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Clôtures disponibles</p><p className="mt-2 text-2xl font-bold text-slate-950">{closures.length}</p></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
          <div><h2 className="font-bold text-slate-900">Tickets vendus détectés</h2><p className="mt-1 text-sm text-slate-500">Une ligne par voucher, lors de sa première session enregistrée.</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{soldEvents.length} ticket(s)</span>
        </div>
        {loading ? <p className="p-5 text-sm text-slate-500">Chargement…</p> : soldEvents.length === 0 ? <p className="p-5 text-sm text-slate-500">Aucune vente détectée pour ce point de vente.</p> :
          <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Voucher</th><th className="px-4 py-3">Montant attendu</th><th className="px-4 py-3">Date de détection</th><th className="px-4 py-3">Source</th></tr></thead><tbody>{soldEvents.map((event) => <tr key={event.id} className="border-t border-slate-100"><td className="px-4 py-3 font-mono font-semibold text-slate-800">{event.voucher_code}</td><td className="px-4 py-3">{money(event.unit_price)}</td><td className="px-4 py-3 text-slate-600">{dateLabel(event.occurred_at)}</td><td className="px-4 py-3 text-slate-600">{event.metadata?.detection === "FIRST_SUCCESSFUL_SESSION" ? "Première connexion" : "Événement enregistré"}</td></tr>)}</tbody></table></div>
        }
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4"><CalendarClock size={18} /><div><h2 className="font-bold text-slate-900">Clôtures quotidiennes</h2><p className="text-sm text-slate-500">La clôture automatique est prévue à 20 h, heure de Madagascar.</p></div></div>
        {closures.length === 0 ? <p className="p-5 text-sm text-slate-500">Aucune clôture disponible pour ce point de vente.</p> :
          <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Journée</th><th className="px-4 py-3">Tickets</th><th className="px-4 py-3">Montant brut</th><th className="px-4 py-3">Remboursements</th><th className="px-4 py-3">Montant attendu</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">État</th></tr></thead><tbody>{closures.map((closure) => <tr key={closure.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{closure.business_date.slice(0,10)}</td><td className="px-4 py-3">{closure.tickets_sold}</td><td className="px-4 py-3">{money(closure.gross_revenue)}</td><td className="px-4 py-3">{money(closure.refunds)}</td><td className="px-4 py-3 font-semibold">{money(closure.net_revenue)}</td><td className="px-4 py-3">{closure.stock_review_required ? <span className="inline-flex items-center gap-1 text-amber-700"><CircleAlert size={14} /> À vérifier</span> : <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> Vérifié</span>}</td><td className="px-4 py-3">{closure.status === "CLOSED" ? "Clôturée" : "Ouverte"}</td></tr>)}</tbody></table></div>
        }
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2"><Wallet size={18} /><h2 className="font-bold text-slate-900">Confirmer un versement</h2></div>
          <p className="mb-4 text-sm text-slate-500">La personne responsable saisit le montant réellement remis. La vente elle-même n'est pas saisie manuellement.</p>
          <label className="mb-3 block text-sm font-medium text-slate-700">Journée clôturée
            <select value={businessDate} onChange={(e) => { setBusinessDate(e.target.value); setAmount(""); }} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3">
              {closures.filter((closure) => closure.status === "CLOSED").map((closure) => <option key={closure.id} value={closure.business_date.slice(0,10)}>{closure.business_date.slice(0,10)} — attendu {money(closure.net_revenue)}</option>)}
            </select>
          </label>
          <div className="mb-3 rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Montant attendu</p><p className="text-lg font-bold text-slate-900">{selectedClosure ? money(selectedClosure.net_revenue) : "Aucune clôture sélectionnée"}</p></div>
          <label className="mb-3 block text-sm font-medium text-slate-700">Montant réellement remis (MGA)
            <input type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3" placeholder="Saisir le montant reçu" />
          </label>
          <label className="mb-4 block text-sm font-medium text-slate-700">Note (facultatif)
            <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3" placeholder="Commentaire sur le versement" />
          </label>
          <button type="button" onClick={handleRemittance} disabled={busy || !selectedClosure || !businessDate || amount === ""} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Confirmer la réception</button>
          <p className="mt-3 text-xs text-slate-500">Le système conserve l'écart entre le montant attendu et le montant reçu.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4"><h2 className="font-bold text-slate-900">Historique des versements</h2><p className="mt-1 text-sm text-slate-500">Montants reçus et écarts conservés par journée.</p></div>
          {remittances.length === 0 ? <p className="p-5 text-sm text-slate-500">Aucun versement enregistré.</p> :
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Journée</th><th className="px-4 py-3">Attendu</th><th className="px-4 py-3">Reçu</th><th className="px-4 py-3">Écart</th><th className="px-4 py-3">Date de réception</th></tr></thead><tbody>{remittances.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-3">{item.business_date.slice(0,10)}</td><td className="px-4 py-3">{money(item.expected_amount)}</td><td className="px-4 py-3">{money(item.remitted_amount)}</td><td className={`px-4 py-3 font-semibold ${Number(item.difference) === 0 ? "text-emerald-700" : "text-amber-700"}`}>{money(item.difference)}</td><td className="px-4 py-3 text-slate-500">{dateLabel(item.remitted_at)}</td></tr>)}</tbody></table></div>
          }
        </div>
      </section>
    </div>
  );
}
