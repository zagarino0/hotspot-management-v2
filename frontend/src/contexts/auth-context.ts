import { createContext } from "react";

import type { AuthUser } from "./AuthContext";

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roleCode: string) => boolean;
  hasPermission: (permissionCode: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);
