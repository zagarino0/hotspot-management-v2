/** Règles métier fixes des incidents de synchronisation MikroTik. */
export const SYNC_ERROR_FAILURE_THRESHOLD = 1;
export const ROUTER_OFFLINE_FAILURE_THRESHOLD = 2;
export const NETWORK_PROBLEM_ROUTER_THRESHOLD = 2;
export const NETWORK_PROBLEM_WINDOW_SECONDS = 30;

/** L'incident routeur est notifié après le seuil de connexions échouées consécutives. */
export function shouldNotifyRouterOffline(consecutiveConnectionFailures: number): boolean {
  return Number.isInteger(consecutiveConnectionFailures)
    && consecutiveConnectionFailures >= ROUTER_OFFLINE_FAILURE_THRESHOLD;
}

/**
 * Le paramètre doit déjà représenter le nombre de routeurs distincts du site
 * dont offline_since se trouve dans la fenêtre de 30 secondes.
 */
export function shouldNotifyNetworkProblem(recentDistinctOfflineRouters: number): boolean {
  return Number.isInteger(recentDistinctOfflineRouters)
    && recentDistinctOfflineRouters >= NETWORK_PROBLEM_ROUTER_THRESHOLD;
}
