import { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import ActionMenu from "../../components/ui/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Modal from "../../components/ui/Modal";

import {
  deleteClient,
  fetchClients,
  updateClient,
  type Client,
  type ClientStatus,
} from "../../services/clientService";
import { getSites, type Site } from "../../services/siteService";

interface ClientRowProps {
  client: Client;
  siteName: string;
  onEdit: () => void;
  onDelete: () => void;
}

export default function Clients() {
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editingClient, setEditingClient] =
    useState<Client | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: "",
    phone: "",
    email: "",
    status: "ACTIVE" as ClientStatus,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(
    null
  );

  const [deletingClient, setDeletingClient] =
    useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<
    string | null
  >(null);

  /* ============================================================
     CHARGEMENT API
  ============================================================ */

  async function loadClients() {
    try {
      setLoading(true);
      setError(null);

      const [clientsData, sitesData] = await Promise.all([
        fetchClients(),
        getSites().catch(() => []),
      ]);

      setClients(clientsData);
      setSites(sitesData);
    } catch (err) {
      console.error(
        "Erreur lors du chargement des clients :",
        err
      );

      setError("Impossible de charger les clients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  const siteNameById = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((site) => map.set(site.id, site.name));
    return map;
  }, [sites]);

  function openEdit(client: Client) {
    setEditingClient(client);
    setEditForm({
      displayName: client.displayName ?? "",
      phone: client.phone ?? "",
      email: client.email ?? "",
      status: (client.status as ClientStatus) ?? "ACTIVE",
    });
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editingClient) return;

    setSavingEdit(true);
    setEditError(null);

    try {
      await updateClient(editingClient.id, {
        displayName: editForm.displayName.trim() || null,
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
        status: editForm.status,
      });

      setEditingClient(null);
      await loadClients();
    } catch (err: any) {
      setEditError(
        err?.response?.data?.message ??
          "Impossible de mettre à jour ce client."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingClient) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteClient(deletingClient.id);
      setDeletingClient(null);
      await loadClients();
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.message ??
          "Impossible de supprimer ce client."
      );
    } finally {
      setDeleting(false);
    }
  }

  /* ============================================================
     RECHERCHE
  ============================================================ */

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return clients;
    }

    return clients.filter((client) => {
      return [
        client.displayName,
        client.username,
        client.phone,
        client.email,
        siteNameById.get(client.siteId) ?? client.siteId,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query)
        );
    });
  }, [clients, search, siteNameById]);

  /* ============================================================
     STATISTIQUES
  ============================================================ */

  const activeClients = clients.filter(
    (client) => client.status === "ACTIVE"
  ).length;

  const inactiveClients = clients.filter(
    (client) =>
      client.status !== "ACTIVE"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestion des utilisateurs"
        title="Clients"
        description="Gérez les utilisateurs connectés à votre infrastructure hotspot."
        actions={
          <button
            type="button"
            onClick={() => navigate("/clients/new")}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Plus
              size={16}
              strokeWidth={2}
            />
            Ajouter un client
          </button>
        }
      />

      {/* ============================================================
          CLIENTS TABLE
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
              placeholder="Rechercher un client..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="text-xs font-medium text-slate-400">
            {loading
              ? "Chargement..."
              : `${filteredClients.length} client${
                  filteredClients.length > 1
                    ? "s"
                    : ""
                }`}
          </div>
        </div>

        {error && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Client
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Téléphone
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Site
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Sessions
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
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-slate-400"
                  >
                    Chargement des clients...
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center"
                  >
                    <div className="text-sm font-semibold text-slate-600">
                      Aucun client trouvé
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      {search
                        ? "Aucun résultat pour cette recherche."
                        : "Aucun client n'est encore enregistré."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <ClientRow
                    key={client.id}
                    client={client}
                    siteName={
                      siteNameById.get(client.siteId) ??
                      client.siteId
                    }
                    onEdit={() => openEdit(client)}
                    onDelete={() => {
                      setDeletingClient(client);
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
        <ClientSummary
          label="Clients"
          value={String(clients.length)}
          icon={Users}
        />

        <ClientSummary
          label="Clients actifs"
          value={String(activeClients)}
          icon={UserCheck}
          positive
        />

        <ClientSummary
          label="Clients inactifs"
          value={String(inactiveClients)}
          icon={UserX}
        />
      </section>

      {/* ============================================================
          EDIT MODAL
      ============================================================ */}

      <Modal
        open={editingClient !== null}
        title="Modifier le client"
        description={
          editingClient?.username ?? editingClient?.id
        }
        onClose={() => setEditingClient(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingClient(null)}
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
              Nom affiché
            </span>

            <input
              type="text"
              value={editForm.displayName}
              onChange={(event) =>
                setEditForm((f) => ({
                  ...f,
                  displayName: event.target.value,
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Téléphone
              </span>

              <input
                type="text"
                value={editForm.phone}
                onChange={(event) =>
                  setEditForm((f) => ({
                    ...f,
                    phone: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Email
              </span>

              <input
                type="email"
                value={editForm.email}
                onChange={(event) =>
                  setEditForm((f) => ({
                    ...f,
                    email: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Statut
            </span>

            <select
              value={editForm.status}
              onChange={(event) =>
                setEditForm((f) => ({
                  ...f,
                  status: event.target.value as ClientStatus,
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
              <option value="BLOCKED">Bloqué</option>
              <option value="ARCHIVED">Archivé</option>
            </select>
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
        open={deletingClient !== null}
        title="Supprimer ce client ?"
        message={`"${
          deletingClient?.displayName ??
          deletingClient?.username ??
          "Ce client"
        }" sera définitivement supprimé. Impossible si des sessions ou ventes y sont encore rattachées.`}
        confirmLabel="Supprimer"
        loading={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingClient(null)}
      />
    </div>
  );
}

/* ================================================================
   CLIENT ROW
================================================================ */

function ClientRow({
  client,
  siteName,
  onEdit,
  onDelete,
}: ClientRowProps) {
  const active =
    client.status === "ACTIVE";

  const name =
    client.displayName ||
    client.username ||
    "Client sans nom";

  const username =
    client.username ||
    "—";

  const phone =
    client.phone ||
    "—";

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
            {getInitials(name)}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {name}
            </p>

            <p className="mt-0.5 truncate text-xs text-slate-400">
              {username}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4 text-sm text-slate-600">
        {phone}
      </td>

      <td className="px-5 py-4">
        <span className="text-xs font-medium text-slate-500">
          {siteName}
        </span>
      </td>

      <td className="px-5 py-4">
        <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
          {client.sessionsCount}
        </span>
      </td>

      <td className="px-5 py-4">
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
            "text-[10px] font-bold tracking-wide",
            active
              ? "bg-emerald-50 text-emerald-600"
              : "bg-slate-100 text-slate-500",
          ].join(" ")}
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              active
                ? "bg-emerald-500"
                : "bg-slate-400",
            ].join(" ")}
          />

          {client.status}
        </span>
      </td>

      <td className="px-5 py-4 text-right">
        <ActionMenu
          ariaLabel={`Actions pour ${name}`}
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

interface ClientSummaryProps {
  label: string;
  value: string;
  icon: typeof Users;
  positive?: boolean;
}

function ClientSummary({
  label,
  value,
  icon: Icon,
  positive,
}: ClientSummaryProps) {
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
          <Icon
            size={17}
            strokeWidth={1.8}
          />
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   HELPERS
================================================================ */

function getInitials(
  name: string
): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}