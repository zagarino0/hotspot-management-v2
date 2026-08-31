import type React from "react";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import { createAccessPoint } from "../../services/accessPointService";
import { getSites, type Site } from "../../services/siteService";
import {
  getRouters,
  type Router,
} from "../../services/routerService";

interface AccessPointForm {
  siteId: string;
  routerId: string;
  name: string;
  code: string;
  vendor: string;
  model: string;
  macAddress: string;
  managementIp: string;
  ssid: string;
  band: string;
}

const INITIAL_FORM: AccessPointForm = {
  siteId: "",
  routerId: "",
  name: "",
  code: "",
  vendor: "",
  model: "",
  macAddress: "",
  managementIp: "",
  ssid: "",
  band: "2.4GHZ",
};

export default function AddAccessPoint() {
  const navigate = useNavigate();

  const [form, setForm] =
    useState<AccessPointForm>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [sites, setSites] = useState<Site[]>([]);
  const [routers, setRouters] = useState<Router[]>([]);
  const [refLoading, setRefLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRefs() {
      try {
        const [sitesData, routersData] = await Promise.all([
          getSites(),
          getRouters(),
        ]);

        if (mounted) {
          setSites(sitesData);
          setRouters(routersData);
        }
      } catch (err) {
        console.error(
          "Erreur lors du chargement des sites/routeurs :",
          err
        );
      } finally {
        if (mounted) {
          setRefLoading(false);
        }
      }
    }

    loadRefs();

    return () => {
      mounted = false;
    };
  }, []);

  function updateField(
    field: keyof AccessPointForm,
    value: string
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function validateForm(): string | null {
    if (!form.siteId.trim()) {
      return "Le site est obligatoire.";
    }

    if (!form.name.trim()) {
      return "Le nom du point d'accès est obligatoire.";
    }

    if (!form.code.trim()) {
      return "Le code du point d'accès est obligatoire.";
    }

    return null;
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await createAccessPoint({
        siteId: form.siteId.trim(),
        routerId: form.routerId.trim() || undefined,
        name: form.name.trim(),
        code: form.code.trim(),
        vendor: form.vendor.trim() || undefined,
        model: form.model.trim() || undefined,
        macAddress: form.macAddress.trim() || undefined,
        managementIp: form.managementIp.trim() || undefined,
        ssid: form.ssid.trim() || undefined,
        band: form.ssid.trim() ? form.band : undefined,
      });

      navigate("/access-points");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          "Impossible d'enregistrer le point d'accès."
      );
    } finally {
      setSaving(false);
    }
  }

  const routersForSite = routers.filter(
    (router) => router.siteId === form.siteId
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Infrastructure WiFi"
        title="Ajouter un point d'accès"
        description="Enregistrez un nouveau point d'accès WiFi rattaché à un site."
        actions={
          <button
            type="button"
            onClick={() => navigate("/access-points")}
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
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Radio size={20} />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Informations du point d'accès
            </h2>

            <p className="text-sm text-slate-400">
              La radio (SSID/bande) est facultative — vous pourrez en
              ajouter d'autres plus tard.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Site
              </span>

              <select
                value={form.siteId}
                onChange={(event) => {
                  updateField("siteId", event.target.value);
                  updateField("routerId", "");
                }}
                disabled={refLoading}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {refLoading
                    ? "Chargement..."
                    : "Sélectionnez un site"}
                </option>

                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} ({site.code})
                  </option>
                ))}
              </select>
            </label>

            {!refLoading && sites.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-600">
                Aucun site n'existe encore.{" "}
                <button
                  type="button"
                  onClick={() => navigate("/sites/new")}
                  className="font-semibold underline"
                >
                  Créer un site
                </button>
              </p>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Routeur (facultatif)
            </span>

            <select
              value={form.routerId}
              onChange={(event) =>
                updateField("routerId", event.target.value)
              }
              disabled={refLoading || !form.siteId}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Aucun</option>

              {routersForSite.map((router) => (
                <option key={router.id} value={router.id}>
                  {router.name}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Nom du point d'accès"
            value={form.name}
            placeholder="Wavlink AP 01"
            onChange={(value) => updateField("name", value)}
          />

          <Field
            label="Code"
            value={form.code}
            placeholder="AP-MAH-01"
            onChange={(value) =>
              updateField("code", value.toUpperCase())
            }
          />

          <Field
            label="Fabricant"
            value={form.vendor}
            placeholder="Wavlink"
            onChange={(value) => updateField("vendor", value)}
          />

          <Field
            label="Modèle"
            value={form.model}
            placeholder="AC600"
            onChange={(value) => updateField("model", value)}
          />

          <Field
            label="Adresse MAC"
            value={form.macAddress}
            placeholder="AA:BB:CC:DD:EE:FF"
            onChange={(value) =>
              updateField("macAddress", value)
            }
          />

          <Field
            label="Adresse IP de gestion"
            value={form.managementIp}
            placeholder="192.168.88.2"
            onChange={(value) =>
              updateField("managementIp", value)
            }
          />

          <Field
            label="SSID (facultatif)"
            value={form.ssid}
            placeholder="WIFI MAHAVOKY"
            onChange={(value) => updateField("ssid", value)}
          />

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Bande
            </span>

            <select
              value={form.band}
              onChange={(event) =>
                updateField("band", event.target.value)
              }
              disabled={!form.ssid.trim()}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="2.4GHZ">2.4 GHz</option>
              <option value="5GHZ">5 GHz</option>
              <option value="6GHZ">6 GHz</option>
              <option value="OTHER">Autre</option>
            </select>
          </label>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && (
              <Loader2 size={16} className="animate-spin" />
            )}

            {saving
              ? "Enregistrement..."
              : "Enregistrer le point d'accès"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}
