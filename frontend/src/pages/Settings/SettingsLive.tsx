import {
  Bell,
  CheckCircle2,
  CircleAlert,
  Database,
  MapPin,
  RefreshCw,
  Router,
  Save,
  Settings as SettingsIcon,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  getAccessPoints,
  type AccessPoint,
} from "../../services/accessPointService";
import {
  getRouters,
  type Router as RouterData,
} from "../../services/routerService";
import { getSites, type Site } from "../../services/siteService";
import {
  getNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
  type NotificationSettingsPayload,
} from "../../services/notificationService";
import { getDashboardOverview } from "../../services/statisticsService";

interface ConfigurationData {
  sites: Site[];
  routers: RouterData[];
  accessPoints: AccessPoint[];
  databaseAvailable: boolean;
}

export default function SettingsLive() {
  const [configuration, setConfiguration] =
    useState<ConfigurationData | null>(null);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings | null>(null);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [sites, routers, accessPoints, dashboard, savedNotificationSettings] =
          await Promise.all([
            getSites(),
            getRouters(),
            getAccessPoints(),
            getDashboardOverview(7),
            getNotificationSettings(),
          ]);

        if (active) {
          setConfiguration({
            sites,
            routers,
            accessPoints,
            databaseAvailable: dashboard.dbHealthy,
          });
          setNotificationSettings(savedNotificationSettings);
        }
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Impossible de charger la configuration."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [retry]);

  function patchNotificationSettings(
    patch: Partial<NotificationSettingsPayload>,
  ) {
    setNotificationSettings((current) =>
      current ? { ...current, ...patch } : current,
    );
    setNotificationMessage(null);
    setNotificationError(null);
  }

  async function saveNotifications() {
    if (!notificationSettings) return;

    setSavingNotifications(true);
    setNotificationMessage(null);
    setNotificationError(null);

    try {
      const saved = await saveNotificationSettings({
        enabled: notificationSettings.enabled,
        newSessionEnabled: notificationSettings.newSessionEnabled,
        networkProblemEnabled: notificationSettings.networkProblemEnabled,
        routerOfflineEnabled: notificationSettings.routerOfflineEnabled,
        routerOnlineEnabled: notificationSettings.routerOnlineEnabled,
        syncErrorEnabled: notificationSettings.syncErrorEnabled,
        allSites: notificationSettings.allSites,
        siteIds: notificationSettings.allSites ? [] : notificationSettings.siteIds,
      });
      setNotificationSettings(saved);
      setNotificationMessage("Paramètres de notifications enregistrés dans PostgreSQL.");
    } catch (reason) {
      setNotificationError(
        reason instanceof Error
          ? reason.message
          : "Impossible d'enregistrer les paramètres de notifications.",
      );
    } finally {
      setSavingNotifications(false);
    }
  }

  const timezones = useMemo(() => {
    if (!configuration) return [];

    return [
      ...new Set(
        configuration.sites
          .map((site) => site.timezone)
          .filter(
            (value): value is string => Boolean(value)
          )
      ),
    ];
  }, [configuration]);

  if (loading && !configuration) {
    return <Loading />;
  }

  if (error && !configuration) {
    return (
      <LoadFailure
        message={error}
        onRetry={() => setRetry((value) => value + 1)}
      />
    );
  }

  if (!configuration) {
    return null;
  }

  const enabledSync = configuration.routers.filter(
    (router) => router.syncEnabled
  ).length;

  const onlineRouters = configuration.routers.filter(
    (router) => router.status === "ONLINE"
  ).length;

  const onlineAccessPoints =
    configuration.accessPoints.filter(
      (accessPoint) => accessPoint.status === "ONLINE"
    ).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Administration
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Paramètres
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Consultez la configuration réelle de la plateforme. Les
            valeurs affichées proviennent des API et de la base de
            données, pas de paramètres de démonstration.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRetry((value) => value + 1)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
          />
          Actualiser
        </button>
      </header>

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Actualisation impossible : {error}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          icon={Database}
          label="Base de données"
          value={
            configuration.databaseAvailable
              ? "Disponible"
              : "Indisponible"
          }
          good={configuration.databaseAvailable}
        />
        <StatusCard
          icon={MapPin}
          label="Sites configurés"
          value={configuration.sites.length.toLocaleString("fr-MG")}
        />
        <StatusCard
          icon={Router}
          label="Routeurs synchronisés"
          value={`${enabledSync} / ${configuration.routers.length}`}
          good={enabledSync > 0}
        />
        <StatusCard
          icon={Wifi}
          label="Points d'accès en ligne"
          value={`${onlineAccessPoints} / ${configuration.accessPoints.length}`}
          good={
            configuration.accessPoints.length > 0 &&
            onlineAccessPoints > 0
          }
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">
                Sites configurés
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Paramètres réellement enregistrés pour chaque site.
              </p>
            </div>
            <MapPin className="h-5 w-5 text-slate-400" />
          </div>

          {configuration.sites.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Aucun site n'est encore configuré.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {configuration.sites.map((site) => (
                <li
                  key={site.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {site.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {site.city ||
                        site.region ||
                        "Localisation non renseignée"}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm text-slate-700">
                      {site.timezone ||
                        "Fuseau non renseigné"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {site.status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {timezones.length > 1 ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Plusieurs fuseaux horaires sont utilisés :{" "}
              {timezones.join(", ")}.
            </p>
          ) : null}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">
                Routeurs et synchronisation
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                État des routeurs enregistrés et de leur
                synchronisation.
              </p>
            </div>
            <Router className="h-5 w-5 text-slate-400" />
          </div>

          {configuration.routers.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Aucun routeur n'est encore configuré.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {configuration.routers.map((router) => (
                <li
                  key={router.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {router.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {router.managementIp ||
                        "Adresse non renseignée"}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={
                        router.status === "ONLINE"
                          ? "text-sm font-medium text-emerald-600"
                          : "text-sm font-medium text-slate-600"
                      }
                    >
                      {router.status === "ONLINE"
                        ? "En ligne"
                        : router.status}
                    </p>
                    <p className="text-xs text-slate-500">
                      {router.syncEnabled
                        ? "Synchronisation activée"
                        : "Synchronisation désactivée"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-xs text-slate-500">
            {onlineRouters} routeur(s) en ligne selon la
            dernière vérification enregistrée.
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            <div>
              <h2 className="font-semibold text-slate-900">Notifications</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Configurez les alertes enregistrées côté serveur. Ces préférences s'appliquent à votre compte et aux sites autorisés de votre organisation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void saveNotifications()}
            disabled={!notificationSettings || savingNotifications}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {savingNotifications ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>

        {!notificationSettings ? (
          <p className="mt-4 text-sm text-slate-500">Chargement des préférences de notifications…</p>
        ) : (
          <>
            <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
              <span>
                <span className="block text-sm font-semibold text-slate-900">Notifications activées</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">Désactive toutes les notifications pour votre compte sans supprimer l'historique.</span>
              </span>
              <input
                type="checkbox"
                checked={notificationSettings.enabled}
                onChange={(event) => patchNotificationSettings({ enabled: event.currentTarget.checked })}
                className="h-4 w-4 accent-slate-900"
              />
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([
                ["newSessionEnabled", "Nouvelles sessions", "Lorsqu'une nouvelle session MikroTik est détectée."],
                ["networkProblemEnabled", "Problèmes réseau", "Quand plusieurs routeurs d'un même site deviennent injoignables."],
                ["routerOfflineEnabled", "Routeur hors ligne", "Après deux échecs de connexion consécutifs."],
                ["routerOnlineEnabled", "Retour en ligne", "Quand un routeur en panne est de nouveau accessible."],
                ["syncErrorEnabled", "Erreur de synchronisation", "Quand la synchronisation d'un routeur échoue."],
              ] as const).map(([key, label, description]) => (
                <label key={key} className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-200 p-4">
                  <span>
                    <span className="block text-sm font-medium text-slate-800">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={notificationSettings[key]}
                    disabled={!notificationSettings.enabled}
                    onChange={(event) => patchNotificationSettings({ [key]: event.currentTarget.checked })}
                    className="mt-1 h-4 w-4 shrink-0 accent-slate-900 disabled:opacity-40"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Sites concernés</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Limitez les notifications aux sites sélectionnés ou appliquez-les à tous les sites de votre organisation.</p>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={notificationSettings.allSites}
                  onChange={(event) => patchNotificationSettings({
                    allSites: event.currentTarget.checked,
                    siteIds: event.currentTarget.checked ? [] : notificationSettings.siteIds,
                  })}
                  className="h-4 w-4 accent-slate-900"
                />
                Tous les sites
              </label>

              {!notificationSettings.allSites ? (
                configuration.sites.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {configuration.sites.map((site) => (
                      <label key={site.id} className="flex cursor-pointer items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={notificationSettings.siteIds.some((id) => id === site.id)}
                          onChange={(event) => {
                            const selected = event.currentTarget.checked;
                            const siteIds = selected
                              ? [...notificationSettings.siteIds, site.id]
                              : notificationSettings.siteIds.filter((id) => id !== site.id);
                            patchNotificationSettings({ siteIds: [...new Set(siteIds)] });
                          }}
                          className="h-4 w-4 accent-slate-900"
                        />
                        <span className="truncate">{site.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Aucun site disponible pour cette organisation.</p>
                )
              ) : null}
            </div>
          </>
        )}

        {notificationError ? (
          <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{notificationError}</p>
        ) : null}
        {notificationMessage ? (
          <p role="status" className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notificationMessage}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <SettingsIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
          <div>
            <h2 className="font-semibold text-slate-900">
              Paramètres applicatifs
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Les anciens réglages enregistrés uniquement dans le
              navigateur ne sont pas présentés comme des paramètres
              système. Aucun faux interrupteur ne modifie la
              plateforme.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Les paramètres opérationnels sont gérés dans les
              modules correspondants : Sites, Routeurs, Points
              d'accès, Utilisateurs et synchronisation MikroTik.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <h2 className="font-semibold text-slate-900">
          Paramètres nécessitant un endpoint backend
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Les préférences globales comme les notifications, les
          règles d'alerte, les paramètres de sécurité de session ou
          d'autres options applicatives pourront être ajoutées ici
          uniquement après création de leurs endpoints et stockage
          persistants côté serveur.
        </p>
      </section>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  good,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>
          <p
            className={
              good
                ? "mt-2 text-2xl font-bold text-emerald-600"
                : "mt-2 text-2xl font-bold text-slate-900"
            }
          >
            {value}
          </p>
        </div>
        <span
          className={
            good
              ? "rounded-lg bg-emerald-50 p-2.5 text-emerald-600"
              : "rounded-lg bg-slate-100 p-2.5 text-slate-600"
          }
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

function Loading() {
  return (
    <div className="flex min-h-80 items-center justify-center text-slate-600">
      <div className="text-center">
        <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-slate-500" />
        <p>Chargement de la configuration réelle…</p>
      </div>
    </div>
  );
}

function LoadFailure({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h1 className="font-semibold">
            La configuration n'est pas disponible
          </h1>
          <p className="mt-1 text-sm">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-lg bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-800"
          >
            Réessayer
          </button>
        </div>
      </div>
    </div>
  );
}
