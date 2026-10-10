/** Règles métier fixes des incidents de synchronisation MikroTik. */
export const ROUTER_OFFLINE_FAILURE_THRESHOLD = 2;
export const NETWORK_PROBLEM_ROUTER_THRESHOLD = 2;
export const NETWORK_PROBLEM_WINDOW_SECONDS = 30;

/** L'incident routeur est notifié après le seuil de connexions échouées consécutives. */
export function shouldNotifyRouterOffline(consecutiveConnectionFailures: number): boolean {
  return Number.isInteger(consecutiveConnectionFailures)
    && consecutiveConnectionFailures >= ROUTER_OFFLINE_FAILURE_THRESHOLD;
}

/** Le problème réseau est déclenché par des routeurs distincts dans la fenêtre métier. */
export function shouldNotifyNetworkProblem(
  distinctOfflineRouters: number,
  oldestOutageAgeSeconds: number
): boolean {
  return Number.isInteger(distinctOfflineRouters)
    && distinctOfflineRouters >= NETWORK_PROBLEM_ROUTER_THRESHOLD
    && Number.isFinite(oldestOutageAgeSeconds)
    && oldestOutageAgeSeconds >= 0
    && oldestOutageAgeSeconds <= NETWORK_PROBLEM_WINDOW_SECONDS;
}
