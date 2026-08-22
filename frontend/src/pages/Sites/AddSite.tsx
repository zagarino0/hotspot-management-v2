import type React from "react";
import { useState } from "react";
import {
  ArrowLeft,
  Loader2,
  MapPin,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import { createSite } from "../../services/siteService";

/* ============================================================
   FORM DATA
============================================================ */

interface SiteForm {
  name: string;
  code: string;
  address: string;
  city: string;
  region: string;
  district: string;
  timezone: string;
  description: string;
}

const INITIAL_FORM: SiteForm = {
  name: "",
  code: "",
  address: "",
  city: "",
  region: "",
  district: "",
  timezone: "Indian/Antananarivo",
  description: "",
};

/* ============================================================
   COMPONENT
============================================================ */

export default function AddSite() {
  const navigate = useNavigate();

  const [form, setForm] = useState<SiteForm>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(
    field: keyof SiteForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
  }

  function validateForm(): string | null {
    if (!form.name.trim()) {
      return "Le nom du site est obligatoire.";
    }

    if (!form.code.trim()) {
      return "Le code du site est obligatoire.";
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
      await createSite({
        name: form.name.trim(),
        code: form.code.trim(),
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        region: form.region.trim() || undefined,
        district: form.district.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
        description: form.description.trim() || undefined,
      });

      navigate("/sites");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          "Impossible d'enregistrer le site."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Infrastructure"
        title="Ajouter un site"
        description="Créez un nouveau site ou zone WiFi dans votre infrastructure."
        actions={
          <button
            type="button"
            onClick={() => navigate("/sites")}
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
            <MapPin size={20} />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Informations du site
            </h2>

            <p className="text-sm text-slate-400">
              Ces informations servent à organiser vos routeurs, points
              d'accès et clients par zone géographique.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Nom du site"
            value={form.name}
            placeholder="WIFI MAHAVOKY"
            onChange={(value) => updateField("name", value)}
          />

          <Field
            label="Code du site"
            value={form.code}
            placeholder="MAH-01"
            onChange={(value) =>
              updateField("code", value.toUpperCase())
            }
          />

          <Field
            label="Ville"
            value={form.city}
            placeholder="Mahajanga"
            onChange={(value) => updateField("city", value)}
          />

          <Field
            label="Région"
            value={form.region}
            placeholder="Boeny"
            onChange={(value) => updateField("region", value)}
          />

          <Field
            label="District"
            value={form.district}
            placeholder="Mahajanga I"
            onChange={(value) => updateField("district", value)}
          />

          <Field
            label="Fuseau horaire"
            value={form.timezone}
            placeholder="Indian/Antananarivo"
            onChange={(value) => updateField("timezone", value)}
          />

          <div className="sm:col-span-2">
            <Field
              label="Adresse"
              value={form.address}
              placeholder="Lot II M 45, Mahavoky Sud"
              onChange={(value) => updateField("address", value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Description (facultatif)
              </span>

              <textarea
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                rows={3}
                placeholder="Notes internes sur ce site..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </label>
          </div>
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

            {saving ? "Enregistrement..." : "Enregistrer le site"}
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
