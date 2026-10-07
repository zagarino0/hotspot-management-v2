import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Menu,
  UserCircle,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getSites, type Site } from "../../services/siteService";
import { fetchSessions } from "../../services/sessionService";
import { getDashboardOverview } from "../../services/statisticsService";

interface HeaderProps {
  onMenuClick?: () => void;
}

interface HeaderNotification {
  id: string;
  type: "SESSION" | "NETWORK" | "API";
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
}

function formatNotificationTime(date: Date) {
  return date.toLocaleTimeString("fr-MG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSiteStatusLabel(site: Site) {
  if (site.status === "ACTIVE") return "Actif";
  if (site.status === "SUSPENDED") return "Suspendu";
  if (site.status === "INACTIVE") return "Inactif";
  return "Archivé";
}

export default function Header({
  onMenuClick,
}: HeaderProps) {
  const { user } = useAuth();

  const [sites, setSites] = useState<Site[]>([]);
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSites() {
      try {
        const nextSites = await getSites();
        if (active) {
          setSites(nextSites);
        }
      } catch {
        if (active) {
          setApiAvailable(false);
        }
      }
    }

    void loadSites();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let initialized = false;
    let previousSessionIds = new Set<string>();
    let previousNetworkStatus: string | null = null;
    let previousApiAvailable: boolean | null = null;

    const addNotification = (
      notification: Omit<HeaderNotification, "id" | "createdAt" | "read">
    ) => {
      if (!active) return;

      setNotifications((current) => [
        {
          ...notification,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          createdAt: new Date(),
          read: false,
        },
        ...current,
      ].slice(0, 20));
    };

    async function checkStatus() {
      try {
        const [activeSessions, overview] = await Promise.all([
          fetchSessions("ACTIVE"),
          getDashboardOverview(7),
        ]);

        if (!active) return;

        setApiAvailable(true);

        const currentSessionIds = new Set(
          activeSessions.map((session) => session.id)
        );

        const currentNetworkStatus =
          overview.networkStatus[0]?.status ?? "UNKNOWN";

        if (initialized) {
          const newSessions = activeSessions.filter(
            (session) => !previousSessionIds.has(session.id)
          );

          for (const session of newSessions.slice(0, 5)) {
            addNotification({
              type: "SESSION",
              title: "Nouvelle session",
              message: session.username
                ? `Session ouverte pour ${session.username}.`
                : "Une nouvelle session MikroTik vient d'être détectée.",
            });
          }

          if (
            previousNetworkStatus === "ONLINE" &&
            currentNetworkStatus !== "ONLINE"
          ) {
            addNotification({
              type: "NETWORK",
              title: "Problème réseau",
              message: "Le MikroTik n'est plus signalé comme en ligne.",
            });
          }

          if (
            previousNetworkStatus !== null &&
            previousNetworkStatus !== "ONLINE" &&
            currentNetworkStatus === "ONLINE"
          ) {
            addNotification({
              type: "NETWORK",
              title: "Réseau rétabli",
              message: "Le MikroTik est de nouveau en ligne.",
            });
          }

          if (previousApiAvailable === false) {
            addNotification({
              type: "API",
              title: "API rétablie",
              message: "La connexion à l'API est de nouveau disponible.",
            });
          }
        }

        previousSessionIds = currentSessionIds;
        previousNetworkStatus = currentNetworkStatus;
        previousApiAvailable = true;
        initialized = true;
      } catch {
        if (!active) return;

        setApiAvailable(false);

        if (initialized && previousApiAvailable !== false) {
          addNotification({
            type: "API",
            title: "Problème de connexion",
            message: "L'API ou la connexion au MikroTik est inaccessible.",
          });
        }

        previousApiAvailable = false;
        initialized = true;
      }
    }

    void checkStatus();
    const intervalId = window.setInterval(() => {
      void checkStatus();
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username
    : "Utilisateur";
  const roleName = user?.roles[0]?.name ?? "Aucun rôle";
  const unreadCount = notifications.filter((notification) => !notification.read).length;

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
              Compte connecté
            </div>

            <div className="flex items-center gap-1">
              <span className="max-w-40 truncate text-sm font-semibold text-slate-800">
                {user?.username ?? "—"}
              </span>

              <ChevronDown size={14} className="text-slate-400" />
            </div>
          </div>
        </button>

        <div className="hidden h-7 w-px bg-slate-200 sm:block" />

        {/* SITES CONFIGURÉS */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSiteMenuOpen((open) => !open)}
            className="flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
            aria-expanded={siteMenuOpen}
            aria-haspopup="menu"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>

            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
                Sites configurés
              </div>

              <div className="flex items-center gap-1">
                <span className="max-w-40 truncate text-sm font-semibold text-slate-800">
                  {sites.length.toLocaleString("fr-MG")}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 transition-transform ${siteMenuOpen ? "rotate-180" : ""}`}
                />
              </div>
            </div>
          </button>

          {siteMenuOpen ? (
            <div
              role="menu"
              className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Sites configurés</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {sites.length} site{sites.length > 1 ? "s" : ""} enregistré{sites.length > 1 ? "s" : ""}
                </p>
              </div>

              <div className="max-h-72 overflow-y-auto p-2">
                {sites.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-slate-500">
                    Aucun site configuré.
                  </div>
                ) : (
                  sites.map((site) => (
                    <div
                      key={site.id}
                      role="menuitem"
                      className="rounded-lg px-3 py-3 hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {site.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {site.code}{site.city ? ` · ${site.city}` : ""}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${site.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"}`}
                        >
                          {getSiteStatusLabel(site)}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-4 text-[11px] text-slate-400">
                        <span>{site.routerCount} routeur{site.routerCount > 1 ? "s" : ""}</span>
                        <span>{site.accessPointCount} AP</span>
                        <span>{site.clientCount} client{site.clientCount > 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* RIGHT ACTIONS */}
      <div className="flex items-center gap-1.5">
        {/* API STATUS */}
        <div className="hidden items-center gap-2 rounded-lg px-3 py-2 md:flex">
          <span
            className={`h-2 w-2 rounded-full ${
              apiAvailable === true
                ? "bg-emerald-500"
                : apiAvailable === false
                  ? "bg-rose-500"
                  : "bg-slate-300"
            }`}
          />

          <span className="text-xs font-medium text-slate-500">
            {apiAvailable === true
              ? "API disponible"
              : apiAvailable === false
                ? "API inaccessible"
                : "API en cours de vérification"}
          </span>
        </div>

        {/* NOTIFICATIONS */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((open) => !open);
              if (!notificationsOpen) {
                setNotifications((current) =>
                  current.map((notification) => ({ ...notification, read: true }))
                );
              }
            }}
            className="relative rounded-lg p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lue${unreadCount > 1 ? "s" : ""})` : ""}`}
            aria-expanded={notificationsOpen}
          >
            <Bell size={19} strokeWidth={1.9} />
            {unreadCount > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>

          {notificationsOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Notifications</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Sessions et état du réseau
                  </p>
                </div>
                {notifications.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setNotifications([])}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Effacer les notifications"
                  >
                    <X size={15} />
                  </button>
                ) : null}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500" />
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      Aucun signal
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Les nouvelles sessions et problèmes réseau seront signalés ici.
                    </p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`flex gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 ${
                        notification.read ? "bg-white" : "bg-slate-50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 rounded-lg p-2 ${
                          notification.type === "SESSION"
                            ? "bg-indigo-50 text-indigo-600"
                            : notification.type === "API"
                              ? "bg-rose-50 text-rose-600"
                              : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {notification.type === "SESSION" ? (
                          <Bell size={15} />
                        ) : (
                          <WifiOff size={15} />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">
                            {notification.title}
                          </p>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {formatNotificationTime(notification.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

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
              {displayName}
            </div>

            <div className="text-[11px] text-slate-400">
              {roleName}
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
