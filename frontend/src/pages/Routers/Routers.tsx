import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Pencil,
  Plus,
  Router as RouterIcon,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader";
import ActionMenu from "../../components/ui/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Modal from "../../components/ui/Modal";

import {
  deleteRouter,
  getRouters,
  updateRouter,
  type Router,
  type RouterStatus,
} from "../../services/routerService";
import { getSites, type Site } from "../../services/siteService";

interface RouterRowProps {
  router: Router;
  siteName: string;
  onEdit: () => void;
  onDelete: () => void;
}

export default function Routers() {
  const navigate = useNavigate();

  const [routers, setRouters] = useState<Router[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editingRouter, setEditingRouter] =
    useState<Router | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    managementIp: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(
    null
  );

  const [deletingRouter, setDeletingRouter] =
    useState<Router | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<
    string | null
  >(null);

  /* ============================================================
     CHARGEMENT API
  ============================================================ */

  async function loadRouters() {
    try {
      setLoading(true);
      setError(null);

      const [routersData, sitesData] = await Promise.all([
        getRouters(),
        getSites().catch(() => []),
      ]);

      setRouters(routersData);
      setSites(sitesData);
    } catch (err) {
      console.error(
        "Erreur lors du chargement des routeurs :",
        err
      );

      setError("Impossible de charger les routeurs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRouters();
  }, []);

  function openEdit(router: Router) {
    setEditingRouter(router);
    setEditForm({
      name: router.name,
      managementIp: router.managementIp ?? "",
    });
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editingRouter) return;

    if (!editForm.name.trim()) {
      setEditError("Le nom du routeur est obligatoire.");
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    try {
      await updateRouter(editingRouter.id, {
        name: editForm.name.trim(),
        managementIp:
          editForm.managementIp.trim() || undefined,
      });

      setEditingRouter(null);
      await loadRouters();
    } catch (err: any) {
      setEditError(
        err?.response?.data?.message ??
          "Impossible de mettre à jour le routeur."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingRouter) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteRouter(deletingRouter.id);
      setDeletingRouter(null);
      await loadRouters();
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.message ??
          "Impossible de supprimer ce routeur."
      );
    } finally {
      setDeleting(false);
    }
  }

  const siteNameById = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((site) => map.set(site.id, site.name));
    return map;
  }, [sites]);

  /* ============================================================
     RECHERCHE
  ============================================================ */

  const filteredRouters = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return routers;
    }

    return routers.filter((router) => {
      return [
        router.name,
        router.code,
        router.model,
        router.managementIp,
        siteNameById.get(router.siteId) ?? router.siteId,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query)
        );
    });
  }, [routers, search, siteNameById]);

  /* ============================================================
     STATISTIQUES
  ============================================================ */

  const onlineRouters = routers.filter(
    (router) => router.status === "ONLINE"
  ).length;

  const offlineRouters = routers.filter(
    (router) => router.status !== "ONLINE"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Infrastructure réseau"
        title="Routeurs"
        description="Gérez les routeurs MikroTik de votre infrastructure hotspot."
        actions={
          <button
            type="button"
            onClick={() => navigate("/routers/new")}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Plus size={16} strokeWidth={2} />
            Ajouter un routeur
          </button>
        }
      />

      {/* ============================================================
          ROUTERS
      ============================================================ */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {/* Toolbar */}

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
              placeholder="Rechercher un routeur..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="text-xs font-medium text-slate-400">
            {loading
              ? "Chargement..."
              : `${filteredRouters.length} routeur${
                  filteredRouters.length > 1 ? "s" : ""
                }`}
          </div>
        </div>

        {error && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {/* Table */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Routeur
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
                    colSpan={5}
                    className="px-5 py-12 text-center text-sm text-slate-400"
                  >
                    Chargement des routeurs...
                  </td>
                </tr>
              ) : filteredRouters.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center"
                  >
                    <div className="text-sm font-semibold text-slate-600">
                      Aucun routeur trouvé
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      {search
                        ? "Aucun résultat pour cette recherche."
                        : "Aucun routeur n'est encore enregistré."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRouters.map((router) => (
                  <RouterRow
                    key={router.id}
                    router={router}
                    siteName={
                      siteNameById.get(router.siteId) ??
                      router.siteId
                    }
                    onEdit={() => openEdit(router)}
                    onDelete={() => {
                      setDeletingRouter(router);
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
        <RouterSummary
          label="Total routeurs"
          value={String(routers.length)}
          icon={RouterIcon}
        />

        <RouterSummary
          label="Routeurs en ligne"
          value={String(onlineRouters)}
          icon={CheckCircle2}
          positive
        />

        <RouterSummary
          label="Routeurs hors ligne"
          value={String(offlineRouters)}
          icon={XCircle}
          negative
        />
      </section>

      {/* ============================================================
          EDIT MODAL
      ============================================================ */}

      <Modal
        open={editingRouter !== null}
        title="Modifier le routeur"
        description={editingRouter?.code}
        onClose={() => setEditingRouter(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingRouter(null)}
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
              Nom du routeur
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
        open={deletingRouter !== null}
        title="Supprimer ce routeur ?"
        message={`"${deletingRouter?.name}" sera définitivement supprimé. Impossible si des sessions ou points d'accès y sont encore rattachés.`}
        confirmLabel="Supprimer"
        loading={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingRouter(null)}
      />
    </div>
  );
}

/* ================================================================
   STATUT — libellé + couleurs par statut réel
================================================================ */

const STATUS_CONFIG: Record<
  RouterStatus,
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

/* ================================================================
   ROUTER ROW
================================================================ */

function RouterRow({
  router,
  siteName,
  onEdit,
  onDelete,
}: RouterRowProps) {
  const online = router.status === "ONLINE";
  const statusInfo =
    STATUS_CONFIG[router.status] ?? STATUS_CONFIG.UNKNOWN;

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              online
                ? "bg-slate-100 text-slate-600"
                : "bg-red-50 text-red-500",
            ].join(" ")}
          >
            <RouterIcon size={17} strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {router.name}
            </p>

            <p className="mt-0.5 text-xs text-slate-400">
              {router.model || router.identity || "Modèle inconnu"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <code className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
          {router.managementIp || "—"}
        </code>
      </td>

      <td className="px-5 py-4 text-sm font-medium text-slate-600">
        {siteName}
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
          ariaLabel={`Actions pour ${router.name}`}
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

interface RouterSummaryProps {
  label: string;
  value: string;
  icon: typeof RouterIcon;
  positive?: boolean;
  negative?: boolean;
}

function RouterSummary({
  label,
  value,
  icon: Icon,
  positive,
  negative,
}: RouterSummaryProps) {
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
              : negative
                ? "bg-red-50 text-red-500"
                : "bg-slate-100 text-slate-600",
          ].join(" ")}
        >
          <Icon size={17} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}
