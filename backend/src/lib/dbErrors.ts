/* ============================================================
   DÉTECTION D'ERREURS POSTGRESQL COURANTES
   Évite de dupliquer `"code" in error && ...` dans chaque service.
============================================================ */

interface PgError {
  code?: string;
}

function getPgCode(error: unknown): string | undefined {
  if (error instanceof Error && "code" in error) {
    return (error as PgError).code;
  }

  return undefined;
}

/** 23505 = unique_violation */
export function isUniqueViolation(error: unknown): boolean {
  return getPgCode(error) === "23505";
}

/** 23503 = foreign_key_violation */
export function isForeignKeyViolation(
  error: unknown
): boolean {
  return getPgCode(error) === "23503";
}
