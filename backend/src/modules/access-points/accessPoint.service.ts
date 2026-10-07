import {
  deleteAccessPoint,
  findAccessPointById,
  findAccessPoints,
  insertAccessPoint,
  updateAccessPoint,
  type UpdateAccessPointData,
} from "./accessPoint.repository.js";

import { conflict, notFoundError } from "../../lib/errors.js";
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from "../../lib/dbErrors.js";

import type { CreateAccessPointData } from "../../routes/accessPoint.types.js";
import { connectMikroTik } from "../../mikrotik/connection.js";
import { findRouterById, findRouterCredential } from "../routers/router.repository.js";
import { decryptSecret } from "../../lib/crypto.js";

export async function getAccessPoints() {
  return findAccessPoints();
}

export async function getAccessPointById(id: string) {
  const accessPoint = await findAccessPointById(id);

  if (!accessPoint) {
    throw notFoundError("Point d'accès introuvable.");
  }

  return accessPoint;
}

export async function updateAccessPointData(
  id: string,
  data: UpdateAccessPointData
) {
  await getAccessPointById(id);

  const updated = await updateAccessPoint(id, data);

  if (!updated) {
    throw notFoundError("Point d'accès introuvable.");
  }

  return updated;
}

export async function deleteAccessPointById(id: string) {
  await getAccessPointById(id);

  try {
    await deleteAccessPoint(id);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw conflict(
        "Impossible de supprimer ce point d'accès : des données y sont encore rattachées."
      );
    }

    throw error;
  }
}

export async function createAccessPoint(
  data: CreateAccessPointData
) {
  try {
    return await insertAccessPoint(data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(
        `Le code "${data.code}" est déjà utilisé sur ce site.`
      );
    }

    throw error;
  }
}


/* ============================================================
   DÉTECTION MAC DEPUIS L'IP DE GESTION

   Le routeur sélectionné est interrogé directement. On cherche
   d'abord l'IP dans la table ARP, puis dans les voisins MikroTik.
============================================================ */

export async function detectAccessPointMac(
  routerId: string,
  managementIp: string
) {
  const router = await findRouterById(routerId);

  if (!router) {
    throw notFoundError("Routeur introuvable.");
  }

  if (!router.managementIp) {
    throw conflict(
      "Le routeur sélectionné n'a pas d'adresse IP de gestion."
    );
  }

  const credential = await findRouterCredential(routerId);

  if (!credential) {
    throw conflict(
      "Aucun identifiant MikroTik actif n'est configuré pour ce routeur."
    );
  }

  const host = router.managementIp.split("/")[0].trim();

  const api = await connectMikroTik({
    host,
    port: router.apiPort || 8728,
    user: credential.username,
    password: decryptSecret(credential.encryptedSecret),
  });

  try {
    const arpEntries = await api.write("/ip/arp/print");
    const arpMatch = arpEntries.find(
      (entry: any) =>
        String(entry.address ?? "").trim() === managementIp
    );

    if (arpMatch?.["mac-address"]) {
      return {
        found: true,
        macAddress: String(arpMatch["mac-address"]).toUpperCase(),
        source: "arp" as const,
        interface: arpMatch.interface ?? null,
      };
    }

    try {
      const neighbors = await api.write("/ip/neighbor/print");
      const neighborMatch = neighbors.find(
        (entry: any) =>
          String(entry.address ?? "").trim() === managementIp
      );

      if (neighborMatch?.["mac-address"]) {
        return {
          found: true,
          macAddress: String(neighborMatch["mac-address"]).toUpperCase(),
          source: "neighbor" as const,
          interface: neighborMatch.interface ?? null,
        };
      }
    } catch {
      // Certains RouterOS ne permettent pas l'accès à /ip/neighbor.
    }

    return {
      found: false,
      macAddress: null,
      source: null,
      interface: null,
    };
  } finally {
    await api.close();
  }
}
