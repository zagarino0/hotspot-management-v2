import { Request, Response } from "express";
import { createSiteHotspotProfile, getSiteHotspotProfiles } from "./mikrotik.service.js";

export async function getHotspotProfiles(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const siteId =
      typeof req.params.siteId === "string"
        ? req.params.siteId
        : undefined;

    if (!siteId) {
      return res.status(400).json({
        success: false,
        message: "siteId est requis",
      });
    }

    const routerId = typeof req.query.routerId === "string" ? req.query.routerId.trim() : undefined;
    const profiles = await getSiteHotspotProfiles(siteId, routerId);

    return res.json({
      success: true,
      profiles,
      count: profiles.length,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des profils MikroTik:",
      error
    );

    return res.status(502).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Impossible de récupérer les User Profiles du MikroTik.",
    });
  }
}


export async function createHotspotProfile(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const siteId = typeof req.params.siteId === "string" ? req.params.siteId : "";
    const routerId = typeof req.body?.routerId === "string" ? req.body.routerId.trim() : "";
    const name = typeof req.body?.name === "string" ? req.body.name : "";
    const sessionTimeout = typeof req.body?.sessionTimeout === "string" ? req.body.sessionTimeout : "";
    const rateLimit = typeof req.body?.rateLimit === "string" ? req.body.rateLimit : undefined;
    if (!siteId || !routerId || !name.trim() || !sessionTimeout.trim()) {
      return res.status(400).json({ success: false, message: "Site, routeur, nom et durée du profil sont obligatoires." });
    }
    const profile = await createSiteHotspotProfile(siteId, routerId, { name, sessionTimeout, rateLimit });
    return res.status(201).json({ success: true, message: "Profil MikroTik créé et vérifié.", profile });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Impossible de créer le profil MikroTik.",
    });
  }
}
