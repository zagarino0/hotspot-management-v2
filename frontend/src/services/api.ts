import axios from "axios";

import {
  clearStoredSession,
  getStoredToken,
} from "../lib/authStorage";

// Local backend is used only during local development.
// GitHub Pages must always call the deployed Render API.
const apiBaseUrl = import.meta.env.DEV
  ? "http://localhost:4000"
  : "https://hotspot-management-v2.onrender.com";

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

/* ============================================================
   REQUEST : ATTACHER LE TOKEN
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
============================================================ */

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? "";
    const isLoginRequest = url.includes("/api/auth/login");

    if (status === 401 && !isLoginRequest) {
      clearStoredSession();

      if (!window.location.pathname.endsWith("/login")) {
        window.location.assign(
          import.meta.env.BASE_URL + "login"
        );
      }
    }

    return Promise.reject(error);
  }
);

export default api;
