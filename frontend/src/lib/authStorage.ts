/* ============================================================
   STOCKAGE DE LA SESSION (token + utilisateur)

   Centralisé ici pour éviter que les clés localStorage
   soient dupliquées (et donc désynchronisées) entre
   AuthContext et le client axios.
============================================================ */

const TOKEN_KEY = "hmv2_token";
const USER_KEY = "hmv2_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUserRaw(): string | null {
  return localStorage.getItem(USER_KEY);
}

export function setStoredSession(
  token: string,
  userJson: string
): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, userJson);
}

export function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
