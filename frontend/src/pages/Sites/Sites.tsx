import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  MapPin,
  Network,
  Pencil,
  Plus,
  Router,
  Search,
  Trash2,
  Users,
  Wifi,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import ActionMenu from "../../components/ui/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Modal from "../../components/ui/Modal";

import {
  deleteSite,
  getSites,
  updateSite,
  type Site,
} from "../../services/siteService";

export default function Sites() {
  const navigate = useNavigate();

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editingSite, setEditingSite] = useState<Site | null>(
    null
  );
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    city: "",
    region: "",
    district: "",
    address: "",
    description: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(
    null
  );

  const [deletingSite, setDeletingSite] = useState<Site | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<
    string | null
  >(null);

  async function loadSites() {
    try {
      setLoading(true);
      setError(null);

      const data = await getSites();
      setSites(data);
    } catch (err) {
      console.error(
        "Erreur lors du chargement des sites :",
        err
      );
      setError("Impossible de charger les sites.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSites();
  }, []);

  function openEdit(site: Site) {
    setEditingSite(site);
    setEditForm({
      name: site.name,
      code: site.code,
      city: site.city ?? "",
      region: site.region ?? "",
      district: site.district ?? "",
      address: site.address ?? "",
      description: site.description ?? "",
    });
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editingSite) return;

    if (!editForm.name.trim()) {
      setEditError("Le nom du site est obligatoire.");
      return;
    }

    if (!editForm.code.trim()) {
      setEditError("Le code du site est obligatoire.");
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    try {
      await updateSite(editingSite.id, {
        name: editForm.name.trim(),
        code: editForm.code.trim(),
        city: editForm.city.trim() || null,
        region: editForm.region.trim() || null,
        district: editForm.district.trim() || null,
        address: editForm.address.trim() || null,
        description: editForm.description.trim() || null,
      });

      setEditingSite(null);
      await loadSites();
    } catch (err: any) {
      setEditError(
        err?.response?.data?.message ??
          "Impossible de mettre à jour le site."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingSite) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteSite(deletingSite.id);
      setDeletingSite(null);
      await loadSites();
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.message ??
          "Impossible de supprimer ce site."
      );
    } finally {
      setDeleting(false);
    }
  }

  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return sites;
    }

    return sites.filter((site) =>
      [site.name, site.code, site.city, site.region]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    );
  }, [sites, search]);

  const totals = sites.reduce(
    (acc, site) => ({
      routers: acc.routers + site.routerCount,
      routersOnline:
        acc.routersOnline + site.routerOnlineCount,
      accessPoints:
        acc.accessPoints + site.accessPointCount,
      clients: acc.clients + site.clientCount,
    }),
    { routers: 0, routersOnline: 0, accessPoints: 0, clients: 0 }
  );

  const allRoutersOnline =
    totals.routers > 0 &&
    totals.routers === totals.routersOnline;

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
              Infrastructure
            </span>
          </div>

          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-slate-950">
            Sites
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Gérez les différents sites et zones WiFi de votre infrastructure.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/sites/new")}
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          <Plus size={16} strokeWidth={2} />
          Ajouter un site
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {/* ============================================================
          KPI
      ============================================================ */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SiteStat
          label="Sites"
          value={String(sites.length)}
          description="Sites configurés"
          icon={MapPin}
        />

        <SiteStat
          label="Routeurs"
          value={String(totals.routers)}
          description="Équipements réseau"
          icon={Router}
        />

        <SiteStat
          label="Access Points"
          value={String(totals.accessPoints)}
          description="Points d'accès"
          icon={Wifi}
        />

        <SiteStat
          label="Clients"
          value={String(totals.clients)}
          description="Clients enregistrés"
          icon={Users}
        />
      </section>

      {/* ============================================================
          SEARCH
      ============================================================ */}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">
              Sites configurés
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Vue d'ensemble de vos infrastructures WiFi.
            </p>
          </div>

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
              placeholder="Rechercher un site..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        {/* ============================================================
            SITE LIST
        ============================================================ */}

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-slate-400">
              Chargement des sites...
            </div>
          ) : filteredSites.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="text-sm font-semibold text-slate-600">
                Aucun site trouvé
              </div>

              <p className="mt-1 text-xs text-slate-400">
                {search
                  ? "Aucun résultat pour cette recherche."
                  : "Commencez par ajouter votre premier site."}
              </p>
            </div>
          ) : (
            filteredSites.map((site) => (
              <SiteRow
                key={site.id}
                site={site}
                onEdit={() => openEdit(site)}
                onDelete={() => {
                  setDeletingSite(site);
                  setDeleteError(null);
                }}
              />
            ))
          )}
        </div>
      </section>

      {/* ============================================================
          NETWORK OVERVIEW
      ============================================================ */}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Network size={17} strokeWidth={1.8} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                Réseau global
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Vue synthétique de l'infrastructure.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniMetric label="Sites" value={String(sites.length)} />

            <MiniMetric
              label="Routeurs"
              value={String(totals.routers)}
            />

            <MiniMetric
              label="Access Points"
              value={String(totals.accessPoints)}
            />

            <MiniMetric
              label="Clients"
              value={String(totals.clients)}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-3">
            <div
              className={[
                "flex h-9 w-9 items-center justify-center rounded-xl",
                allRoutersOnline
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-amber-50 text-amber-600",
              ].join(" ")}
            >
              <Activity size={17} strokeWidth={1.8} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                État des sites
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Disponibilité de l'infrastructure.
              </p>
            </div>
          </div>

          <div
            className={[
              "mt-5 rounded-xl border p-4",
              allRoutersOnline
                ? "border-emerald-100 bg-emerald-50"
                : "border-amber-100 bg-amber-50",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={[
                    "absolute h-full w-full rounded-full opacity-40",
                    allRoutersOnline
                      ? "bg-emerald-400"
                      : "bg-amber-400",
                  ].join(" ")}
                />
                <span
                  className={[
                    "relative h-2.5 w-2.5 rounded-full",
                    allRoutersOnline
                      ? "bg-emerald-500"
                      : "bg-amber-500",
                  ].join(" ")}
                />
              </span>

              <span
                className={[
                  "text-sm font-semibold",
                  allRoutersOnline
                    ? "text-emerald-700"
                    : "text-amber-700",
                ].join(" ")}
              >
                {totals.routersOnline} / {totals.routers} routeurs
                en ligne
              </span>
            </div>

            <p
              className={[
                "mt-2 text-xs leading-5",
                allRoutersOnline
                  ? "text-emerald-700/70"
                  : "text-amber-700/70",
              ].join(" ")}
            >
              {allRoutersOnline
                ? "Tous les routeurs actuellement configurés répondent correctement."
                : "Certains routeurs sont hors ligne ou n'ont pas encore été synchronisés."}
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          EDIT MODAL
      ============================================================ */}

      <Modal
        open={editingSite !== null}
        title="Modifier le site"
        description={editingSite?.code}
        size="lg"
        onClose={() => setEditingSite(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingSite(null)}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Nom du site
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
                Code du site
              </span>

              <input
                type="text"
                value={editForm.code}
                onChange={(event) =>
                  setEditForm((f) => ({
                    ...f,
                    code: event.target.value.toUpperCase(),
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Emplacement
            </span>

            <div className="grid gap-3 sm:grid-cols-3">
              <input
                type="text"
                value={editForm.city}
                placeholder="Ville"
                onChange={(event) =>
                  setEditForm((f) => ({
                    ...f,
                    city: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />

              <input
                type="text"
                value={editForm.region}
                placeholder="Région"
                onChange={(event) =>
                  setEditForm((f) => ({
                    ...f,
                    region: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />

              <input
                type="text"
                value={editForm.district}
                placeholder="District"
                onChange={(event) =>
                  setEditForm((f) => ({
                    ...f,
                    district: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Adresse
            </span>

            <input
              type="text"
              value={editForm.address}
              onChange={(event) =>
                setEditForm((f) => ({
                  ...f,
                  address: event.target.value,
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Description
            </span>

            <textarea
              value={editForm.description}
              onChange={(event) =>
                setEditForm((f) => ({
                  ...f,
                  description: event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
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
        open={deletingSite !== null}
        title="Supprimer ce site ?"
        message={`"${deletingSite?.name}" sera définitivement supprimé. Cette action est impossible si des routeurs, clients ou autres données y sont encore rattachés.`}
        confirmLabel="Supprimer"
        loading={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingSite(null)}
      />
    </div>
  );
}

/* ================================================================
   SITE STAT
================================================================ */

interface SiteStatProps {
  label: string;
  value: string;
  description: string;
  icon: typeof MapPin;
}

function SiteStat({
  label,
  value,
  description,
  icon: Icon,
}: SiteStatProps) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_25px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-[26px] font-bold tracking-[-0.03em] text-slate-950">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
          <Icon size={18} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   STATUS
================================================================ */

const STATUS_CONFIG: Record<
  Site["status"],
  { label: string; className: string; dot: string }
> = {
  ACTIVE: {
    label: "Actif",
    className: "bg-emerald-50 text-emerald-600",
    dot: "bg-emerald-500",
  },
  INACTIVE: {
    label: "Inactif",
    className: "bg-slate-100 text-slate-500",
    dot: "bg-slate-400",
  },
  SUSPENDED: {
    label: "Suspendu",
    className: "bg-amber-50 text-amber-600",
    dot: "bg-amber-500",
  },
  ARCHIVED: {
    label: "Archivé",
    className: "bg-slate-100 text-slate-400",
    dot: "bg-slate-300",
  },
};

/* ================================================================
   SITE ROW
================================================================ */

function SiteRow({
  site,
  onEdit,
  onDelete,
}: {
  site: Site;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = STATUS_CONFIG[site.status];

  const location = [site.city, site.region]
    .filter(Boolean)
    .join(", ") || site.address || "Localisation non renseignée";

  return (
    <div className="group p-5 transition-colors hover:bg-slate-50/60">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        {/* SITE */}
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
            <MapPin size={19} strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                {site.name}
              </h3>

              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
                  "text-[10px] font-bold tracking-wide",
                  status.className,
                ].join(" ")}
              >
                <span
                  className={[
                    "h-1.5 w-1.5 rounded-full",
                    status.dot,
                  ].join(" ")}
                />

                {status.label}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-400">
              {location}
            </p>

            <p className="mt-2 font-mono text-[11px] text-slate-500">
              {site.code}
            </p>
          </div>
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-3 gap-3 sm:flex sm:items-center">
          <SiteMetric
            label="Routeurs"
            value={`${site.routerOnlineCount}/${site.routerCount}`}
          />

          <SiteMetric
            label="AP"
            value={String(site.accessPointCount)}
          />

          <SiteMetric
            label="Clients"
            value={String(site.clientCount)}
          />
        </div>

        {/* ACTION */}
        <div className="flex items-center justify-end gap-4">
          <ActionMenu
            ariaLabel={`Actions pour ${site.name}`}
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
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   SITE METRIC
================================================================ */

function SiteMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[80px] rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-slate-700">
        {value}
      </p>
    </div>
  );
}

/* ================================================================
   MINI METRIC
================================================================ */

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs text-slate-400">{label}</p>

      <p className="mt-1 text-lg font-bold tracking-tight text-slate-800">
        {value}
      </p>
    </div>
  );
}
