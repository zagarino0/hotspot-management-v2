import app from "./app.js";
import { env } from "./config/env.js";
import { syncAllRouters } from "./modules/sessions/session.service.js";
import { startPosOperationsScheduler, stopPosOperationsScheduler } from "./modules/sales/posOperations.scheduler.js";

const server = app.listen(env.port, () => {
  startPosOperationsScheduler();
  console.log(
    `HOTSPOT MANAGEMENT V2 → http://localhost:${env.port}`
  );
});

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

  // Premier cycle immédiatement après le démarrage, sans bloquer le boot.
  void runLiveSync();

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
  stopPosOperationsScheduler();

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
