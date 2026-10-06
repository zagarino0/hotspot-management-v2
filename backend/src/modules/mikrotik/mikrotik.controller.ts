import { Request, Response } from "express";
import { pool } from "../../database/pool.js";
import { findRoutersForSync, findRouterCredential } from "../routers/router.repository.js";
import { connectMikroTik, type MikroTikConnectionConfig } from "../../mikrotik/connection.js";
import { fetchHotspotProfiles } from "../../mikrotik/hotspotProfiles.js";
import { decryptSecret } from "../../lib/crypto.js";

export async function getHotspotProfiles(req: Request, res: Response): Promise<Response> {
  try {
    const { siteId } = req.params;

    if (!siteId) {
      return res.status(400).json({ message: "siteId est requis" });
    }

    // Récupérer les routeurs pour ce site
    const routers = await pool.query(
      `SELECT id, management_ip, api_port, domain_name
       FROM router
       WHERE site_id = $1 AND sync_enabled = true`,
      [siteId]
    );

    if (routers.rows.length === 0) {
      return res.status(404).json({ message: "Aucun routeur trouvé pour ce site" });
    }

    const allProfiles: any[] = [];

    // Récupérer les profils de chaque routeur
    for (const router of routers.rows) {
      try {
        // Récupérer les credentials via la fonction existante
        const credential = await findRouterCredential(router.id);

        if (!credential) {
          console.error(`Aucun credential trouvé pour routeur ${router.id}`);
          continue;
        }

        const decryptedPassword = await decryptSecret(credential.encryptedSecret);
        const api = await connectMikroTik({
          host: router.domain_name || router.management_ip,
          port: router.api_port,
          user: credential.username,
          password: decryptedPassword,
        });

        const profiles = await fetchHotspotProfiles(api);
        allProfiles.push(...profiles);
        api.close();
      } catch (error) {
        console.error(`Erreur pour le routeur ${router.id}:`, error);
        // Continuer avec les autres routeurs
      }
    }

    // Dédoublonner les profils par nom
    const uniqueProfiles = Array.from(
      new Map(allProfiles.map((profile) => [profile.name, profile])).values()
    );

    return res.json({
      profiles: uniqueProfiles,
      count: uniqueProfiles.length,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des profils:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
}
