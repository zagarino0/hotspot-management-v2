import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Network,
  Router,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  Wifi,
  X,
  LogOut,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
}
const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Sites",
    path: "/sites",
    icon: MapPin,
  },
  {
    label: "Routeurs",
    path: "/routers",
    icon: Router,
  },
  {
    label: "Points d'accès",
    path: "/access-points",
    icon: Wifi,
  },
  {
    label: "Clients",
    path: "/clients",
    icon: Users,
  },
  {
    label: "Sessions",
    path: "/sessions",
    icon: Activity,
  },
  {
    label: "Vouchers",
    path: "/vouchers",
    icon: Ticket,
  },
  {
    label: "Ventes",
    path: "/billing/sales",
    icon: CreditCard,
  },
  {
    label: "Statistiques",
    path: "/statistics",
    icon: BarChart3,
  },
];

const administration: NavigationItem[] = [
  {
    label: "Utilisateurs",
    path: "/users",
    icon: Users,
  },
  {
    label: "Rôles & permissions",
    path: "/roles",
    icon: ShieldCheck,
  },
  {
    label: "Infrastructure",
    path: "/infrastructure",
    icon: Network,
  },
  {
    label: "Paramètres",
    path: "/settings",
    icon: Settings,
  },
];

export default function Sidebar({
  mobileOpen = false,
  onClose,
}: SidebarProps) {
  const { user, logout } = useAuth();

  const displayName =
    user?.firstName || user?.lastName
      ? `${user.firstName ?? ""} ${
          user.lastName ?? ""
        }`.trim()
      : user?.username ?? "Utilisateur";

  const roleName =
    user?.roles?.[0]?.name ?? "Utilisateur";

  return (
    <>
      {/* MOBILE OVERLAY */}
      <div
        className={[
          "fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px]",
          "transition-opacity duration-300 lg:hidden",
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={onClose}
        aria-hidden={!mobileOpen}
      />

      {/* SIDEBAR */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col",
          "border-r border-slate-200 bg-white text-slate-900",
          "shadow-[4px_0_20px_rgba(15,23,42,0.03)]",
          "transition-transform duration-300 ease-in-out",
          "lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full",
        ].join(" ")}
      >
        {/* BRAND */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Network size={19} strokeWidth={2} />
            </div>

            <div>
              <div className="text-sm font-bold tracking-[0.08em] text-slate-950">
                HOTSPOT
              </div>

              <div className="text-[10px] font-medium tracking-[0.16em] text-slate-400">
                MANAGEMENT V2
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Fermer le menu"
          >
            <X size={19} />
          </button>
        </div>

        {/* ORGANIZATION */}
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
                <Network size={17} strokeWidth={1.8} />
              </div>

              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-slate-800">
                  Hotspot Management
                </div>

                <div className="mt-0.5 text-[10px] text-slate-400">
                  Organisation
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <NavigationSection
            title="Vue générale"
            items={navigation}
            onNavigate={onClose}
          />

          <div className="my-5 border-t border-slate-200" />

          <NavigationSection
            title="Administration"
            items={administration}
            onNavigate={onClose}
          />
        </nav>

        {/* USER */}
        <div className="shrink-0 border-t border-slate-200 p-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
              {getInitials(displayName)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-800">
                {displayName}
              </div>

              <div className="mt-0.5 truncate text-[10px] text-slate-400">
                {roleName}
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              title="Déconnexion"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-red-500"
            >
              <LogOut size={17} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ============================================================
   NAVIGATION SECTION
============================================================ */

interface NavigationSectionProps {
  title: string;
  items: NavigationItem[];
  onNavigate?: () => void;
}

function NavigationSection({
  title,
  items,
  onNavigate,
}: NavigationSectionProps) {
  return (
    <div>
      <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </div>

      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5",
                  "text-sm transition-all duration-150",
                  isActive
                    ? "bg-slate-100 font-semibold text-slate-950"
                    : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={17}
                    strokeWidth={isActive ? 2.1 : 1.8}
                    className={
                      isActive
                        ? "text-slate-950"
                        : "text-slate-400 group-hover:text-slate-700"
                    }
                  />

                  <span className="truncate">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   HELPERS
============================================================ */

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
