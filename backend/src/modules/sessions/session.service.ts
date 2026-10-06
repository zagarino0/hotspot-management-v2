import { connectMikroTik } from "../../mikrotik/connection.js";
import {
  fetchActiveHotspotUsers,
  removeActiveHotspotUser,
} from "../../mikrotik/hotspotActive.js";
import { fetchHotspotUsers } from "../../mikrotik/hotspotUsers.js";
import { fetchHotspotCookies } from "../../mikrotik/hotspotCookies.js";

import { decryptSecret } from "../../lib/crypto.js";
import { badRequest, conflict, notFoundError } from "../../lib/errors.js";

import {
  findRouterById,
  findRouterCredential,
  findRoutersForSync,
  updateRouterHealth,
  type RouterForSync,
} from "../routers/router.repository.js";

import {
  activateVoucher,
  closeSessionsNotIn,
  findSessionById,
  findSessions,
  findVoucherIdByCode,
  markSessionTerminated,
  syncVoucherUsage,
  upsertActiveSession,
} from "./session.repository.js";

import type { SessionStatus } from "../../routes/session.types.js";

/* ============================================================
   LIST
============================================================ */

export async function getSessions(filter?: {
  status?: SessionStatus;
}) {
  return findSessions(filter);
}

/* ============================================================
   SYNC UN SEUL ROUTEUR

   1. Récupère l'identifiant chiffré, le déchiffre
   2. Se connecte au routeur MikroTik
   3. Lit /ip/hotspot/active/print
   4. Met à jour / crée les sessions correspondantes en base
   5. Clôture les sessions qui ne sont plus actives
   6. Met à jour l'état de santé du routeur (ONLINE/OFFLINE)
============================================================ */

export interface RouterSyncResult {
  routerId: string;
  routerName: string;
  success: boolean;
  activeCount: number;
  closedCount: number;
  error?: string;
}

