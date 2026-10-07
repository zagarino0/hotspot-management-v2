import {
  CheckCircle2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  Users as UsersIcon,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import PageHeader from "../../components/ui/PageHeader";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
  updateUserRoles,
  type AppUser,
  type CreateUserPayload,
  type UserStatus,
} from "../../services/userService";
import { getRoles, type Role } from "../../services/roleService";

type ModalMode = "create" | "edit";

interface UserFormState {
  username: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  password: string;
  status: UserStatus;
  roleId: string;
}

const EMPTY_FORM: UserFormState = {
  username: "",
  email: "",
  phone: "",
  firstName: "",
  lastName: "",
  password: "",
  status: "ACTIVE",
  roleId: "",
};

function formatLastLogin(value: string | null): string {
  if (!value) return "Jamais";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffHours < 1) return "À l'instant";
  if (diffHours < 24) return `Il y a ${diffHours} h`;

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getDisplayName(user: AppUser): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username
  );
}

function getRoleName(user: AppUser): string {
  return user.roles[0]?.name ?? "Aucun rôle";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getStatusLabel(status: UserStatus): string {
  switch (status) {
    case "ACTIVE":
      return "ACTIF";
    case "INVITED":
      return "INVITÉ";
    case "SUSPENDED":
      return "SUSPENDU";
    case "DISABLED":
      return "DÉSACTIVÉ";
    case "ARCHIVED":
      return "ARCHIVÉ";
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
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
        const [usersResult, rolesResult] = await Promise.all([
          getUsers(),
          getRoles(),
        ]);

        if (active) {
          setUsers(usersResult);
          setRoles(rolesResult);
        }
      } catch (requestError) {
        if (active) {
          setError(
            getErrorMessage(
              requestError,
              "Impossible de charger les données des utilisateurs.",
            ),
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return users;

    return users.filter((user) => {
      const haystack = [
        getDisplayName(user),
        user.username,
        user.email ?? "",
        user.phone ?? "",
        ...user.roles.map((role) => role.name),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [search, users]);

  const totalUsers = users.length;
  const activeUsers = users.filter(
    (user) => user.status === "ACTIVE",
  ).length;
  const inactiveUsers = users.filter(
    (user) => user.status !== "ACTIVE",
  ).length;
  const administrators = users.filter((user) =>
    user.roles.some((role) =>
      role.name.toLowerCase().includes("admin"),
    ),
  ).length;

  function openCreateModal() {
    setEditingUser(null);
    setForm({
      ...EMPTY_FORM,
      roleId: roles[0]?.id ?? "",
    });
    setFormError(null);
    setModalMode("create");
    setOpenActionsId(null);
  }

  function openEditModal(user: AppUser) {
    setEditingUser(user);
    setForm({
      username: user.username,
      email: user.email ?? "",
      phone: user.phone ?? "",
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      password: "",
      status: user.status,
      roleId: user.roles[0]?.id ?? "",
    });
    setFormError(null);
    setModalMode("edit");
    setOpenActionsId(null);
  }

  function closeModal() {
    setModalMode(null);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (modalMode === "create" && !form.username.trim()) {
      setFormError("L'identifiant est obligatoire.");
      return;
    }

    if (modalMode === "create" && form.password.length < 8) {
      setFormError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setSaving(true);

    try {
      if (modalMode === "create") {
        const payload: CreateUserPayload = {
          username: form.username.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          password: form.password,
          status: form.status,
          roleIds: form.roleId ? [form.roleId] : [],
        };

        const created = await createUser(payload);
        setUsers((current) => [created, ...current]);
      } else if (editingUser) {
        const updated = await updateUser(editingUser.id, {
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          firstName: form.firstName.trim() || null,
          lastName: form.lastName.trim() || null,
          status: form.status,
          password: form.password || undefined,
        });

        let finalUser = updated;

        if (form.roleId !== (editingUser.roles[0]?.id ?? "")) {
          finalUser = await updateUserRoles(
            editingUser.id,
            form.roleId ? [form.roleId] : [],
          );
        }

        setUsers((current) =>
          current.map((user) =>
            user.id === editingUser.id ? finalUser : user,
          ),
        );
      }

      closeModal();
    } catch (requestError) {
      setFormError(
        getErrorMessage(
          requestError,
          "Impossible d'enregistrer l'utilisateur.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(user: AppUser) {
    setOpenActionsId(null);

    const nextStatus: UserStatus =
      user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";

    try {
      const updated = await updateUser(user.id, {
        status: nextStatus,
      });

      setUsers((current) =>
        current.map((item) =>
          item.id === user.id ? updated : item,
        ),
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Impossible de modifier le statut de l'utilisateur.",
        ),
      );
    }
  }

  async function handleDelete(user: AppUser) {
    setOpenActionsId(null);

    const name = getDisplayName(user);
    const confirmed = window.confirm(
      `Supprimer définitivement l'utilisateur "${name}" ? Cette action est irréversible.`,
    );

    if (!confirmed) return;

    setDeletingId(user.id);
    setError(null);

    try {
      await deleteUser(user.id);
      setUsers((current) =>
        current.filter((item) => item.id !== user.id),
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Impossible de supprimer l'utilisateur.",
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
        title="Utilisateurs"
        description="Gérez les comptes ayant accès à la plateforme Hotspot Management V2."
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
            Ajouter un utilisateur
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
              placeholder="Rechercher un utilisateur..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="text-xs font-medium text-slate-400">
            {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? "s" : ""}
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
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Utilisateur
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Rôle
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Statut
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Dernière connexion
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
                    Chargement des utilisateurs...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-sm text-slate-400"
                  >
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    actionOpen={openActionsId === user.id}
                    deleting={deletingId === user.id}
                    onToggleActions={() =>
                      setOpenActionsId((current) =>
                        current === user.id ? null : user.id,
                      )
                    }
                    onEdit={() => openEditModal(user)}
                    onToggleStatus={() => void handleToggleStatus(user)}
                    onDelete={() => void handleDelete(user)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UserSummary
          label="Total utilisateurs"
          value={String(totalUsers)}
          icon={UsersIcon}
        />
        <UserSummary
          label="Utilisateurs actifs"
          value={String(activeUsers)}
          icon={CheckCircle2}
          positive
        />
        <UserSummary
          label="Utilisateurs inactifs"
          value={String(inactiveUsers)}
          icon={XCircle}
          negative
        />
        <UserSummary
          label="Administrateurs"
          value={String(administrators)}
          icon={ShieldCheck}
        />
      </section>

      {modalMode ? (
        <UserModal
          mode={modalMode}
          user={editingUser}
          form={form}
          roles={roles}
          error={formError}
          saving={saving}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onChange={(field, value) =>
            setForm((current) => ({
              ...current,
              [field]: value,
            }))
          }
        />
      ) : null}
    </div>
  );
}

function UserRow({
  user,
  actionOpen,
  deleting,
  onToggleActions,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  user: AppUser;
  actionOpen: boolean;
  deleting: boolean;
  onToggleActions: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const name = getDisplayName(user);
  const role = getRoleName(user);
  const active = user.status === "ACTIVE";

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
            {getInitials(name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {name}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              @{user.username}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {user.email ?? "E-mail non renseigné"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            {role.toLowerCase().includes("admin") ? (
              <ShieldCheck size={15} strokeWidth={1.8} />
            ) : (
              <UserCog size={15} strokeWidth={1.8} />
            )}
          </div>
          <span className="text-sm font-medium text-slate-600">
            {role}
          </span>
        </div>
      </td>

      <td className="px-5 py-4">
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
            "text-[10px] font-bold tracking-wide",
            active
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-500",
          ].join(" ")}
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              active ? "bg-emerald-500" : "bg-red-500",
            ].join(" ")}
          />
          {getStatusLabel(user.status)}
        </span>
      </td>

      <td className="px-5 py-4">
        <span className="text-sm font-medium text-slate-600">
          {formatLastLogin(user.lastLoginAt)}
        </span>
      </td>

      <td className="relative px-5 py-4 text-right">
        <button
          type="button"
          aria-label={`Actions pour ${name}`}
          aria-expanded={actionOpen}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleActions();
          }}
          onMouseDown={(event) => event.stopPropagation()}
          disabled={deleting}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MoreHorizontal size={18} />
        </button>

        {actionOpen ? (
          <div
            className="absolute right-5 top-12 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onEdit}
              className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={onToggleStatus}
              className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {active ? "Désactiver" : "Activer"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function UserModal({
  mode,
  user,
  form,
  roles,
  error,
  saving,
  onClose,
  onSubmit,
  onChange,
}: {
  mode: ModalMode;
  user: AppUser | null;
  form: UserFormState;
  roles: Role[];
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (
    field: keyof UserFormState,
    value: string,
  ) => void;
}) {
  const editing = mode === "edit";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Administration
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
              {editing ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {editing
                ? `Mettez à jour le compte de ${getDisplayName(user!)}.`
                : "Créez un compte et attribuez-lui un rôle."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
          {error ? (
            <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Prénom"
              value={form.firstName}
              onChange={(value) => onChange("firstName", value)}
              placeholder="Prénom"
            />
            <FormField
              label="Nom"
              value={form.lastName}
              onChange={(value) => onChange("lastName", value)}
              placeholder="Nom"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Identifiant"
              value={form.username}
              onChange={(value) => onChange("username", value)}
              placeholder="identifiant"
              disabled={editing}
              required
            />
            <FormField
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(value) => onChange("email", value)}
              placeholder="email@exemple.com"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Téléphone"
              value={form.phone}
              onChange={(value) => onChange("phone", value)}
              placeholder="+261 ..."
            />
            <FormField
              label={editing ? "Nouveau mot de passe" : "Mot de passe"}
              type="password"
              value={form.password}
              onChange={(value) => onChange("password", value)}
              placeholder={editing ? "Laisser vide pour conserver" : "8 caractères minimum"}
              required={!editing}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Rôle"
              value={form.roleId}
              onChange={(value) => onChange("roleId", value)}
              options={roles.map((role) => ({
                value: role.id,
                label: role.name,
              }))}
              placeholder="Aucun rôle"
            />
            <SelectField
              label="Statut"
              value={form.status}
              onChange={(value) =>
                onChange("status", value as UserStatus)
              }
              options={[
                { value: "ACTIVE", label: "Actif" },
                { value: "INVITED", label: "Invité" },
                { value: "SUSPENDED", label: "Suspendu" },
                { value: "DISABLED", label: "Désactivé" },
                { value: "ARCHIVED", label: "Archivé" },
              ]}
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Enregistrement..."
                : editing
                  ? "Enregistrer les modifications"
                  : "Créer l'utilisateur"}
            </button>
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
  type = "text",
  disabled = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>
      <input
        type={type}
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        {placeholder && !value ? (
          <option value="">{placeholder}</option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function UserSummary({
  label,
  value,
  icon: Icon,
  positive,
  negative,
}: {
  label: string;
  value: string;
  icon: typeof UsersIcon;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
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
