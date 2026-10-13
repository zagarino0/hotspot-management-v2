import { pool } from "../../database/pool.js";
import { decryptSecret } from "../../lib/crypto.js";
import { connectMikroTik, type MikroTikConnectionConfig } from "../../mikrotik/connection.js";
import {
  fetchHotspotProfiles,
  type HotspotProfile,
} from "../../mikrotik/hotspotProfiles.js";
import type { RouterOSAPI } from "node-routeros";

interface SiteRouterRow {
  id: string;
  management_ip: string | null;
  api_port: number;
  domain_name: string | null;
}

async function findSiteRouter(siteId: string, routerId?: string): Promise<SiteRouterRow> {
  const result = await pool.query<SiteRouterRow>(
    `
      SELECT
        id,
        management_ip::text AS management_ip,
        api_port,
        domain_name
      FROM router
      WHERE site_id = $1
        AND sync_enabled = true
        AND ($2::uuid IS NULL OR id = $2::uuid)
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [siteId, routerId || null]
  );

  const router = result.rows[0];

  if (!router) {
    throw new Error(
      "Aucun routeur MikroTik actif n'est associé à ce site."
    );
  }

  if (!router.domain_name && !router.management_ip) {
    throw new Error(
      "Le routeur MikroTik associé au site ne possède aucune adresse de connexion."
    );
  }

  return router;
}

async function openSiteMikroTikConnection(
  siteId: string,
  routerId?: string
): Promise<RouterOSAPI> {
  const router = await findSiteRouter(siteId, routerId);

  const credentialResult = await pool.query<{
    username: string;
    encryptedSecret: string;
  }>(
    `
      SELECT
        username,
        encrypted_secret AS "encryptedSecret"
      FROM router_credential
      WHERE router_id = $1
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [router.id]
  );

  const credential = credentialResult.rows[0];

  if (!credential) {
    throw new Error(
      "Aucun identifiant actif n'est enregistré pour le routeur MikroTik associé."
    );
  }

  const password = await decryptSecret(credential.encryptedSecret);

  const host = (router.domain_name || router.management_ip || "")
    .split("/")[0]
    .trim();

  if (!host) {
    throw new Error(
      "Le routeur MikroTik associé au site ne possède aucune adresse de connexion valide."
    );
  }

  const config: MikroTikConnectionConfig = {
    host,
    port: router.api_port,
    user: credential.username,
    password,
  };

  return connectMikroTik(config);
}

export async function getSiteHotspotProfiles(
  siteId: string,
  routerId?: string
): Promise<HotspotProfile[]> {
  const api = await openSiteMikroTikConnection(siteId, routerId);

  try {
    return await fetchHotspotProfiles(api);
  } finally {
    api.close();
  }
}

export async function createHotspotUser(
  siteId: string,
  code: string,
  profile: string
): Promise<void> {
  const api = await openSiteMikroTikConnection(siteId);

  try {
    const profiles = await fetchHotspotProfiles(api);
    const exists = profiles.some(
      (item) => item.name === profile
    );

    if (!exists) {
      throw new Error(
        `Le User Profile MikroTik "${profile}" n'existe pas sur le routeur associé au site.`
      );
    }

    await api.write("/ip/hotspot/user/add", [
      `=name=${code}`,
      `=password=${code}`,
      `=profile=${profile}`,
    ]);
  } finally {
    api.close();
  }
}


export interface CreateSiteHotspotProfileInput {
  name: string;
  sessionTimeout: string;
  rateLimit?: string;
}

export async function createSiteHotspotProfile(
  siteId: string,
  routerId: string,
  input: CreateSiteHotspotProfileInput
): Promise<HotspotProfile> {
  const name = input.name.trim();
  const sessionTimeout = input.sessionTimeout.trim();
  if (!name || name.length > 50) throw new Error("Le nom du profil est obligatoire et limité à 50 caractères.");
  if (!sessionTimeout || !/^(?:(?:\d+w)?\s*(?:\d+d)?\s*(?:\d+h)?\s*(?:\d+m)?\s*(?:\d+s)?)$/.test(sessionTimeout) || !/[1-9]/.test(sessionTimeout)) {
    throw new Error("La durée doit être un intervalle RouterOS valide, par exemple 1h ou 1d.");
  }
  const api = await openSiteMikroTikConnection(siteId, routerId);
  try {
    const existing = await fetchHotspotProfiles(api);
    if (existing.some((profile) => profile.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Le profil MikroTik "${name}" existe déjà sur ce routeur.`);
    }
    const args = [`=name=${name}`, `=session-timeout=${sessionTimeout}`];
    if (input.rateLimit?.trim()) args.push(`=rate-limit=${input.rateLimit.trim()}`);
    await api.write("/ip/hotspot/user/profile/add", args);
    const verified = await fetchHotspotProfiles(api);
    const created = verified.find((profile) => profile.name === name);
    if (!created) throw new Error("Le profil a été envoyé à MikroTik mais sa création n'a pas pu être vérifiée.");
    return created;
  } finally {
    api.close();
  }
}
