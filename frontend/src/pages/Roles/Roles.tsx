import {
  CheckCircle2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  Users,
} from "lucide-react";

import PageHeader from "../../components/ui/PageHeader";

interface RoleRowProps {
  name: string;
  description: string;
  users: number;
  permissions: number;
  status: "ACTIVE" | "INACTIVE";
  system?: boolean;
}

interface RoleSummaryProps {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
  positive?: boolean;
}

const roles: RoleRowProps[] = [
  {
    name: "Super Admin",
    description:
      "Accès complet à l'ensemble de la plateforme.",
    users: 1,
    permissions: 32,
    status: "ACTIVE",
    system: true,
  },
  {
    name: "Administrateur",
    description:
      "Gestion de l'infrastructure et des utilisateurs.",
    users: 1,
    permissions: 24,
    status: "ACTIVE",
    system: true,
  },
  {
    name: "Technicien",
    description:
      "Gestion technique des routeurs et points d'accès.",
    users: 1,
    permissions: 15,
    status: "ACTIVE",
  },
  {
    name: "Opérateur",
    description:
      "Gestion des clients, vouchers et ventes.",
    users: 0,
    permissions: 10,
    status: "ACTIVE",
  },
];

export default function Roles() {
  const totalRoles = roles.length;

  const activeRoles = roles.filter(
    (role) => role.status === "ACTIVE",
  ).length;

  const inactiveRoles = roles.filter(
    (role) => role.status === "INACTIVE",
  ).length;

  const systemRoles = roles.filter(
    (role) => role.system,
  ).length;

  return (
    <div className="space-y-6">
      {/* ============================================================
          PAGE HEADER
      ============================================================ */}

      <PageHeader
        eyebrow="Administration"
        title="Rôles & permissions"
        description="Définissez les rôles et contrôlez les permissions accordées aux utilisateurs."
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Plus size={16} strokeWidth={2} />
            Créer un rôle
          </button>
        }
      />

      {/* ============================================================
          ROLES TABLE
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
              placeholder="Rechercher un rôle..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="text-xs font-medium text-slate-400">
            {totalRoles} rôles
          </div>
        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Rôle
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Utilisateurs
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Permissions
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
              {roles.map((role) => (
                <RoleRow
                  key={role.name}
                  {...role}
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
        <RoleSummary
          label="Total rôles"
          value={String(totalRoles)}
          icon={ShieldCheck}
        />

        <RoleSummary
          label="Rôles actifs"
          value={String(activeRoles)}
          icon={CheckCircle2}
          positive
        />

        <RoleSummary
          label="Rôles inactifs"
          value={String(inactiveRoles)}
          icon={ShieldOff}
        />

        <RoleSummary
          label="Rôles système"
          value={String(systemRoles)}
          icon={ShieldCheck}
        />
      </section>
    </div>
  );
}

/* ================================================================
   ROLE ROW
================================================================ */

function RoleRow({
  name,
  description,
  users,
  permissions,
  status,
  system,
}: RoleRowProps) {
  const active = status === "ACTIVE";

  return (
    <tr className="group transition-colors hover:bg-slate-50/70">
      {/* ROLE */}

      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              system
                ? "bg-slate-950 text-white"
                : "bg-slate-100 text-slate-600",
            ].join(" ")}
          >
            <ShieldCheck
              size={17}
              strokeWidth={1.8}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-800">
                {name}
              </p>

              {system && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                  Système
                </span>
              )}
            </div>

            <p className="mt-0.5 max-w-md truncate text-xs text-slate-400">
              {description}
            </p>
          </div>
        </div>
      </td>

      {/* USERS */}

      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Users
              size={15}
              strokeWidth={1.8}
            />
          </div>

          <span className="text-sm font-semibold text-slate-700">
            {users}
          </span>
        </div>
      </td>

      {/* PERMISSIONS */}

      <td className="px-5 py-4">
        <span className="inline-flex items-center rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
          {permissions} permissions
        </span>
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

      {/* ACTIONS */}

      <td className="px-5 py-4 text-right">
        <button
          type="button"
          aria-label={`Actions pour le rôle ${name}`}
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
          <Icon
            size={17}
            strokeWidth={1.8}
          />
        </div>
      </div>
    </div>
  );
}