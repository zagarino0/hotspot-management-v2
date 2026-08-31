import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  getSessions,
  syncAllRouters,
  syncSingleRouterById,
  terminateSession,
} from "./session.service.js";

import type { SessionStatus } from "../../routes/session.types.js";

const VALID_STATUSES: readonly SessionStatus[] = [
  "ACTIVE",
  "COMPLETED",
  "TERMINATED",
  "ERROR",
];

/* ============================================================
   LIST SESSIONS
   Query optionnelle : ?status=ACTIVE
============================================================ */

export async function listSessions(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawStatus = req.query.status;

    let status: SessionStatus | undefined;

    if (typeof rawStatus === "string") {
      if (
        !VALID_STATUSES.includes(
          rawStatus as SessionStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message: `Statut invalide. Valeurs acceptées : ${VALID_STATUSES.join(", ")}.`,
        });
      }

      status = rawStatus as SessionStatus;
    }

    const sessions = await getSessions({ status });

    return res.status(200).json({
      success: true,
      data: sessions,
      count: sessions.length,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   SYNC ALL ROUTERS (déclenchement manuel du live sync)
============================================================ */

export async function syncSessions(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const results = await syncAllRouters();

    const failedRouters = results.filter(
      (result) => !result.success
    );

    const sessions = await getSessions();

    return res.status(200).json({
      success: true,
      message:
        failedRouters.length > 0
          ? `Synchronisé avec ${failedRouters.length} routeur(s) injoignable(s) sur ${results.length}.`
          : `${results.length} routeur(s) synchronisé(s) avec succès.`,
      data: {
        sessions,
        syncResults: results,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   SYNC UN SEUL ROUTEUR
============================================================ */

export async function syncSingleRouter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { routerId } = req.params;

    const result = await syncSingleRouterById(
      String(routerId ?? "")
    );

    return res.status(200).json({
      success: result.success,
      message: result.success
        ? "Routeur synchronisé avec succès."
        : (result.error ?? "Synchronisation échouée."),
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   TERMINATE (déconnexion manuelle d'un utilisateur)
============================================================ */

export async function terminateSessionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    const session = await terminateSession(String(id ?? ""));

    return res.status(200).json({
      success: true,
      message: "Utilisateur déconnecté avec succès.",
      data: session,
    });
  } catch (error) {
    return next(error);
  }
}
