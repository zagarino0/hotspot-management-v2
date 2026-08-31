/* ============================================================
   APP ERROR
   Erreur applicative portant un code HTTP explicite.
   Permet à errorHandler de distinguer une erreur "attendue"
   (mauvais mot de passe, ressource introuvable, etc.)
   d'un vrai bug serveur.
============================================================ */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly expose: boolean;

  constructor(
    message: string,
    statusCode = 500,
    expose = true
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.expose = expose;

    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/* ============================================================
   HELPERS
============================================================ */

export function badRequest(message: string): AppError {
  return new AppError(message, 400);
}

export function unauthorized(
  message = "Authentification requise."
): AppError {
  return new AppError(message, 401);
}

export function forbidden(
  message = "Accès refusé."
): AppError {
  return new AppError(message, 403);
}

export function notFoundError(message: string): AppError {
  return new AppError(message, 404);
}

export function conflict(message: string): AppError {
  return new AppError(message, 409);
}
