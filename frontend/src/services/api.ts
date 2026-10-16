import axios from "axios";

import {
  clearStoredSession,
  getStoredToken,
} from "../lib/authStorage";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const isGitHubPages = window.location.hostname === "zagarino0.github.io";

// GitHub Pages must never send requests to localhost, even if a build
// accidentally includes VITE_API_URL=http://localhost:4000.
const apiBaseUrl = isGitHubPages
  ? "https://hotspot-management-v2.onrender.com"
  : configuredApiUrl && /^https?:\/\//i.test(configuredApiUrl)
    ? configuredApiUrl.replace(/\/$/, "")
    : import.meta.env.DEV
      ? "http://localhost:4000"
      : "https://hotspot-management-v2.onrender.com";

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

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
