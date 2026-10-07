import {
  CircleAlert,
  Database,
  MapPin,
  RefreshCw,
  Router,
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

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [sites, routers, accessPoints, dashboard] =
          await Promise.all([
            getSites(),
            getRouters(),
            getAccessPoints(),
            getDashboardOverview(7),
          ]);

        if (active) {
          setConfiguration({
            sites,
            routers,
            accessPoints,
            databaseAvailable: dashboard.dbHealthy,
          });
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
