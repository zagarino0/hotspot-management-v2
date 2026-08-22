import type React from "react";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Router as RouterIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import api from "../../services/api";
import { getSites, type Site } from "../../services/siteService";

/* ============================================================
   FORM DATA
============================================================ */

interface RouterForm {
  name: string;
  code: string;
  host: string;
  port: number;
  username: string;
  password: string;
  siteId: string;
}

/* ============================================================
   TEST RESULT
============================================================ */

interface TestResult {
  success: boolean;
  message: string;
  identity?: string | null;
  model?: string | null;
  routerOsVersion?: string | null;
  uptime?: string | null;
}

/* ============================================================
   COMPONENT
============================================================ */

export default function AddRouter() {
  const navigate = useNavigate();

  const [form, setForm] = useState<RouterForm>({
    name: "",
    code: "",
    host: "192.168.88.1",
    port: 8728,
    username: "admin",
    password: "",
    siteId: "",
  });

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [testResult, setTestResult] =
    useState<TestResult | null>(null);

  const [error, setError] = useState("");

  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSites() {
      try {
        const data = await getSites();

        if (mounted) {
          setSites(data);
        }
      } catch (err) {
        console.error(
          "Erreur lors du chargement des sites :",
          err
        );
      } finally {
        if (mounted) {
          setSitesLoading(false);
        }
      }
    }

    loadSites();

    return () => {
      mounted = false;
    };
  }, []);

  /* ==========================================================
     UPDATE FIELD
  ========================================================== */

  function updateField(
    field: keyof RouterForm,
    value: string | number
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setTestResult(null);
    setError("");
  }

  /* ==========================================================
     VALIDATION CONNECTION
  ========================================================== */

  function validateConnection(): string | null {
    if (!form.host.trim()) {
      return "L'adresse IP ou le hostname du routeur est obligatoire.";
    }

    if (
      !Number.isInteger(form.port) ||
      form.port < 1 ||
      form.port > 65535
    ) {
      return "Le port API doit être compris entre 1 et 65535.";
    }

    if (!form.username.trim()) {
      return "L'utilisateur MikroTik est obligatoire.";
    }

    if (!form.password) {
      return "Le mot de passe MikroTik est obligatoire.";
    }

    return null;
  }

  /* ==========================================================
     VALIDATION CREATE
  ========================================================== */

  function validateForm(): string | null {
    if (!form.name.trim()) {
      return "Le nom du routeur est obligatoire.";
    }

    if (!form.code.trim()) {
      return "Le code du routeur est obligatoire.";
    }

    if (!form.siteId.trim()) {
      return "Le site est obligatoire.";
    }

    return validateConnection();
  }

  /* ==========================================================
     TEST CONNECTION
  ========================================================== */

  async function handleTestConnection() {
    const validationError =
      validateConnection();

    if (validationError) {
      setError(validationError);
      return;
    }

    setTesting(true);
    setError("");
    setTestResult(null);

    try {
      const response = await api.post(
        "/api/routers/test-connection",
        {
          host: form.host.trim(),
          port: form.port,
          username: form.username.trim(),
          password: form.password,
        }
      );

      /*
       * Backend :
       *
       * {
       *   success: true,
       *   message: "...",
       *   data: {
       *     identity,
       *     model,
       *     routerOsVersion,
       *     uptime
       *   }
       * }
       */

      const result =
        response.data?.data ?? {};

      setTestResult({
        success:
          response.data?.success === true,

        message:
          response.data?.message ??
          "Connexion MikroTik réussie.",

        identity:
          result.identity ?? null,

        model:
          result.model ?? null,

        routerOsVersion:
          result.routerOsVersion ??
          result.version ??
          null,

        uptime:
          result.uptime ?? null,
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err?.response?.data?.error ??
          "Impossible de se connecter au routeur MikroTik."
      );
    } finally {
      setTesting(false);
    }
  }

  /* ==========================================================
     CREATE ROUTER
  ========================================================== */

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const validationError =
      validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        siteId: form.siteId.trim(),

        name: form.name.trim(),

        code: form.code.trim(),

        host: form.host.trim(),

        port: form.port,

        username:
          form.username.trim(),

        password:
          form.password,
      };

      await api.post(
        "/api/routers",
        payload
      );

      navigate("/routers");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err?.response?.data?.error ??
          "Impossible d'enregistrer le routeur."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Infrastructure réseau"
        title="Ajouter un routeur"
        description="Connectez un routeur MikroTik réel à HOTSPOT MANAGEMENT V2."
        actions={
          <button
            type="button"
            onClick={() =>
              navigate("/routers")
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
        }
      />

      <form
        onSubmit={handleSubmit}
        className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <RouterIcon size={20} />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Connexion MikroTik
            </h2>

            <p className="text-sm text-slate-400">
              Paramètres API RouterOS
            </p>
          </div>
        </div>

        {/* =====================================================
            FORM
        ===================================================== */}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Nom du routeur"
            value={form.name}
            placeholder="WIFI ZONE"
            onChange={(value) =>
              updateField(
                "name",
                value
              )
            }
          />

          <Field
            label="Code du routeur"
            value={form.code}
            placeholder="ROUTER-MAH-01"
            onChange={(value) =>
              updateField(
                "code",
                value.toUpperCase()
              )
            }
          />

          <Field
            label="Adresse IP / Host"
            value={form.host}
            placeholder="192.168.88.1"
            onChange={(value) =>
              updateField(
                "host",
                value
              )
            }
          />

          <Field
            label="Port API"
            value={String(form.port)}
            placeholder="8728"
            type="number"
            onChange={(value) =>
              updateField(
                "port",
                Number(value)
              )
            }
          />

          <Field
            label="Utilisateur"
            value={form.username}
            placeholder="admin"
            onChange={(value) =>
              updateField(
                "username",
                value
              )
            }
          />

          <Field
            label="Mot de passe"
            value={form.password}
            type="password"
            placeholder="Mot de passe MikroTik"
            onChange={(value) =>
              updateField(
                "password",
                value
              )
            }
          />

          <div className="sm:col-span-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Site
              </span>

              <select
                value={form.siteId}
                onChange={(event) =>
                  updateField("siteId", event.target.value)
                }
                disabled={sitesLoading}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {sitesLoading
                    ? "Chargement des sites..."
                    : "Sélectionnez un site"}
                </option>

                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} ({site.code})
                  </option>
                ))}
              </select>
            </label>

            {!sitesLoading && sites.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-600">
                Aucun site n'existe encore.{" "}
                <button
                  type="button"
                  onClick={() => navigate("/sites/new")}
                  className="font-semibold underline"
                >
                  Créer un site
                </button>{" "}
                avant d'ajouter un routeur.
              </p>
            )}
          </div>
        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* =====================================================
            TEST SUCCESS
        ===================================================== */}

        {testResult?.success && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-emerald-600"
            />

            <div className="space-y-1">
              <p className="text-sm font-semibold text-emerald-700">
                Connexion réussie
              </p>

              <p className="text-sm text-emerald-600">
                {testResult.message}
              </p>

              {testResult.identity && (
                <p className="text-xs text-emerald-600">
                  Identity :{" "}
                  <strong>
                    {testResult.identity}
                  </strong>
                </p>
              )}

              {testResult.model && (
                <p className="text-xs text-emerald-600">
                  Modèle :{" "}
                  {testResult.model}
                </p>
              )}

              {testResult.routerOsVersion && (
                <p className="text-xs text-emerald-600">
                  RouterOS :{" "}
                  {testResult.routerOsVersion}
                </p>
              )}

              {testResult.uptime && (
                <p className="text-xs text-emerald-600">
                  Uptime :{" "}
                  {testResult.uptime}
                </p>
              )}
            </div>
          </div>
        )}

        {/* =====================================================
            ACTIONS
        ===================================================== */}

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={
              handleTestConnection
            }
            disabled={testing || saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testing && (
              <Loader2
                size={16}
                className="animate-spin"
              />
            )}

            {testing
              ? "Test en cours..."
              : "Tester la connexion"}
          </button>

          <button
            type="submit"
            disabled={
              saving ||
              testing
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && (
              <Loader2
                size={16}
                className="animate-spin"
              />
            )}

            {saving
              ? "Enregistrement..."
              : "Enregistrer le routeur"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   FIELD
============================================================ */

interface FieldProps {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (
    value: string
  ) => void;
}

function Field({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        min={
          type === "number"
            ? 1
            : undefined
        }
        max={
          type === "number"
            ? 65535
            : undefined
        }
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}