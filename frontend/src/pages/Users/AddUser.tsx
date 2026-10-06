import type React from "react";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import { createUser } from "../../services/userService";
import { getRoles, type Role } from "../../services/roleService";

interface UserForm {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

const INITIAL_FORM: UserForm = {
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
};

export default function AddUser() {
  const navigate = useNavigate();

  const [form, setForm] = useState<UserForm>(INITIAL_FORM);
  const [selectedRoleIds, setSelectedRoleIds] = useState<
    string[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRoles() {
      try {
        const data = await getRoles();

        if (mounted) {
          setRoles(data);
        }
      } catch (err) {
        console.error(
          "Erreur lors du chargement des rôles :",
          err
        );
      } finally {
        if (mounted) {
          setRolesLoading(false);
        }
      }
    }

    loadRoles();

    return () => {
      mounted = false;
    };
  }, []);

  function updateField(field: keyof UserForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function toggleRole(roleId: string) {
    setSelectedRoleIds((current) =>
      current.indexOf(roleId) !== -1
        ? current.filter((id) => id !== roleId)
        : [...current, roleId]
    );
  }

  function validateForm(): string | null {
    if (!form.username.trim()) {
      return "L'identifiant est obligatoire.";
    }

    if (!form.password || form.password.length < 8) {
      return "Le mot de passe doit contenir au moins 8 caractères.";
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
      await createUser({
        username: form.username.trim(),
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
        status: "ACTIVE",
        roleIds: selectedRoleIds,
      });

      navigate("/users");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          "Impossible de créer cet utilisateur."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Ajouter un utilisateur"
        description="Créez un nouveau compte d'accès à la plateforme."
        actions={
          <button
            type="button"
            onClick={() => navigate("/users")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
        }
      />

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <UserPlus size={20} />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Informations du compte
            </h2>
            <p className="text-sm text-slate-400">
              L'utilisateur pourra changer son mot de passe après sa
              première connexion.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Identifiant"
            value={form.username}
            placeholder="jrakoto"
            onChange={(v) => updateField("username", v)}
          />

          <Field
            label="Mot de passe"
            value={form.password}
            type="password"
            placeholder="8 caractères minimum"
            onChange={(v) => updateField("password", v)}
          />

          <Field
            label="Prénom"
            value={form.firstName}
            placeholder="Jean"
            onChange={(v) => updateField("firstName", v)}
          />

          <Field
            label="Nom"
            value={form.lastName}
            placeholder="Rakoto"
            onChange={(v) => updateField("lastName", v)}
          />

          <Field
            label="Email"
            value={form.email}
            placeholder="jean@example.com"
            onChange={(v) => updateField("email", v)}
          />

          <Field
            label="Téléphone"
            value={form.phone}
            placeholder="034 00 000 00"
            onChange={(v) => updateField("phone", v)}
          />
        </div>

        <div className="mt-6">
          <span className="mb-2 block text-xs font-semibold text-slate-600">
            Rôles
          </span>

          {rolesLoading ? (
            <p className="text-xs text-slate-400">
              Chargement des rôles...
            </p>
          ) : roles.length === 0 ? (
            <p className="text-xs text-amber-600">
              Aucun rôle disponible.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={
                      selectedRoleIds.indexOf(role.id) !== -1
                    }
                    onChange={() => toggleRole(role.id)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="font-medium">
                    {role.name}
                  </span>
                  {role.isSystem && (
                    <span className="ml-auto text-[10px] font-semibold text-slate-400">
                      Système
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
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
            {saving ? "Création..." : "Créer l'utilisateur"}
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
  type?: string;
  onChange: (value: string) => void;
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
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}
