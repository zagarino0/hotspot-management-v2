import {
  CheckCircle2,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import PageHeader from "../../components/ui/PageHeader";
import { useAuth } from "../../contexts/AuthContext";
import {
  changeOwnPassword,
  updateUser,
} from "../../services/userService";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Jamais";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getDisplayName(
  firstName: string | null,
  lastName: string | null,
  username: string
): string {
  return (
    [firstName, lastName].filter(Boolean).join(" ") ||
    username
  );
}

export default function Account() {
  const { user, refreshUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    void refreshUser().catch(() => undefined);
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;

    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setEmail(user.email ?? "");
    setPhone(user.phone ?? "");
  }, [user]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Aucun compte connecté.
      </div>
    );
  }

  const displayName = getDisplayName(
    user.firstName,
    user.lastName,
    user.username
  );
  const roleName = user.roles[0]?.name ?? "Aucun rôle";
  const statusLabel =
    user.status === "ACTIVE" ? "Actif" : user.status;

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);
    setProfileError(null);

    try {
      await updateUser(user.id, {
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      });

      await refreshUser();
      setProfileMessage("Informations personnelles mises à jour.");
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : "Impossible de mettre à jour le compte."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("La confirmation du nouveau mot de passe ne correspond pas.");
      return;
    }

    setChangingPassword(true);

    try {
      await changeOwnPassword(
        currentPassword,
        newPassword
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Mot de passe modifié avec succès.");
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Impossible de modifier le mot de passe."
      );
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compte"
        title="Mon compte"
        description="Consultez et gérez les informations de votre compte utilisateur."
      />

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <form
          onSubmit={handleProfileSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6"
        >
          <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
              {displayName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950">
                Informations personnelles
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Ces informations sont utilisées dans votre profil.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field
              label="Prénom"
              value={firstName}
              onChange={setFirstName}
              placeholder="Prénom"
            />
            <Field
              label="Nom"
              value={lastName}
              onChange={setLastName}
              placeholder="Nom"
            />
            <Field
              label="Nom d'utilisateur"
              value={user.username}
              readOnly
              placeholder="Identifiant"
            />
            <Field
              label="E-mail"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="Adresse e-mail"
            />
            <Field
              label="Téléphone"
              value={phone}
              onChange={setPhone}
              placeholder="Numéro de téléphone"
            />
          </div>

          {profileMessage ? (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {profileMessage}
            </p>
          ) : null}

          {profileError ? (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {profileError}
            </p>
          ) : null}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
          <h2 className="text-base font-semibold text-slate-950">
            Informations du compte
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Données IAM du compte actuellement connecté.
          </p>

          <div className="mt-5 space-y-4">
            <InfoRow
              icon={<ShieldCheck size={17} />}
              label="Rôle"
              value={roleName}
            />
            <InfoRow
              icon={<CheckCircle2 size={17} />}
              label="Statut"
              value={statusLabel}
              positive={user.status === "ACTIVE"}
            />
            <InfoRow
              icon={<UserCircle size={17} />}
              label="Organisation"
              value={user.organizationId}
            />
            <InfoRow
              icon={<UserCircle size={17} />}
              label="Dernière connexion"
              value={formatDate(user.lastLoginAt)}
            />
            <InfoRow
              icon={<Mail size={17} />}
              label="E-mail vérifié"
              value={user.emailVerified ? "Oui" : "Non"}
            />
          </div>
        </div>
      </section>

      <form
        onSubmit={handlePasswordSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6"
      >
        <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <KeyRound size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Sécurité
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Modifiez votre mot de passe sans passer par l'administration des utilisateurs.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <PasswordField
            label="Mot de passe actuel"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <PasswordField
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={setNewPassword}
          />
          <PasswordField
            label="Confirmer le nouveau mot de passe"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
        </div>

        {passwordMessage ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {passwordMessage}
          </p>
        ) : null}

        {passwordError ? (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {passwordError}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={
              changingPassword ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {changingPassword
              ? "Modification..."
              : "Modifier le mot de passe"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 read-only:bg-slate-50"
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">
        {label}
      </span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={8}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}

function InfoRow({
  icon,
  label,
  value,
  positive = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400">{label}</p>
        <p
          className={
            positive
              ? "mt-0.5 text-sm font-semibold text-emerald-600"
              : "mt-0.5 truncate text-sm font-medium text-slate-700"
          }
        >
          {value}
        </p>
      </div>
    </div>
  );
}
