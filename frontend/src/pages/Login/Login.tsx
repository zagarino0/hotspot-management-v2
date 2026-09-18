import { useState, type FormEvent } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Network,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function Login() {
  const navigate = useNavigate();

  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    setError("");

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      setError(
        "Veuillez renseigner votre identifiant et votre mot de passe."
      );
      return;
    }

    setLoading(true);

    try {
      await login(cleanUsername, password);

      navigate("/dashboard", {
        replace: true,
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Une erreur est survenue pendant la connexion."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="flex min-h-screen">

        {/* ======================================================
            LEFT PRESENTATION
        ====================================================== */}

        <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
          <div className="absolute inset-0 bg-slate-950" />

          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">

            {/* Brand */}

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-950">
                <Network
                  size={23}
                  strokeWidth={2}
                />
              </div>

              <div>
                <div className="text-sm font-bold tracking-wider text-white">
                  HOTSPOT
                </div>

                <div className="text-xs font-medium tracking-wider text-slate-400">
                  MANAGEMENT V2
                </div>
              </div>
            </div>

            {/* Presentation */}

            <div className="max-w-xl">

              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />

                <span className="text-xs font-medium text-slate-300">
                  Network Management Platform
                </span>
              </div>

              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl">
                Gérez votre infrastructure hotspot depuis une seule plateforme.
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
                Supervisez vos sites, routeurs MikroTik,
                points d'accès, utilisateurs, vouchers,
                sessions et opérations de facturation depuis
                Hotspot Management V2.
              </p>

              <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">

                <Feature
                  value="Multi-site"
                  label="Architecture"
                />

                <Feature
                  value="MikroTik"
                  label="Network"
                />

                <Feature
                  value="Billing"
                  label="Gestion"
                />

              </div>
            </div>

            {/* Footer */}

            <div className="text-xs text-slate-600">
              Hotspot Management V2 · Platform
            </div>

          </div>
        </div>

        {/* ======================================================
            LOGIN
        ====================================================== */}

        <div className="flex w-full items-center justify-center bg-white px-5 py-10 sm:px-8 lg:w-1/2">

          <div className="w-full max-w-md">

            {/* Mobile brand */}

            <div className="mb-10 flex items-center gap-3 lg:hidden">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
                <Network size={21} />
              </div>

              <div>
                <div className="text-sm font-bold tracking-wider text-slate-900">
                  HOTSPOT
                </div>

                <div className="text-xs font-medium tracking-wider text-slate-400">
                  MANAGEMENT V2
                </div>
              </div>

            </div>

            {/* Title */}

            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Connexion
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Connectez-vous à votre espace d'administration.
              </p>
            </div>

            {/* Error */}

            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* Form */}

            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-5"
            >

              {/* Username */}

              <div>

                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Identifiant
                </label>

                <div className="relative">

                  <User
                    size={18}
                    strokeWidth={1.8}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);

                      if (error) {
                        setError("");
                      }
                    }}
                    disabled={loading}
                    placeholder="Votre identifiant"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
                  />

                </div>

              </div>

              {/* Password */}

              <div>

                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Mot de passe
                </label>

                <div className="relative">

                  <LockKeyhole
                    size={18}
                    strokeWidth={1.8}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="password"
                    name="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);

                      if (error) {
                        setError("");
                      }
                    }}
                    disabled={loading}
                    placeholder="Votre mot de passe"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
                  />

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      setShowPassword(
                        (current) => !current
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>

                </div>

              </div>

              {/* Remember / forgot */}

              <div className="flex items-center justify-between">

                <label className="flex cursor-pointer items-center gap-2">

                  <input
                    type="checkbox"
                    disabled={loading}
                    className="h-4 w-4 rounded border-slate-300"
                  />

                  <span className="text-xs text-slate-500">
                    Se souvenir de moi
                  </span>

                </label>

                <button
                  type="button"
                  disabled={loading}
                  className="text-xs font-medium text-slate-700 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mot de passe oublié ?
                </button>

              </div>

              {/* Submit */}

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Connexion..."
                  : "Se connecter"}
              </button>

            </form>

            {/* Security */}

            <div className="mt-8 flex items-start gap-3 rounded-lg bg-slate-50 p-4">

              <LockKeyhole
                size={17}
                className="mt-0.5 shrink-0 text-slate-500"
              />

              <p className="text-xs leading-5 text-slate-500">
                L'accès à cette interface est réservé aux
                utilisateurs autorisés. Les permissions sont
                contrôlées par le système IAM V2.
              </p>

            </div>

            {/* Version */}

            <p className="mt-8 text-center text-xs text-slate-400">
              Hotspot Management V2 · v2.0.0
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FEATURE
============================================================ */

interface FeatureProps {
  value: string;
  label: string;
}

function Feature({
  value,
  label,
}: FeatureProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">

      <div className="text-sm font-semibold text-white">
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-500">
        {label}
      </div>

    </div>
  );
}
