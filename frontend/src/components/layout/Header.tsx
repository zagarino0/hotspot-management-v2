import {
  Bell,
  ChevronDown,
  Menu,
  UserCircle,
} from "lucide-react";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({
  onMenuClick,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center border-b border-slate-200 bg-white px-4 sm:px-5 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* MOBILE MENU */}
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu size={21} strokeWidth={1.9} />
        </button>

        {/* ORGANIZATION */}
        <button
          type="button"
          className="hidden items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50 sm:flex"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-xs font-bold text-white">
            NS
          </div>

          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
              Organisation
            </div>

            <div className="flex items-center gap-1">
              <span className="max-w-40 truncate text-sm font-semibold text-slate-800">
                NetConnect Solutions
              </span>

              <ChevronDown
                size={14}
                className="text-slate-400"
              />
            </div>
          </div>
        </button>

        <div className="hidden h-7 w-px bg-slate-200 sm:block" />

        {/* ACTIVE SITE */}
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>

          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
              Site actif
            </div>

            <div className="flex items-center gap-1">
              <span className="max-w-40 truncate text-sm font-semibold text-slate-800">
                WIFI MAHAVOKY
              </span>

              <ChevronDown
                size={14}
                className="text-slate-400"
              />
            </div>
          </div>
        </button>
      </div>

      {/* RIGHT ACTIONS */}
      <div className="flex items-center gap-1.5">
        {/* API STATUS */}
        <div className="hidden items-center gap-2 rounded-lg px-3 py-2 md:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />

          <span className="text-xs font-medium text-slate-500">
            API Online
          </span>
        </div>

        {/* NOTIFICATIONS */}
        <button
          type="button"
          className="relative rounded-lg p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          aria-label="Notifications"
        >
          <Bell
            size={19}
            strokeWidth={1.9}
          />

          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>

        <div className="mx-1 h-7 w-px bg-slate-200" />

        {/* USER */}
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
        >
          <UserCircle
            size={31}
            strokeWidth={1.6}
            className="text-slate-400"
          />

          <div className="hidden text-left md:block">
            <div className="text-sm font-semibold text-slate-800">
              Administrator
            </div>

            <div className="text-[11px] text-slate-400">
              Super Admin
            </div>
          </div>

          <ChevronDown
            size={15}
            className="hidden text-slate-400 md:block"
          />
        </button>
      </div>
    </header>
  );
}