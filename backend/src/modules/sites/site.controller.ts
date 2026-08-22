import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  createSite,
  deleteSiteById,
  getSiteById,
  getSites,
  updateSiteData,
} from "./site.service.js";

/* ============================================================
   LIST
============================================================ */

export async function listSites(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const sites = await getSites();

    return res.status(200).json({
      success: true,
      data: sites,
      count: sites.length,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   FIND
============================================================ */

export async function getSite(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    const site = await getSiteById(String(id ?? ""));

    return res.status(200).json({
      success: true,
      data: site,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   CREATE
============================================================ */

export async function createSiteController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { name, code, description, address, city, region, district, timezone } =
      req.body;

    /* --------------------------------------------------------
       ORGANIZATION
       Toujours dérivée du token JWT de l'utilisateur connecté,
       jamais du corps de la requête (un utilisateur ne doit
       jamais pouvoir créer un site pour une autre organisation).
    -------------------------------------------------------- */

    const organizationId = req.auth?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentification requise.",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Le nom du site est obligatoire.",
      });
    }

    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Le code du site est obligatoire.",
      });
    }

    const site = await createSite({
      organizationId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description:
        typeof description === "string" && description.trim()
          ? description.trim()
          : null,
      address:
        typeof address === "string" && address.trim()
          ? address.trim()
          : null,
      city:
        typeof city === "string" && city.trim()
          ? city.trim()
          : null,
      region:
        typeof region === "string" && region.trim()
          ? region.trim()
          : null,
      district:
        typeof district === "string" && district.trim()
          ? district.trim()
          : null,
      timezone:
        typeof timezone === "string" && timezone.trim()
          ? timezone.trim()
          : null,
    });

    return res.status(201).json({
      success: true,
      message: "Site créé avec succès.",
      data: site,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   UPDATE
============================================================ */

export async function updateSiteController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      description,
      address,
      city,
      region,
      district,
      timezone,
      status,
    } = req.body;

    const site = await updateSiteData(String(id ?? ""), {
      name:
        typeof name === "string" && name.trim()
          ? name.trim()
          : undefined,
      code:
        typeof code === "string" && code.trim()
          ? code.trim().toUpperCase()
          : undefined,
      description:
        description === null
          ? null
          : typeof description === "string"
            ? description.trim() || null
            : undefined,
      address:
        address === null
          ? null
          : typeof address === "string"
            ? address.trim() || null
            : undefined,
      city:
        city === null
          ? null
          : typeof city === "string"
            ? city.trim() || null
            : undefined,
      region:
        region === null
          ? null
          : typeof region === "string"
            ? region.trim() || null
            : undefined,
      district:
        district === null
          ? null
          : typeof district === "string"
            ? district.trim() || null
            : undefined,
      timezone:
        timezone === null
          ? null
          : typeof timezone === "string"
            ? timezone.trim() || null
            : undefined,
      status:
        typeof status === "string" ? (status as any) : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Site mis à jour avec succès.",
      data: site,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteSiteController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    await deleteSiteById(String(id ?? ""));

    return res.status(200).json({
      success: true,
      message: "Site supprimé avec succès.",
    });
  } catch (error) {
    return next(error);
  }
}
