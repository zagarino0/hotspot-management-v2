import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users as UsersIcon,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import ActionMenu from "../../components/ui/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Modal from "../../components/ui/Modal";

import {
  deleteUser,
  getUsers,
  updateUser,
  type AppUser,
  type UserStatus,
} from "../../services/userService";

const STATUS_CONFIG: Record<
  UserStatus,
  { label: string; className: string; dot: string }
> = {
  ACTIVE: {
    label: "Actif",
    className: "bg-emerald-50 text-emerald-600",
    dot: "bg-emerald-500",
  },
  INVITED: {
    label: "Invité",
    className: "bg-blue-50 text-blue-600",
    dot: "bg-blue-500",
  },
  SUSPENDED: {
    label: "Suspendu",
    className: "bg-amber-50 text-amber-600",
    dot: "bg-amber-500",
  },
  DISABLED: {
    label: "Désactivé",
    className: "bg-slate-100 text-slate-500",
    dot: "bg-slate-400",
  },
  ARCHIVED: {
    label: "Archivé",
    className: "bg-slate-100 text-slate-400",
    dot: "bg-slate-300",
  },
};

function formatLastLogin(iso: string | null): string {
  if (!iso) return "Jamais connecté";

  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24) {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("fr-FR");
}

export default function Users() {
  const navigate = useNavigate();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editingUser, setEditingUser] =
    useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    status: "ACTIVE" as UserStatus,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(
    null
  );

  const [deletingUser, setDeletingUser] =
    useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<
    string | null
  >(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error(
        "Erreur lors du chargement des utilisateurs :",
        err
      );

      setError("Impossible de charger les utilisateurs.");
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
      return users;
    }

    return users.filter((u) =>
      [
        u.username,
        u.email,
        u.firstName,
        u.lastName,
        ...u.roles.map((r) => r.name),
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    );
  }, [users, search]);

  const activeUsers = users.filter(
    (u) => u.status === "ACTIVE"
  ).length;

  const inactiveUsers = users.length - activeUsers;

  const adminCount = users.filter((u) =>
    u.roles.some(
      (r) => ["SUPER_ADMIN", "ADMIN"].indexOf(r.code) !== -1
    )
  ).length;

  function openEdit(user: AppUser) {
    setEditingUser(user);
    setEditForm({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      status: user.status,
    });
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editingUser) return;

    setSavingEdit(true);
    setEditError(null);

    try {
      await updateUser(editingUser.id, {
        firstName: editForm.firstName.trim() || null,
        lastName: editForm.lastName.trim() || null,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        status: editForm.status,
      });

      setEditingUser(null);
      await load();
    } catch (err: any) {
      setEditError(
        err?.response?.data?.message ??
          "Impossible de mettre à jour cet utilisateur."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingUser) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteUser(deletingUser.id);
      setDeletingUser(null);
      await load();
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.message ??
          "Impossible de supprimer cet utilisateur."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Utilisateurs"
        description="Gérez les comptes qui ont accès à la plateforme."
        actions={
          <button
            type="button"
            onClick={() => navigate("/users/new")}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Plus size={16} strokeWidth={2} />
            Ajouter un utilisateur
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {/* KPI */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UserSummary
          label="Total utilisateurs"
          value={String(users.length)}
          icon={UsersIcon}
        />

        <UserSummary
          label="Actifs"
          value={String(activeUsers)}
          icon={CheckCircle2}
          positive
        />

        <UserSummary
          label="Inactifs"
          value={String(inactiveUsers)}
          icon={XCircle}
        />

        <UserSummary
          label="Administrateurs"
          value={String(adminCount)}
          icon={ShieldCheck}
        />
      </section>

      {/* TABLE */}
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
              placeholder="Rechercher un utilisateur..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Utilisateur
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Rôle(s)
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Dernière connexion
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
                    Chargement des utilisateurs...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center"
                  >
                    <div className="text-sm font-semibold text-slate-600">
                      Aucun utilisateur trouvé
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      {search
                        ? "Aucun résultat pour cette recherche."
                        : "Commencez par ajouter votre premier utilisateur."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onEdit={() => openEdit(user)}
                    onDelete={() => {
                      setDeletingUser(user);
                      setDeleteError(null);
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* EDIT MODAL */}
      <Modal
        open={editingUser !== null}
        title="Modifier l'utilisateur"
        description={editingUser?.username}
        size="lg"
        onClose={() => setEditingUser(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingUser(null)}
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
                Prénom
              </span>
              <input
                type="text"
                value={editForm.firstName}
                onChange={(event) =>
                  setEditForm((f) => ({
                    ...f,
                    firstName: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Nom
              </span>
              <input
                type="text"
                value={editForm.lastName}
                onChange={(event) =>
                  setEditForm((f) => ({
                    ...f,
                    lastName: event.target.value,
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

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Statut
              </span>
              <select
                value={editForm.status}
                onChange={(event) =>
                  setEditForm((f) => ({
                    ...f,
                    status: event.target.value as UserStatus,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              >
                <option value="ACTIVE">Actif</option>
                <option value="INVITED">Invité</option>
                <option value="SUSPENDED">Suspendu</option>
                <option value="DISABLED">Désactivé</option>
                <option value="ARCHIVED">Archivé</option>
              </select>
            </label>
          </div>

          <p className="text-xs text-slate-400">
            Les rôles se gèrent depuis la page Rôles & permissions.
          </p>
        </div>

        {editError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {editError}
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRM */}
      <ConfirmDialog
        open={deletingUser !== null}
        title="Supprimer cet utilisateur ?"
        message={`"${deletingUser?.username}" perdra définitivement l'accès à la plateforme.`}
        confirmLabel="Supprimer"
        loading={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingUser(null)}
      />
    </div>
  );
}

/* ================================================================
   SUMMARY
================================================================ */

interface UserSummaryProps {
  label: string;
  value: string;
  icon: typeof UsersIcon;
  positive?: boolean;
}

function UserSummary({
  label,
  value,
  icon: Icon,
  positive,
}: UserSummaryProps) {
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

/* ================================================================
   ROW
================================================================ */

function UserRow({
  user,
  onEdit,
  onDelete,
}: {
  user: AppUser;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusInfo = STATUS_CONFIG[user.status];
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username;

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <UserCog size={16} strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {displayName}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {user.email ?? `@${user.username}`}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 ? (
            <span className="text-xs text-slate-400">
              Aucun rôle
            </span>
          ) : (
            user.roles.map((role) => (
              <span
                key={role.id}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
              >
                {role.name}
              </span>
            ))
          )}
        </div>
      </td>

      <td className="px-5 py-4 text-xs text-slate-500">
        {formatLastLogin(user.lastLoginAt)}
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
          ariaLabel={`Actions pour ${displayName}`}
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
