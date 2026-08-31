import { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  Radio,
  Search,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import ActionMenu from "../../components/ui/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Modal from "../../components/ui/Modal";
import {
  deleteAccessPoint,
  getAccessPoints,
  updateAccessPoint,
  type AccessPoint,
  type AccessPointStatus,
} from "../../services/accessPointService";

const STATUS_CONFIG: Record<
  AccessPointStatus,
  { label: string; className: string; dot: string }
> = {
  ONLINE: {
    label: "En ligne",
    className: "bg-emerald-50 text-emerald-600",
    dot: "bg-emerald-500",
  },
  OFFLINE: {
    label: "Hors ligne",
    className: "bg-red-50 text-red-500",
    dot: "bg-red-500",
  },
  UNKNOWN: {
    label: "Inconnu",
    className: "bg-amber-50 text-amber-600",
    dot: "bg-amber-500",
  },
  DISABLED: {
    label: "Désactivé",
    className: "bg-slate-100 text-slate-500",
    dot: "bg-slate-400",
  },
};

const BAND_LABELS: Record<string, string> = {
  "2.4GHZ": "2.4 GHz",
  "5GHZ": "5 GHz",
  "6GHZ": "6 GHz",
  OTHER: "Autre",
};

export default function AccessPoints() {
  const navigate = useNavigate();

  const [accessPoints, setAccessPoints] = useState<
    AccessPoint[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editingAp, setEditingAp] =
    useState<AccessPoint | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    managementIp: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(
    null
  );

  const [deletingAp, setDeletingAp] =
    useState<AccessPoint | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<
    string | null
  >(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const data = await getAccessPoints();
      setAccessPoints(data);
    } catch (err) {
      console.error(
        "Erreur lors du chargement des points d'accès :",
        err
      );

      setError("Impossible de charger les points d'accès.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openEdit(ap: AccessPoint) {
    setEditingAp(ap);
    setEditForm({
      name: ap.name,
      managementIp: ap.managementIp ?? "",
    });
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editingAp) return;

    if (!editForm.name.trim()) {
      setEditError("Le nom est obligatoire.");
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    try {
      await updateAccessPoint(editingAp.id, {
        name: editForm.name.trim(),
        managementIp: editForm.managementIp.trim() || null,
      });

      setEditingAp(null);
      await load();
    } catch (err: any) {
      setEditError(
        err?.response?.data?.message ??
          "Impossible de mettre à jour ce point d'accès."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingAp) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteAccessPoint(deletingAp.id);
      setDeletingAp(null);
      await load();
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.message ??
          "Impossible de supprimer ce point d'accès."
      );
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return accessPoints;
    }

    return accessPoints.filter((ap) =>
      [ap.name, ap.code, ap.ssid, ap.managementIp, ap.siteName]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    );
  }, [accessPoints, search]);

  const onlineCount = accessPoints.filter(
    (ap) => ap.status === "ONLINE"
  ).length;

  const offlineCount = accessPoints.filter(
    (ap) => ap.status !== "ONLINE"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Infrastructure WiFi"
        title="Points d'accès"
        description="Gérez les points d'accès WiFi de vos différents sites."
        actions={
          <button
            type="button"
            onClick={() => navigate("/access-points/new")}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Plus size={16} strokeWidth={2} />
            Ajouter un point d'accès
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {/* ============================================================
          ACCESS POINTS
      ============================================================ */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
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
              placeholder="Rechercher un point d'accès..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="text-xs font-medium text-slate-400">
            {loading
              ? "Chargement..."
              : `${filtered.length} point${
                  filtered.length > 1 ? "s" : ""
                } d'accès`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Point d'accès
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  SSID
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Bande
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Adresse IP
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Site
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
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-slate-400"
                  >
                    Chargement des points d'accès...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >
                    <div className="text-sm font-semibold text-slate-600">
                      Aucun point d'accès trouvé
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      {search
                        ? "Aucun résultat pour cette recherche."
                        : "Commencez par ajouter votre premier point d'accès."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((ap) => (
                  <AccessPointRow
                    key={ap.id}
                    ap={ap}
                    onEdit={() => openEdit(ap)}
                    onDelete={() => {
                      setDeletingAp(ap);
                      setDeleteError(null);
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============================================================
          SUMMARY
      ============================================================ */}

      <section className="grid gap-4 sm:grid-cols-3">
        <AccessPointSummary
          label="Points d'accès"
          value={String(accessPoints.length)}
          icon={Radio}
        />

        <AccessPointSummary
          label="En ligne"
          value={String(onlineCount)}
          icon={Wifi}
          positive
        />

        <AccessPointSummary
          label="Hors ligne"
          value={String(offlineCount)}
          icon={WifiOff}
        />
      </section>

      {/* ============================================================
          EDIT MODAL
      ============================================================ */}

      <Modal
        open={editingAp !== null}
        title="Modifier le point d'accès"
        description={editingAp?.code}
        onClose={() => setEditingAp(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingAp(null)}
              disabled={savingEdit}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="rounded-lg bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingEdit ? "Enregistrement..." : "Enregistrer"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Nom
            </span>

            <input
              type="text"
              value={editForm.name}
              onChange={(event) =>
                setEditForm((f) => ({
                  ...f,
                  name: event.target.value,
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Adresse IP de gestion
            </span>

            <input
              type="text"
              value={editForm.managementIp}
              onChange={(event) =>
                setEditForm((f) => ({
                  ...f,
                  managementIp: event.target.value,
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </label>
        </div>

        {editError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {editError}
          </div>
        )}
      </Modal>

      {/* ============================================================
          DELETE CONFIRM
      ============================================================ */}

      <ConfirmDialog
        open={deletingAp !== null}
        title="Supprimer ce point d'accès ?"
        message={`"${deletingAp?.name}" sera définitivement supprimé, ainsi que ses radios associées.`}
        confirmLabel="Supprimer"
        loading={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingAp(null)}
      />
    </div>
  );
}

/* ================================================================
   ACCESS POINT ROW
================================================================ */

function AccessPointRow({
  ap,
  onEdit,
  onDelete,
}: {
  ap: AccessPoint;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusInfo = STATUS_CONFIG[ap.status];

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              ap.status === "ONLINE"
                ? "bg-slate-100 text-slate-600"
                : "bg-red-50 text-red-500",
            ].join(" ")}
          >
            <Radio size={17} strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {ap.name}
            </p>

            <p className="mt-0.5 text-xs text-slate-400">
              {ap.model || ap.vendor || "Modèle inconnu"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <span className="text-sm font-medium text-slate-600">
          {ap.ssid || "—"}
        </span>
      </td>

      <td className="px-5 py-4">
        <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
          {ap.band ? (BAND_LABELS[ap.band] ?? ap.band) : "—"}
        </span>
      </td>

      <td className="px-5 py-4">
        <code className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
          {ap.managementIp || "—"}
        </code>
      </td>

      <td className="px-5 py-4 text-sm font-medium text-slate-600">
        {ap.siteName}
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
          ariaLabel={`Actions pour ${ap.name}`}
          items={[
            {
              label: "Modifier",
              icon: Pencil,
              onClick: onEdit,
            },
            {
              label: "Supprimer",
              icon: Trash2,
              onClick: onDelete,
              danger: true,
            },
          ]}
        />
      </td>
    </tr>
  );
}

/* ================================================================
   SUMMARY
================================================================ */

interface AccessPointSummaryProps {
  label: string;
  value: string;
  icon: typeof Radio;
  positive?: boolean;
}

function AccessPointSummary({
  label,
  value,
  icon: Icon,
  positive,
}: AccessPointSummaryProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">
            {label}
          </p>

          <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-950">
            {value}
          </p>
        </div>

        <div
          className={[
            "flex h-9 w-9 items-center justify-center rounded-lg",
            positive
              ? "bg-emerald-50 text-emerald-600"
              : "bg-slate-100 text-slate-600",
          ].join(" ")}
        >
          <Icon size={17} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}
