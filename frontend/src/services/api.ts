import axios from "axios";

import {
  clearStoredSession,
  getStoredToken,
} from "../lib/authStorage";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL || "http://localhost:4000",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

/* ============================================================
   REQUEST : ATTACHER LE TOKEN

   Le backend exige desormais un JWT sur /api/routers et
   /api/clients. Sans cet intercepteur, tous ces appels
   echouent avec 401 meme une fois connecte.
============================================================ */

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* ============================================================
   RESPONSE : SESSION EXPIREE / INVALIDE

   Si le token est expire ou invalide, le backend renvoie 401.
   On nettoie la session locale et on renvoie vers /login
   plutot que de laisser l'app dans un etat incoherent
   (utilisateur "connecte" cote React mais rejete par l'API).

   On ignore volontairement le 401 renvoye par
   /api/auth/login lui-meme : c'est un echec de connexion
   normal, pas une session expiree.
============================================================ */

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? "";

    const isLoginRequest = url.includes("/api/auth/login");

    if (status === 401 && !isLoginRequest) {
      clearStoredSession();

      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
