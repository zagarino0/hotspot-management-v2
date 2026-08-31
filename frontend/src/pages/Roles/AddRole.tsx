import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, ShieldPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import {
  createRole,
  getAllPermissions,
  type Permission,
} from "../../services/roleService";

const RESOURCE_LABELS: Record<string, string> = {
  ORGANIZATION: "Organisation",
  SITE: "Sites",
  USER: "Utilisateurs",
  ROLE: "Rôles",
  ROUTER: "Routeurs",
  ROUTER_CREDENTIAL: "Identifiants routeur",
  ACCESS_POINT: "Points d'accès",
  AP_RADIO: "Radios AP",
  PLAN: "Forfaits",
  VOUCHER: "Vouchers",
  VOUCHER_BATCH: "Lots de vouchers",
  CLIENT: "Clients",
  DEVICE: "Appareils",
  SESSION: "Sessions",
  SALE: "Ventes",
  PAYMENT: "Paiements",
  SYNC_JOB: "Synchronisation",
  ROUTER_EVENT: "Événements routeur",
  ROUTER_METRIC: "Métriques routeur",
  AUDIT_LOG: "Journal d'audit",
};

export default function AddRole() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] =
    useState<string[]>([]);

  const [permissions, setPermissions] = useState<Permission[]>(
    []
  );
  const [permissionsLoading, setPermissionsLoading] =
    useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPermissions() {
      try {
        const data = await getAllPermissions();

        if (mounted) {
          setPermissions(data);
        }
      } catch (err) {
        console.error(
          "Erreur lors du chargement des permissions :",
          err
        );
      } finally {
        if (mounted) {
          setPermissionsLoading(false);
        }
      }
    }

    loadPermissions();

    return () => {
      mounted = false;
    };
  }, []);

  const permissionsByResource = useMemo(() => {
    const map = new Map<string, Permission[]>();

    for (const permission of permissions) {
      const list = map.get(permission.resource) ?? [];
      list.push(permission);
      map.set(permission.resource, list);
    }

    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, [permissions]);

  function togglePermission(permissionId: string) {
    setSelectedPermissionIds((current) =>
      current.indexOf(permissionId) !== -1
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId]
    );
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Le nom du rôle est obligatoire.");
      return;
    }

    if (!code.trim()) {
      setError("Le code du rôle est obligatoire.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await createRole({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        permissionIds: selectedPermissionIds,
      });

      navigate("/roles");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          "Impossible de créer ce rôle."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Ajouter un rôle"
        description="Créez un rôle personnalisé et choisissez ses permissions."
        actions={
          <button
            type="button"
            onClick={() => navigate("/roles")}
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
            <ShieldPlus size={20} />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Informations du rôle
            </h2>
            <p className="text-sm text-slate-400">
              Cochez les permissions que ce rôle doit accorder.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Nom du rôle
            </span>
            <input
              type="text"
              value={name}
              placeholder="Support Niveau 1"
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Code
            </span>
            <input
              type="text"
              value={code}
              placeholder="SUPPORT_L1"
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setError("");
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </label>

          <div className="sm:col-span-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Description (facultatif)
              </span>
              <input
                type="text"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </label>
          </div>
        </div>

        <div className="mt-6">
          <span className="mb-2 block text-xs font-semibold text-slate-600">
            Permissions ({selectedPermissionIds.length}{" "}
            sélectionnée
            {selectedPermissionIds.length > 1 ? "s" : ""})
          </span>

          {permissionsLoading ? (
            <p className="text-xs text-slate-400">
              Chargement des permissions...
            </p>
          ) : (
            <div className="max-h-80 space-y-4 overflow-y-auto rounded-lg border border-slate-100 p-3">
              {permissionsByResource.map(
                ([resource, perms]) => (
                  <div key={resource}>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {RESOURCE_LABELS[resource] ?? resource}
                    </p>

                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {perms.map((permission) => (
                        <label
                          key={permission.id}
                          className="flex items-center gap-2 text-sm text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={
                              selectedPermissionIds.indexOf(
                                permission.id
                              ) !== -1
                            }
                            onChange={() =>
                              togglePermission(permission.id)
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          {permission.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              )}
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
            {saving ? "Création..." : "Créer le rôle"}
          </button>
        </div>
      </form>
    </div>
  );
}
