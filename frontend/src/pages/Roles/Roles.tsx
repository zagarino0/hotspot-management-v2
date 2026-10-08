import {
  CheckCircle2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import PageHeader from "../../components/ui/PageHeader";
import { useAuth } from "../../contexts/AuthContext";
import {
  createRole,
  deleteRole,
  getAllPermissions,
  getRoleDetails,
  getRoles,
  updateRole,
  type Permission,
  type Role,
  type RoleStatus,
} from "../../services/roleService";

type ModalMode = "create" | "edit" | "view";

interface RoleFormState {
  name: string;
  code: string;
  description: string;
  status: RoleStatus;
  permissionIds: string[];
}

const EMPTY_FORM: RoleFormState = {
  name: "",
  code: "",
  description: "",
  status: "ACTIVE",
  permissionIds: [],
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function slugToCode(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function groupPermissions(permissions: Permission[]) {
  return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
    const key = permission.resource || "Autres";
    groups[key] ??= [];
    groups[key].push(permission);
    return groups;
  }, {});
}

export default function Roles() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [rolesResult, permissionsResult] = await Promise.all([
          getRoles(),
          getAllPermissions(),
        ]);

        if (active) {
          setRoles(rolesResult);
          setPermissions(permissionsResult);
        }
      } catch (requestError) {
        if (active) {
          setError(
            getErrorMessage(
              requestError,
              "Impossible de charger les rôles et permissions.",
            ),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roles;

    return roles.filter((role) =>
      [role.name, role.code, role.description ?? ""]
        .join(" ")
        .toLowerCase()
        .indexOf(query),
    );
  }, [roles, search]);

  const totalRoles = roles.length;
  const activeRoles = roles.filter((role) => role.status === "ACTIVE").length;
  const inactiveRoles = roles.filter((role) => role.status !== "ACTIVE").length;
  const systemRoles = roles.filter((role) => role.isSystem).length;
  const permissionGroups = useMemo(() => groupPermissions(permissions), [permissions]);

  function openCreateModal() {
    setEditingRole(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalMode("create");
    setOpenActionsId(null);
  }

  async function openRoleModal(role: Role, mode: "edit" | "view") {
    setOpenActionsId(null);
    setFormError(null);
    setEditingRole(role);
    setModalMode(mode);
    setSaving(true);

    try {
      const details = await getRoleDetails(role.id);

      setForm({
        name: details.role.name,
        code: details.role.code,
        description: details.role.description ?? "",
        status: details.role.status,
        permissionIds: details.permissionIds,
      });
    } catch (requestError) {
      setFormError(
        getErrorMessage(
          requestError,
          "Impossible de charger les permissions du rôle.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  function closeModal() {
    setModalMode(null);
    setEditingRole(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function togglePermission(permissionId: string) {
    if (modalMode === "view") return;

    setForm((current) => ({
      ...current,
      permissionIds:
        current.permissionIds.indexOf(permissionId) !== -1
          ? current.permissionIds.filter((id) => id !== permissionId)
          : [...current.permissionIds, permissionId],
    }));
  }

  function selectAllPermissions() {
    if (modalMode === "view") return;

    setForm((current) => ({
      ...current,
      permissionIds: permissions.map((permission) => permission.id),
    }));
  }

  function clearPermissions() {
    if (modalMode === "view") return;
    setForm((current) => ({ ...current, permissionIds: [] }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (modalMode === "view") {
      closeModal();
      return;
    }

    if (!form.name.trim()) {
      setFormError("Le nom du rôle est obligatoire.");
      return;
    }

    if (!form.code.trim()) {
      setFormError("Le code du rôle est obligatoire.");
      return;
    }

    setSaving(true);

    try {
      if (modalMode === "create") {
        const created = await createRole({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          description: form.description.trim() || undefined,
          permissionIds: form.permissionIds,
        });

        setRoles((current) => [...current, created].sort((a, b) =>
          Number(b.isSystem) - Number(a.isSystem) || a.name.localeCompare(b.name),
        ));
      } else if (editingRole) {
        const updated = await updateRole(editingRole.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          status: form.status,
          permissionIds: form.permissionIds,
        });

        setRoles((current) =>
          current.map((role) => (role.id === updated.id ? updated : role)),
        );
      }

      closeModal();
    } catch (requestError) {
      setFormError(
        getErrorMessage(
          requestError,
          "Impossible d'enregistrer le rôle.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(role: Role) {
    setOpenActionsId(null);

    if (role.isSystem && !isSuperAdmin) return;

    try {
      const updated = await updateRole(role.id, {
        status: role.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });

      setRoles((current) =>
        current.map((item) => (item.id === role.id ? updated : item)),
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Impossible de modifier le statut du rôle.",
        ),
      );
    }
  }

  async function handleDelete(role: Role) {
    setOpenActionsId(null);

    if (role.isSystem && !isSuperAdmin) return;

    const confirmed = window.confirm(
      `Supprimer définitivement le rôle "${role.name}" ? Cette action est irréversible.`,
    );

    if (!confirmed) return;

    setDeletingId(role.id);
    setError(null);

    try {
      await deleteRole(role.id);
      setRoles((current) => current.filter((item) => item.id !== role.id));
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Impossible de supprimer le rôle.",
        ),
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      className="space-y-6"
      onClick={() => setOpenActionsId(null)}
    >
      <PageHeader
        eyebrow="Administration"
        title="Rôles & permissions"
        description="Définissez les rôles et contrôlez les permissions accordées aux utilisateurs."
        actions={
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openCreateModal();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Plus size={16} strokeWidth={2} />
            Créer un rôle
          </button>
        }
      />

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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un rôle..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="text-xs font-medium text-slate-400">
            {filteredRoles.length} rôle{filteredRoles.length > 1 ? "s" : ""}
          </div>
        </div>

        {error ? (
          <div className="m-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Rôle</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Utilisateurs</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Permissions</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Statut</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
                    Chargement des rôles...
                  </td>
                </tr>
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
                    Aucun rôle trouvé.
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role) => (
                  <RoleRow
                    key={role.id}
                    role={role}
                    actionOpen={openActionsId === role.id}
                    deleting={deletingId === role.id}
                    onToggleActions={() =>
                      setOpenActionsId((current) =>
                        current === role.id ? null : role.id,
                      )
                    }
                    canManageSystemRole={isSuperAdmin}
                    onView={() => void openRoleModal(role, "view")}
                    onEdit={() => void openRoleModal(role, "edit")}
                    onToggleStatus={() => void handleToggleStatus(role)}
                    onDelete={() => void handleDelete(role)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RoleSummary label="Total rôles" value={String(totalRoles)} icon={ShieldCheck} />
        <RoleSummary label="Rôles actifs" value={String(activeRoles)} icon={CheckCircle2} positive />
        <RoleSummary label="Rôles inactifs" value={String(inactiveRoles)} icon={ShieldOff} />
        <RoleSummary label="Rôles système" value={String(systemRoles)} icon={ShieldCheck} />
      </section>

      {modalMode ? (
        <RoleModal
          mode={modalMode}
          role={editingRole}
          form={form}
          permissions={permissions}
          permissionGroups={permissionGroups}
          canManageSystemRole={isSuperAdmin}
          error={formError}
          saving={saving}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onChange={(field, value) =>
            setForm((current) => ({ ...current, [field]: value }))
          }
          onTogglePermission={togglePermission}
          onSelectAll={selectAllPermissions}
          onClearAll={clearPermissions}
        />
      ) : null}
    </div>
  );
}

function RoleRow({
  role,
  actionOpen,
  deleting,
  canManageSystemRole,
  onToggleActions,
  onView,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  role: Role;
  actionOpen: boolean;
  deleting: boolean;
  canManageSystemRole: boolean;
  onToggleActions: () => void;
  onView: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const active = role.status === "ACTIVE";
  const systemEditable = role.isSystem && canManageSystemRole;
  const protectedSuperAdmin = role.code.toUpperCase() === "SUPER_ADMIN";

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            role.isSystem ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600",
          ].join(" ")}>
            <ShieldCheck size={17} strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-800">{role.name}</p>
              {role.isSystem ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                  Système
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 max-w-md truncate text-xs text-slate-400">
              {role.description ?? "Aucune description."}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Users size={15} strokeWidth={1.8} />
          </div>
          <span className="text-sm font-semibold text-slate-700">{role.userCount}</span>
        </div>
      </td>

      <td className="px-5 py-4">
        <span className="inline-flex items-center rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
          {role.permissionCount} permission{role.permissionCount > 1 ? "s" : ""}
        </span>
      </td>

      <td className="px-5 py-4">
        <span className={[
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide",
          active ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500",
        ].join(" ")}>
          <span className={[
            "h-1.5 w-1.5 rounded-full",
            active ? "bg-emerald-500" : "bg-red-500",
          ].join(" ")} />
          {active ? "ACTIF" : "INACTIF"}
        </span>
      </td>

      <td className="relative px-5 py-4 text-right">
        <button
          type="button"
          aria-label={`Actions pour le rôle ${role.name}`}
          aria-expanded={actionOpen}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleActions();
          }}
          onMouseDown={(event) => event.stopPropagation()}
          disabled={deleting}
          className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MoreHorizontal size={18} />
        </button>

        {actionOpen ? (
          <div
            className="absolute right-5 top-12 z-30 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={role.isSystem && !systemEditable ? onView : onEdit}
              className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
              {role.isSystem && !systemEditable ? "Voir les permissions" : "Modifier"}
            </button>
            {!role.isSystem || systemEditable ? (
              <>
                <button type="button" onClick={onToggleStatus}
                  className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {active ? "Désactiver" : "Activer"}
                </button>
                {!protectedSuperAdmin ? (
                  <button type="button" onClick={onDelete}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50">
                    Supprimer
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function RoleModal({
  mode,
  role,
  form,
  permissions,
  permissionGroups,
  canManageSystemRole,
  error,
  saving,
  onClose,
  onSubmit,
  onChange,
  onTogglePermission,
  onSelectAll,
  onClearAll,
}: {
  mode: ModalMode;
  role: Role | null;
  form: RoleFormState;
  permissions: Permission[];
  permissionGroups: Record<string, Permission[]>;
  canManageSystemRole: boolean;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof RoleFormState>(field: K, value: RoleFormState[K]) => void;
  onTogglePermission: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  const viewOnly = mode === "view";
  const canEditSystemRole = Boolean(role?.isSystem && canManageSystemRole);
  const title = mode === "create"
    ? "Créer un rôle"
    : viewOnly
      ? "Permissions du rôle"
      : "Modifier le rôle";

  const subtitle = mode === "create"
    ? "Créez un rôle personnalisé et choisissez précisément ses permissions."
    : role
      ? `Configuration de ${role.name}.`
      : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Administration
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="max-h-[calc(92vh-90px)] overflow-y-auto">
          <div className="space-y-5 px-6 py-6">
            {error ? (
              <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Nom du rôle"
                value={form.name}
                onChange={(value) => {
                  onChange("name", value);
                  if (mode === "create") onChange("code", slugToCode(value));
                }}
                placeholder="Ex. Responsable commercial"
                disabled={viewOnly || (role?.isSystem === true && !canEditSystemRole)}
                required
              />
              <FormField
                label="Code"
                value={form.code}
                onChange={(value) => onChange("code", value.toUpperCase())}
                placeholder="RESPONSABLE_COMMERCIAL"
                disabled={viewOnly || role?.isSystem === true}
                required
              />
            </div>

            <FormField
              label="Description"
              value={form.description}
              onChange={(value) => onChange("description", value)}
              placeholder="Décrivez les responsabilités de ce rôle."
              disabled={viewOnly || role?.isSystem === true}
            />

            {mode === "edit" ? (
              <div className="max-w-xs">
                <SelectField
                  label="Statut"
                  value={form.status}
                  onChange={(value) => onChange("status", value as RoleStatus)}
                  disabled={viewOnly || role?.isSystem === true}
                  options={[
                    { value: "ACTIVE", label: "Actif" },
                    { value: "INACTIVE", label: "Inactif" },
                    { value: "ARCHIVED", label: "Archivé" },
                  ]}
                />
              </div>
            ) : null}

            <div className="border-t border-slate-100 pt-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Permissions</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {form.permissionIds.length} sélectionnée{form.permissionIds.length > 1 ? "s" : ""} sur {permissions.length}
                  </p>
                </div>
                {!viewOnly && (!role?.isSystem || canEditSystemRole) ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={onSelectAll}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                      Tout sélectionner
                    </button>
                    <button type="button" onClick={onClearAll}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                      Tout retirer
                    </button>
                  </div>
                ) : null}
              </div>

              {permissions.length === 0 ? (
                <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                  Aucune permission disponible.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {Object.keys(permissionGroups).map((resource) => {
                    const items: Permission[] = permissionGroups[resource];
                    return (
                      <div key={resource} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                          {resource}
                        </p>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {items.filter((item) => form.permissionIds.indexOf(item.id) !== -1).length}/{items.length}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {items.map((permission) => {
                          const checked = form.permissionIds.indexOf(permission.id) !== -1;

                          return (
                            <label
                              key={permission.id}
                              className={[
                                "flex items-start gap-3 rounded-lg border px-3 py-2.5",
                                viewOnly
                                  ? "cursor-default"
                                  : "cursor-pointer hover:bg-slate-50",
                                checked
                                  ? "border-slate-300 bg-slate-50"
                                  : "border-slate-100",
                              ].join(" ")}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onTogglePermission(permission.id)}
                                disabled={viewOnly || (role?.isSystem === true && !canEditSystemRole)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-slate-950"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-slate-700">
                                  {permission.name}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-slate-400">
                                  {permission.description ?? permission.code}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              {viewOnly ? "Fermer" : "Annuler"}
            </button>
            {!viewOnly ? (
              <button type="submit" disabled={saving}
                className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? "Enregistrement..." : mode === "create" ? "Créer le rôle" : "Enregistrer les modifications"}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function RoleSummary({
  label,
  value,
  icon: Icon,
  positive,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-950">{value}</p>
        </div>
        <div className={[
          "flex h-9 w-9 items-center justify-center rounded-lg",
          positive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600",
        ].join(" ")}>
          <Icon size={17} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}
