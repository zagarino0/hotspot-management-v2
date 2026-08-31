import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import ActionMenu from "../../components/ui/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Modal from "../../components/ui/Modal";

import {
  deleteRole,
  getAllPermissions,
  getRoleDetails,
  getRoles,
  updateRole,
  type Permission,
  type Role,
} from "../../services/roleService";

const RESOURCE_LABELS: Record<string, string> = {
  ORGANIZATION: "Organisation",
  SITE: "Sites",
  USER: "Utilisateurs",
  ROLE: "Rôles",
  ROUTER: "Routeurs",
  ROUTER_CREDENTIAL: "Identifiants routeur",
  ACCESS_POINT: "Points d'accès",
  AP_RADIO: "Radios AP",
  PLAN: "Forfaits",
  VOUCHER: "Vouchers",
  VOUCHER_BATCH: "Lots de vouchers",
  CLIENT: "Clients",
  DEVICE: "Appareils",
  SESSION: "Sessions",
  SALE: "Ventes",
  PAYMENT: "Paiements",
  SYNC_JOB: "Synchronisation",
  ROUTER_EVENT: "Événements routeur",
  ROUTER_METRIC: "Métriques routeur",
  AUDIT_LOG: "Journal d'audit",
};

export default function Roles() {
  const navigate = useNavigate();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editingRole, setEditingRole] = useState<Role | null>(
    null
  );
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
  });
  const [selectedPermissionIds, setSelectedPermissionIds] =
    useState<string[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(
    null
  );

  const [deletingRole, setDeletingRole] = useState<Role | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<
    string | null
  >(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const [rolesData, permissionsData] = await Promise.all([
        getRoles(),
        getAllPermissions(),
      ]);

      setRoles(rolesData);
      setPermissions(permissionsData);
    } catch (err) {
      console.error(
        "Erreur lors du chargement des rôles :",
        err
      );

      setError("Impossible de charger les rôles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return roles;
    }

    return roles.filter((role) =>
      [role.name, role.code, role.description]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    );
  }, [roles, search]);

  const activeRoles = roles.filter(
    (r) => r.status === "ACTIVE"
  ).length;
  const systemRoles = roles.filter((r) => r.isSystem).length;
  const totalUsersCovered = roles.reduce(
    (sum, r) => sum + r.userCount,
    0
  );

  const permissionsByResource = useMemo(() => {
    const map = new Map<string, Permission[]>();

    for (const permission of permissions) {
      const list = map.get(permission.resource) ?? [];
      list.push(permission);
      map.set(permission.resource, list);
    }

    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, [permissions]);

  async function openEdit(role: Role) {
    setEditingRole(role);
    setEditForm({
      name: role.name,
      description: role.description ?? "",
    });
    setEditError(null);
    setLoadingDetails(true);
    setSelectedPermissionIds([]);

    try {
      const details = await getRoleDetails(role.id);
      setSelectedPermissionIds(details.permissionIds);
    } catch (err) {
      console.error(
        "Erreur lors du chargement des permissions :",
        err
      );
      setEditError(
        "Impossible de charger les permissions actuelles."
      );
    } finally {
      setLoadingDetails(false);
    }
  }

  function togglePermission(permissionId: string) {
    setSelectedPermissionIds((current) =>
      current.indexOf(permissionId) !== -1
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId]
    );
  }

  async function handleSaveEdit() {
    if (!editingRole) return;

    setSavingEdit(true);
    setEditError(null);

    try {
      await updateRole(editingRole.id, {
        name: editForm.name.trim() || undefined,
        description: editForm.description.trim() || null,
        permissionIds: selectedPermissionIds,
      });

      setEditingRole(null);
      await load();
    } catch (err: any) {
      setEditError(
        err?.response?.data?.message ??
          "Impossible de mettre à jour ce rôle."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingRole) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteRole(deletingRole.id);
      setDeletingRole(null);
      await load();
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.message ??
          "Impossible de supprimer ce rôle."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Rôles & permissions"
        description="Définissez ce que chaque rôle peut voir et faire."
        actions={
          <button
            type="button"
            onClick={() => navigate("/roles/new")}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Plus size={16} strokeWidth={2} />
            Ajouter un rôle
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RoleSummary
          label="Total rôles"
          value={String(roles.length)}
          icon={ShieldCheck}
        />
        <RoleSummary
          label="Actifs"
          value={String(activeRoles)}
          icon={CheckCircle2}
          positive
        />
        <RoleSummary
          label="Rôles système"
          value={String(systemRoles)}
          icon={Lock}
        />
        <RoleSummary
          label="Utilisateurs couverts"
          value={String(totalUsersCovered)}
          icon={Users}
        />
      </section>

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
              placeholder="Rechercher un rôle..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-slate-400">
              Chargement des rôles...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="text-sm font-semibold text-slate-600">
                Aucun rôle trouvé
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {search
                  ? "Aucun résultat pour cette recherche."
                  : "Créez votre premier rôle personnalisé."}
              </p>
            </div>
          ) : (
            filtered.map((role) => (
              <RoleRow
                key={role.id}
                role={role}
                onEdit={() => openEdit(role)}
                onDelete={() => {
                  setDeletingRole(role);
                  setDeleteError(null);
                }}
              />
            ))
          )}
        </div>
      </section>

      {/* EDIT MODAL */}
      <Modal
        open={editingRole !== null}
        title="Modifier le rôle"
        description={editingRole?.code}
        size="lg"
        onClose={() => setEditingRole(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingRole(null)}
              disabled={savingEdit}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={savingEdit || loadingDetails}
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
                Nom du rôle
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
                Description
              </span>
              <input
                type="text"
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((f) => ({
                    ...f,
                    description: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </label>
          </div>

          <div>
            <span className="mb-2 block text-xs font-semibold text-slate-600">
              Permissions ({selectedPermissionIds.length}{" "}
              sélectionnée
              {selectedPermissionIds.length > 1 ? "s" : ""})
            </span>

            {loadingDetails ? (
              <p className="text-xs text-slate-400">
                Chargement des permissions...
              </p>
            ) : (
              <div className="max-h-72 space-y-4 overflow-y-auto rounded-lg border border-slate-100 p-3">
                {permissionsByResource.map(
                  ([resource, perms]) => (
                    <div key={resource}>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        {RESOURCE_LABELS[resource] ?? resource}
                      </p>

                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {perms.map((permission) => (
                          <label
                            key={permission.id}
                            className="flex items-center gap-2 text-sm text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={
                                selectedPermissionIds.indexOf(
                                  permission.id
                                ) !== -1
                              }
                              onChange={() =>
                                togglePermission(permission.id)
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            {permission.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {editError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {editError}
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRM */}
      <ConfirmDialog
        open={deletingRole !== null}
        title="Supprimer ce rôle ?"
        message={`"${deletingRole?.name}" sera définitivement supprimé. Impossible si des utilisateurs l'ont encore.`}
        confirmLabel="Supprimer"
        loading={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingRole(null)}
      />
    </div>
  );
}

interface RoleSummaryProps {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
  positive?: boolean;
}

function RoleSummary({
  label,
  value,
  icon: Icon,
  positive,
}: RoleSummaryProps) {
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

function RoleRow({
  role,
  onEdit,
  onDelete,
}: {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-5 transition-colors hover:bg-slate-50/60">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            role.isSystem
              ? "bg-slate-950 text-white"
              : "bg-slate-100 text-slate-600",
          ].join(" ")}
        >
          {role.isSystem ? (
            <Lock size={17} strokeWidth={1.8} />
          ) : (
            <ShieldCheck size={17} strokeWidth={1.8} />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {role.name}
            </h3>
            {role.isSystem && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                Système
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {role.description || "Aucune description"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden text-right sm:block">
          <p className="text-xs text-slate-400">Permissions</p>
          <p className="text-sm font-bold text-slate-700">
            {role.permissionCount}
          </p>
        </div>

        <div className="hidden text-right sm:block">
          <p className="text-xs text-slate-400">Utilisateurs</p>
          <p className="text-sm font-bold text-slate-700">
            {role.userCount}
          </p>
        </div>

        <ActionMenu
          ariaLabel={`Actions pour ${role.name}`}
          items={[
            {
              label: "Modifier",
              icon: Pencil,
              onClick: onEdit,
              disabled: role.isSystem,
            },
            {
              label: "Supprimer",
              icon: Trash2,
              onClick: onDelete,
              disabled: role.isSystem || role.userCount > 0,
              danger: true,
            },
          ]}
        />
      </div>
    </div>
  );
}
