import { Request, Response } from "express";
import { getSiteHotspotProfiles } from "./mikrotik.service.js";

export async function getHotspotProfiles(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const { siteId } = req.params;

    if (!siteId) {
      return res.status(400).json({
        success: false,
        message: "siteId est requis",
      });
    }

    const profiles = await getSiteHotspotProfiles(siteId);

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
