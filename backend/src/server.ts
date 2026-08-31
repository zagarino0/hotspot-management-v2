import app from "./app.js";
import { env } from "./config/env.js";
import { syncAllRouters } from "./modules/sessions/session.service.js";
import { initWebSocketServer, broadcastStatsUpdate } from "./websocket/server.js";

const server = app.listen(env.port, () => {
  console.log(
    `HOTSPOT MANAGEMENT V2 → http://localhost:${env.port}`
  );
});

// Initialiser le serveur WebSocket
initWebSocketServer(server);

/* ============================================================
   LIVE SYNC MIKROTIK
   Synchronise périodiquement les sessions actives de tous les
   routeurs éligibles (sync_enabled = true). Un routeur en
   échec ne bloque jamais les autres (voir session.service.ts).
============================================================ */

let syncInterval: NodeJS.Timeout | null = null;
let syncInFlight = false;

async function runLiveSync(): Promise<void> {
  if (syncInFlight) {
    return;
  }

  syncInFlight = true;

  try {
    const results = await syncAllRouters();

    const failed = results.filter((r) => !r.success);

    if (failed.length > 0) {
      console.warn(
        `[live-sync] ${failed.length}/${results.length} routeur(s) injoignable(s) :`,
        failed
          .map((r) => `${r.routerName} (${r.error})`)
          .join(", ")
      );
    }

    // Diffuser les statistiques en temps réel via WebSocket
    const stats = {
      activeUsers: results.reduce((sum, r) => sum + (r.success ? r.activeCount : 0), 0),
      routersOnline: results.filter((r) => r.success).length,
      totalRouters: results.length,
      revenue: 45000, // TODO: Calculer depuis les ventes réelles
      timestamp: new Date().toISOString(),
    };

    broadcastStatsUpdate(stats);
  } catch (error) {
    console.error("[live-sync] Erreur inattendue :", error);
  } finally {
    syncInFlight = false;
  }
}

if (env.liveSyncIntervalSeconds > 0) {
  console.log(
    `[live-sync] Synchronisation automatique toutes les ${env.liveSyncIntervalSeconds}s`
  );

  // Premier cycle peu après le démarrage, sans bloquer le boot.
  setTimeout(runLiveSync, 3000);

  syncInterval = setInterval(
    runLiveSync,
    env.liveSyncIntervalSeconds * 1000
  );
} else {
  console.log(
    "[live-sync] Désactivé (LIVE_SYNC_INTERVAL_SECONDS=0)."
  );
}

/* ============================================================
   SHUTDOWN
============================================================ */

function shutdown(signal: string): void {
  console.log(`\n${signal} reçu. Arrêt du serveur...`);

  if (syncInterval) {
    clearInterval(syncInterval);
  }

  server.close(() => {
    console.log("Serveur arrêté.");
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
