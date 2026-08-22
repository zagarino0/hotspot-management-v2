import {
  CheckCircle2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  Users as UsersIcon,
  XCircle,
} from "lucide-react";

import PageHeader from "../../components/ui/PageHeader";

interface UserRowProps {
  name: string;
  username: string;
  email: string;
  role: string;
  status: "ACTIVE" | "INACTIVE";
  lastLogin: string;
}

interface UserSummaryProps {
  label: string;
  value: string;
  icon: typeof UsersIcon;
  positive?: boolean;
  negative?: boolean;
}

const users: UserRowProps[] = [
  {
    name: "Zagarino",
    username: "zagarino",
    email: "zagarino@netconnect.local",
    role: "Super Admin",
    status: "ACTIVE",
    lastLogin: "Aujourd'hui",
  },
  {
    name: "Administrateur",
    username: "admin",
    email: "admin@netconnect.local",
    role: "Administrateur",
    status: "ACTIVE",
    lastLogin: "Aujourd'hui",
  },
  {
    name: "Technicien",
    username: "technicien",
    email: "technicien@netconnect.local",
    role: "Technicien",
    status: "ACTIVE",
    lastLogin: "Il y a 2 h",
  },
];

export default function Users() {
  const totalUsers = users.length;
  const activeUsers = users.filter(
    (user) => user.status === "ACTIVE",
  ).length;
  const inactiveUsers = users.filter(
    (user) => user.status === "INACTIVE",
  ).length;
  const administrators = users.filter(
    (user) =>
      user.role === "Super Admin" ||
      user.role === "Administrateur",
  ).length;

  return (
    <div className="space-y-6">
      {/* ============================================================
          PAGE HEADER
      ============================================================ */}

      <PageHeader
        eyebrow="Administration"
        title="Utilisateurs"
        description="Gérez les comptes ayant accès à la plateforme Hotspot Management V2."
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Plus size={16} strokeWidth={2} />
            Ajouter un utilisateur
          </button>
        }
      />

      {/* ============================================================
          USERS TABLE
      ============================================================ */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {/* TOOLBAR */}

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search
              size={16}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              placeholder="Rechercher un utilisateur..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="text-xs font-medium text-slate-400">
            {totalUsers} utilisateurs
          </div>
        </div>

        {/* TABLE */}

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
              {users.map((user) => (
                <UserRow
                  key={user.username}
                  {...user}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============================================================
          SUMMARY
      ============================================================ */}

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
    </div>
  );
}

/* ================================================================
   USER ROW
================================================================ */

function UserRow({
  name,
  username,
  email,
  role,
  status,
  lastLogin,
}: UserRowProps) {
  const active = status === "ACTIVE";

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      {/* USER */}

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
              @{username}
            </p>

            <p className="mt-0.5 truncate text-xs text-slate-400">
              {email}
            </p>
          </div>
        </div>
      </td>

      {/* ROLE */}

      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            {role === "Super Admin" ? (
              <ShieldCheck
                size={15}
                strokeWidth={1.8}
              />
            ) : (
              <UserCog
                size={15}
                strokeWidth={1.8}
              />
            )}
          </div>

          <span className="text-sm font-medium text-slate-600">
            {role}
          </span>
        </div>
      </td>

      {/* STATUS */}

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
              active
                ? "bg-emerald-500"
                : "bg-red-500",
            ].join(" ")}
          />

          {active ? "ACTIF" : "INACTIF"}
        </span>
      </td>

      {/* LAST LOGIN */}

      <td className="px-5 py-4">
        <span className="text-sm font-medium text-slate-600">
          {lastLogin}
        </span>
      </td>

      {/* ACTIONS */}

      <td className="px-5 py-4 text-right">
        <button
          type="button"
          aria-label={`Actions pour ${name}`}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <MoreHorizontal size={18} />
        </button>
      </td>
    </tr>
  );
}

/* ================================================================
   SUMMARY
================================================================ */

function UserSummary({
  label,
  value,
  icon: Icon,
  positive,
  negative,
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

/* ================================================================
   HELPERS
================================================================ */

function getInitials(name: string): string {
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