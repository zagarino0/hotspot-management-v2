import {
  Bell,
  Globe,
  Lock,
  Palette,
  Save,
  Server,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";

import PageHeader from "../../components/ui/PageHeader";

interface SettingsSectionProps {
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
  }>;
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Icon size={17} strokeWidth={1.8} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-950">
              {title}
            </h2>

            <p className="mt-0.5 text-xs text-slate-400">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {children}
      </div>
    </section>
  );
}

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({
  label,
  description,
  children,
}: SettingRowProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-100 py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">
          {label}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          {description}
        </p>
      </div>

      <div className="shrink-0">
        {children}
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Paramètres"
        description="Configurez les paramètres généraux de votre plateforme hotspot."
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Save size={16} strokeWidth={2} />
            Enregistrer
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {/* GÉNÉRAL */}

        <SettingsSection
          icon={SettingsIcon}
          title="Configuration générale"
          description="Informations principales de la plateforme"
        >
          <div className="space-y-4">
            <SettingRow
              label="Nom de la plateforme"
              description="Nom affiché dans l'interface d'administration."
            >
              <input
                type="text"
                defaultValue="Hotspot Management V2"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:w-64"
              />
            </SettingRow>

            <SettingRow
              label="Organisation"
              description="Organisation propriétaire de l'infrastructure."
            >
              <input
                type="text"
                defaultValue="NetConnect Solutions"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:w-64"
              />
            </SettingRow>

            <SettingRow
              label="Langue"
              description="Langue principale de l'interface."
            >
              <select
                defaultValue="fr"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:w-64"
              >
                <option value="fr">Français</option>
                <option value="mg">Malagasy</option>
                <option value="en">English</option>
              </select>
            </SettingRow>

            <SettingRow
              label="Fuseau horaire"
              description="Fuseau utilisé pour les sessions et statistiques."
            >
              <select
                defaultValue="Indian/Antananarivo"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:w-64"
              >
                <option value="Indian/Antananarivo">
                  Africa/Antananarivo
                </option>
                <option value="UTC">UTC</option>
              </select>
            </SettingRow>
          </div>
        </SettingsSection>

        {/* HOTSPOT */}

        <SettingsSection
          icon={Globe}
          title="Hotspot"
          description="Configuration générale du service hotspot"
        >
          <div className="space-y-4">
            <SettingRow
              label="Nom du hotspot"
              description="SSID ou nom public principal."
            >
              <input
                type="text"
                defaultValue="WIFI MAHAVOKY"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:w-64"
              />
            </SettingRow>

            <SettingRow
              label="Portail captif"
              description="Activer le portail captif pour les clients."
            >
              <Toggle defaultChecked />
            </SettingRow>

            <SettingRow
              label="Expiration des vouchers"
              description="Bloquer automatiquement les vouchers expirés."
            >
              <Toggle defaultChecked />
            </SettingRow>

            <SettingRow
              label="Limitation de débit"
              description="Appliquer les profils de débit MikroTik."
            >
              <Toggle defaultChecked />
            </SettingRow>
          </div>
        </SettingsSection>

        {/* NOTIFICATIONS */}

        <SettingsSection
          icon={Bell}
          title="Notifications"
          description="Gestion des alertes système"
        >
          <div className="space-y-4">
            <SettingRow
              label="Alertes système"
              description="Recevoir les alertes concernant l'infrastructure."
            >
              <Toggle defaultChecked />
            </SettingRow>

            <SettingRow
              label="Routeur hors ligne"
              description="Notifier lorsqu'un routeur devient inaccessible."
            >
              <Toggle defaultChecked />
            </SettingRow>

            <SettingRow
              label="Synchronisation"
              description="Afficher les erreurs de synchronisation."
            >
              <Toggle defaultChecked />
            </SettingRow>
          </div>
        </SettingsSection>

        {/* SÉCURITÉ */}

        <SettingsSection
          icon={ShieldCheck}
          title="Sécurité"
          description="Paramètres de sécurité de la plateforme"
        >
          <div className="space-y-4">
            <SettingRow
              label="Authentification obligatoire"
              description="Les utilisateurs doivent être authentifiés."
            >
              <Toggle defaultChecked />
            </SettingRow>

            <SettingRow
              label="Expiration de session"
              description="Durée maximale d'une session administrateur."
            >
              <select
                defaultValue="60"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:w-64"
              >
                <option value="30">30 minutes</option>
                <option value="60">1 heure</option>
                <option value="120">2 heures</option>
                <option value="480">8 heures</option>
              </select>
            </SettingRow>

            <SettingRow
              label="HTTPS"
              description="Connexion sécurisée à l'API."
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
                <Lock size={14} />
                Activé
              </div>
            </SettingRow>
          </div>
        </SettingsSection>

        {/* API */}

        <SettingsSection
          icon={Server}
          title="API & Infrastructure"
          description="Paramètres de connexion aux services"
        >
          <div className="space-y-4">
            <SettingRow
              label="API Backend"
              description="Adresse du serveur API principal."
            >
              <input
                type="text"
                defaultValue="/api"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:w-64"
              />
            </SettingRow>

            <SettingRow
              label="Base de données"
              description="État de la connexion PostgreSQL."
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                CONNECTÉE
              </span>
            </SettingRow>

            <SettingRow
              label="Synchronisation MikroTik"
              description="Synchronisation automatique des équipements."
            >
              <Toggle defaultChecked />
            </SettingRow>
          </div>
        </SettingsSection>

        {/* APPARENCE */}

        <SettingsSection
          icon={Palette}
          title="Apparence"
          description="Préférences visuelles de l'interface"
        >
          <div className="space-y-4">
            <SettingRow
              label="Thème"
              description="Thème graphique de l'application."
            >
              <select
                defaultValue="light"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:w-64"
              >
                <option value="light">Clair</option>
                <option value="dark">Sombre</option>
                <option value="system">Système</option>
              </select>
            </SettingRow>

            <SettingRow
              label="Animations"
              description="Activer les transitions et animations."
            >
              <Toggle defaultChecked />
            </SettingRow>
          </div>
        </SettingsSection>
      </div>

      {/* FOOTER */}

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <SettingsIcon size={14} />
          <span>Configuration locale de l'interface</span>
        </div>

        <span className="text-xs font-medium text-slate-400">
          Hotspot Management V2
        </span>
      </div>
    </div>
  );
}

/* ================================================================
   TOGGLE
================================================================ */

function Toggle({
  defaultChecked = false,
}: {
  defaultChecked?: boolean;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />

      <span className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-slate-950 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-slate-200" />

      <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
    </label>
  );
}