export async function syncRouterSessions(
  router: RouterForSync
): Promise<RouterSyncResult> {
  const credential = await findRouterCredential(router.id);

  if (!credential) {
    await updateRouterHealth({
      routerId: router.id,
      reachable: false,
      errorMessage:
        "Aucun identifiant MikroTik enregistré pour ce routeur.",
    });

    return {
      routerId: router.id,
      routerName: router.name,
      success: false,
      activeCount: 0,
      closedCount: 0,
      error:
        "Aucun identifiant MikroTik enregistré pour ce routeur.",
    };
  }

  let password: string;

  try {
    password = decryptSecret(credential.encryptedSecret);
  } catch {
    await updateRouterHealth({
      routerId: router.id,
      reachable: false,
      errorMessage:
        "Le secret stocké est illisible (clé de chiffrement changée ?).",
    });

    return {
      routerId: router.id,
      routerName: router.name,
      success: false,
      activeCount: 0,
      closedCount: 0,
      error:
        "Le secret stocké est illisible (clé de chiffrement changée ?).",
    };
  }

  let api;

  try {
    const host = router.managementIp.split("/")[0].trim();

    api = await connectMikroTik({
      host,
      port: router.apiPort,
      user: credential.username,
      password,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Connexion au routeur impossible.";

    await updateRouterHealth({
      routerId: router.id,
      reachable: false,
      errorMessage: message,
    });

    return {
      routerId: router.id,
      routerName: router.name,
      success: false,
      activeCount: 0,
      closedCount: 0,
      error: message,
    };
  }

  try {
    const activeUsers = await fetchActiveHotspotUsers(api);
    const hotspotUsers = await fetchHotspotUsers(api);

    let cookies = [];
    try {
      cookies = await fetchHotspotCookies(api);
    } catch {
      // Les cookies sont une donnée complémentaire : une absence
      // de permission ou de support ne doit pas bloquer le live sync.
      cookies = [];
    }

    const profileByUsername = new Map(
      hotspotUsers.map((user) => [
        user.username,
        user.profile,
      ])
    );

    const cookieKeys = new Set(
      cookies
        .filter(
          (cookie) =>
            cookie.username !== null &&
            cookie.macAddress !== null
        )
        .map(
          (cookie) =>
            `${cookie.username}|${cookie.macAddress}`
        )
    );

    const usableUsers = activeUsers.filter(
      (user) => user.macAddress !== null
    );

    const voucherIds = new Set<string>();

    for (const user of usableUsers) {
      const voucherId =
        user.username !== null
          ? await findVoucherIdByCode(
              router.siteId,
              user.username
            )
          : null;

      const mikrotikProfile =
        user.username !== null
          ? profileByUsername.get(user.username) ?? null
          : null;

      const cookiePresent =
        user.username !== null &&
        cookieKeys.has(
          `${user.username}|${user.macAddress}`
        );

      await upsertActiveSession({
        siteId: router.siteId,
        routerId: router.id,
        username: user.username,
        macAddress: user.macAddress as string,
        ipAddress: user.ipAddress,
        uploadBytes: user.uploadBytes,
        downloadBytes: user.downloadBytes,
        uptimeSeconds: user.uptimeSeconds,
        sessionTimeLeftSeconds:
          user.sessionTimeLeftSeconds,
        loginMethod: user.loginMethod,
        mikrotikProfile,
        cookiePresent,
        voucherId,
      });

      if (voucherId) {
        voucherIds.add(voucherId);
        await activateVoucher(voucherId);
      }
    }

    const closedCount = await closeSessionsNotIn(
      router.id,
      usableUsers.map((user) => user.macAddress as string)
    );

    // Recalcule le temps cumulé des vouchers concernés.
    // Une reconnexion crée une nouvelle session, mais le cumul
    // reste attaché au même voucher.
    for (const voucherId of voucherIds) {
      await syncVoucherUsage(voucherId);
    }

    await updateRouterHealth({
      routerId: router.id,
      reachable: true,
    });

    return {
      routerId: router.id,
      routerName: router.name,
      success: true,
      activeCount: usableUsers.length,
      closedCount,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erreur lors de la lecture des sessions actives.";

    await updateRouterHealth({
      routerId: router.id,
      reachable: false,
      errorMessage: message,
    });

    return {
      routerId: router.id,
      routerName: router.name,
      success: false,
      activeCount: 0,
      closedCount: 0,
      error: message,
    };
  } finally {
    await api.close();
  }
}

/* ============================================================
   SYNC TOUS LES ROUTEURS

   Chaque routeur est indépendant : un routeur injoignable ne
   doit jamais empêcher la synchronisation des autres.
============================================================ */

export async function syncAllRouters(): Promise<
  RouterSyncResult[]
> {
  const routers = await findRoutersForSync();

  const results: RouterSyncResult[] = [];

  for (const router of routers) {
    const result = await syncRouterSessions(router);
    results.push(result);
  }

  return results;
}

/* ============================================================
   SYNC D'UN ROUTEUR PAR ID (déclenchement manuel depuis l'API)
============================================================ */

export async function syncSingleRouterById(
  routerId: string
): Promise<RouterSyncResult> {
  if (!routerId.trim()) {
    throw badRequest("Identifiant de routeur invalide.");
  }

  const routers = await findRoutersForSync();
  const router = routers.find((r) => r.id === routerId);

  if (!router) {
    throw notFoundError(
      "Routeur introuvable ou non éligible à la synchronisation (adresse IP manquante ou synchronisation désactivée)."
    );
  }

  return syncRouterSessions(router);
}

/* ============================================================
   TERMINATE SESSION (déconnexion manuelle par un admin)

   1. Se connecte au routeur concerné
   2. Cherche la connexion active correspondante (par MAC)
   3. La supprime réellement côté MikroTik si elle existe encore
   4. Marque la session TERMINATED en base dans tous les cas
============================================================ */

export async function terminateSession(sessionId: string) {
  const session = await findSessionById(sessionId);

  if (!session) {
    throw notFoundError("Session introuvable.");
  }

  if (session.status !== "ACTIVE") {
    throw conflict(
      `Cette session est déjà "${session.status}", elle ne peut plus être déconnectée.`
    );
  }

  if (!session.macAddress) {
    // Pas d'adresse MAC connue : on ne peut pas retrouver
    // l'entrée live côté MikroTik, on se contente de clôturer
    // la session en base.
    const updated = await markSessionTerminated(
      sessionId,
      "MANUAL_DISCONNECT"
    );

    return updated ?? session;
  }

  const router = await findRouterById(session.routerId);

  if (!router || !router.managementIp) {
    // Routeur introuvable/désactivé : on ne peut pas se
    // connecter, mais la session peut quand même être clôturée
    // côté administratif.
    const updated = await markSessionTerminated(
      sessionId,
      "MANUAL_DISCONNECT"
    );

    return updated ?? session;
  }

  const credential = await findRouterCredential(router.id);

  if (!credential) {
    throw conflict(
      "Aucun identifiant MikroTik enregistré pour ce routeur : impossible de déconnecter l'utilisateur en direct."
    );
  }

  const password = decryptSecret(credential.encryptedSecret);

  const host = router.managementIp.split("/")[0].trim();

  const api = await connectMikroTik({
    host,
    port: router.apiPort,
    user: credential.username,
    password,
  });

  try {
    const activeUsers = await fetchActiveHotspotUsers(api);

    const match = activeUsers.find(
      (user) =>
        user.macAddress === session.macAddress &&
        user.routerInternalId !== null
    );

    if (match && match.routerInternalId) {
      await removeActiveHotspotUser(
        api,
        match.routerInternalId
      );
    }

    // Que l'utilisateur ait été trouvé ou non côté MikroTik
    // (il a pu se déconnecter entre-temps), on clôture la
    // session côté base.
    const updated = await markSessionTerminated(
      sessionId,
      "MANUAL_DISCONNECT"
    );

    return updated ?? session;
  } finally {
    await api.close();
  }
}
