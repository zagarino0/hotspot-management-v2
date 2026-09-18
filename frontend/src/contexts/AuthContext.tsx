import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearStoredSession,
  getStoredToken,
  getStoredUserRaw,
  setStoredSession,
} from "../lib/authStorage";
import {
  AuthContext,
  type AuthContextValue,
} from "./auth-context";

/* ============================================================
   CONFIGURATION
============================================================ */

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/* ============================================================
   TYPES IAM
============================================================ */

export interface AuthPermission {
  id: string;
  name: string;
  code: string;
  resource: string;
  action: string;
}

export interface AuthRole {
  id: string;
  name: string;
  code: string;
  permissions: AuthPermission[];
}

export interface AuthUser {
  id: string;
  organizationId: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
  roles: AuthRole[];
}

/* ============================================================
   API RESPONSE
============================================================ */

interface LoginResponse {
  success: true;
  data: {
    token: string;
    user: AuthUser;
  };
}

interface ApiErrorResponse {
  success: false;
  message?: string;
}

/* ============================================================
   CONTEXT
============================================================ */

/* ============================================================
   PROVIDER
============================================================ */

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [token, setToken] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  /* ==========================================================
     RESTAURATION SESSION
  ========================================================== */

  useEffect(() => {
    try {
      const storedToken =
        getStoredToken();

      const storedUser =
        getStoredUserRaw();

      if (!storedToken || !storedUser) {
        setToken(null);
        setUser(null);
        return;
      }

      const parsedUser =
        JSON.parse(storedUser) as AuthUser;

      /*
       * Vérification minimale de la structure
       */

      if (
        !parsedUser ||
        typeof parsedUser.id !== "string" ||
        typeof parsedUser.username !== "string" ||
        !Array.isArray(parsedUser.roles)
      ) {
        throw new Error(
          "Session utilisateur invalide."
        );
      }

      setToken(storedToken);
      setUser(parsedUser);
    } catch (error) {
      console.error(
        "Impossible de restaurer la session.",
        error
      );

      clearStoredSession();

      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ==========================================================
     LOGIN
  ========================================================== */

  const login = useCallback(
    async (
      username: string,
      password: string
    ): Promise<void> => {
      const cleanUsername =
        username.trim();

      if (!cleanUsername || !password) {
        throw new Error(
          "Identifiant et mot de passe requis."
        );
      }

      let response: Response;

      try {
        response = await fetch(
          `${API_URL}/api/auth/login`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
              Accept: "application/json",
            },

            body: JSON.stringify({
              username: cleanUsername,
              password,
            }),
          }
        );
      } catch {
        throw new Error(
          "Impossible de contacter le serveur."
        );
      }

      let result:
        | LoginResponse
        | ApiErrorResponse
        | null = null;

      try {
        result =
          (await response.json()) as
            | LoginResponse
            | ApiErrorResponse;
      } catch {
        throw new Error(
          "Réponse invalide du serveur."
        );
      }

      /* ========================================================
         ERREUR API
      ======================================================== */

      if (!response.ok) {
        const errorResult =
          result as ApiErrorResponse;

        throw new Error(
          errorResult.message ??
            "Échec de l'authentification."
        );
      }

      /* ========================================================
         VALIDATION REPONSE
      ======================================================== */

      const loginResult =
        result as LoginResponse;

      if (
        loginResult.success !== true ||
        !loginResult.data ||
        typeof loginResult.data.token !==
          "string" ||
        !loginResult.data.user
      ) {
        throw new Error(
          "Réponse d'authentification invalide."
        );
      }

      const newToken =
        loginResult.data.token;

      const newUser =
        loginResult.data.user;

      /* ========================================================
         SAUVEGARDE SESSION
      ======================================================== */

      setStoredSession(
        newToken,
        JSON.stringify(newUser)
      );

      /* ========================================================
         ETAT GLOBAL
      ======================================================== */

      setToken(newToken);
      setUser(newUser);
    },
    []
  );

  /* ==========================================================
     LOGOUT
  ========================================================== */

  const logout = useCallback(() => {
    clearStoredSession();

    setToken(null);
    setUser(null);
  }, []);

  /* ==========================================================
     ROLE CHECK
  ========================================================== */

  const hasRole = useCallback(
    (roleCode: string): boolean => {
      if (!user) {
        return false;
      }

      return user.roles.some(
        (role) =>
          role.code.toUpperCase() ===
          roleCode.toUpperCase()
      );
    },
    [user]
  );

  /* ==========================================================
     PERMISSION CHECK
  ========================================================== */

  const hasPermission = useCallback(
    (permissionCode: string): boolean => {
      if (!user) {
        return false;
      }

      return user.roles.some((role) =>
        role.permissions.some(
          (permission) =>
            permission.code.toUpperCase() ===
            permissionCode.toUpperCase()
        )
      );
    },
    [user]
  );

  /* ==========================================================
     AUTHENTICATED
  ========================================================== */

  const isAuthenticated =
    Boolean(token) &&
    Boolean(user);

  /* ==========================================================
     CONTEXT VALUE
  ========================================================== */

  const value =
    useMemo<AuthContextValue>(
      () => ({
        user,
        token,

        loading,

        isAuthenticated,

        login,
        logout,

        hasRole,
        hasPermission,
      }),
      [
        user,
        token,
        loading,
        isAuthenticated,
        login,
        logout,
        hasRole,
        hasPermission,
      ]
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}
