import {
  Bell,
  Menu,
  Search,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

interface TopbarProps {
  onMenuClick?: () => void;
}

export default function Topbar({
  onMenuClick,
}: TopbarProps) {
  const { user, logout } = useAuth();

  const [profileOpen, setProfileOpen] = useState(false);

  const displayName =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(" ") || user?.username || "Utilisateur";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      {/* Left */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>

        <div className="hidden items-center gap-2 md:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />

          <span className="text-xs font-medium text-slate-500">
            Système opérationnel
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button
          type="button"
          className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:block"
          aria-label="Rechercher"
        >
          <Search size={19} />
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Notifications"
        >
          <Bell size={19} />

          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        {/* Separator */}
        <div className="mx-1 hidden h-7 w-px bg-slate-200 sm:block" />

        {/* Profile */}
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setProfileOpen((current) => !current)
            }
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {getInitials(displayName)}
            </div>

            <div className="hidden text-left sm:block">
              <p className="max-w-32 truncate text-xs font-semibold text-slate-800">
                {displayName}
              </p>

              <p className="text-[11px] text-slate-500">
                {user?.roles?.[0]?.code ?? "USER"}
              </p>
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {displayName}
                </p>

                <p className="truncate text-xs text-slate-500">
                  {user?.email ?? user?.username}
                </p>
              </div>

              <button
                type="button"
                onClick={logout}
                className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}
