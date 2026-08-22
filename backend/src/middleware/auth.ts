import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { unauthorized } from "../lib/errors.js";

import type { AuthTokenPayload } from "../domain/iam/auth.types.js";

/* ============================================================
   REQUEST AUGMENTATION
   Permet d'accéder à req.auth dans les contrôleurs
   une fois le token vérifié.
============================================================ */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

/* ============================================================
   EXTRACTION DU TOKEN
============================================================ */

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;

  if (!header || typeof header !== "string") {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

/* ============================================================
   MIDDLEWARE : AUTHENTICATE
   Vérifie le JWT et attache req.auth.
   Bloque la requête avec 401 si le token est absent,
   invalide ou expiré.
============================================================ */

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req);

    if (!token) {
      throw unauthorized("Token d'authentification manquant.");
    }

    const payload = jwt.verify(
      token,
      env.jwtSecret
    ) as AuthTokenPayload;

    req.auth = payload;

    next();
  } catch (error) {
    if (
      error instanceof jwt.TokenExpiredError
    ) {
      next(unauthorized("Session expirée, veuillez vous reconnecter."));
      return;
    }

    if (
      error instanceof jwt.JsonWebTokenError
    ) {
      next(unauthorized("Token d'authentification invalide."));
      return;
    }

    next(error);
  }
}
