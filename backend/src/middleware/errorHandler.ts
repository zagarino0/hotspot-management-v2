import { NextFunction, Request, Response } from "express";

import { AppError } from "../lib/errors.js";

/* ============================================================
   ERROR HANDLER

   - AppError (login invalide, ressource introuvable, etc.) :
     on renvoie le vrai code HTTP + le vrai message, car ce
     sont des erreurs "attendues" et sûres à afficher.

   - Toute autre erreur (bug, exception BDD, etc.) : on log le
     détail côté serveur mais on renvoie un message générique
     500, pour ne jamais exposer de détails internes au client.
============================================================ */

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      console.error(error);
    }

    res.status(error.statusCode).json({
      success: false,
      message: error.expose
        ? error.message
        : "Erreur interne du serveur",
    });

    return;
  }

  console.error(error);

  res.status(500).json({
    success: false,
    message: "Erreur interne du serveur",
  });
}