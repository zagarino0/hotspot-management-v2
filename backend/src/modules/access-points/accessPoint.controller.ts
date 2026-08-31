import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  createAccessPoint,
  deleteAccessPointById,
  getAccessPointById,
  getAccessPoints,
  updateAccessPointData,
} from "./accessPoint.service.js";

export async function listAccessPoints(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const accessPoints = await getAccessPoints();

    return res.status(200).json({
      success: true,
      data: accessPoints,
      count: accessPoints.length,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getAccessPoint(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    const accessPoint = await getAccessPointById(
      String(id ?? "")
    );

    return res.status(200).json({
      success: true,
      data: accessPoint,
    });
  } catch (error) {
    return next(error);
  }
}

export async function createAccessPointController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      siteId,
      routerId,
      name,
      code,
      vendor,
      model,
      macAddress,
      managementIp,
      ssid,
      band,
    } = req.body;

    if (typeof siteId !== "string" || !siteId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Le site du point d'accès est obligatoire.",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Le nom du point d'accès est obligatoire.",
      });
    }

    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Le code du point d'accès est obligatoire.",
      });
    }

    const accessPoint = await createAccessPoint({
      siteId: siteId.trim(),
      routerId:
        typeof routerId === "string" && routerId.trim()
          ? routerId.trim()
          : null,
      name: name.trim(),
      code: code.trim(),
      vendor:
        typeof vendor === "string" && vendor.trim()
          ? vendor.trim()
          : null,
      model:
        typeof model === "string" && model.trim()
          ? model.trim()
          : null,
      macAddress:
        typeof macAddress === "string" && macAddress.trim()
          ? macAddress.trim().toUpperCase()
          : null,
      managementIp:
        typeof managementIp === "string" &&
        managementIp.trim()
          ? managementIp.trim()
          : null,
      ssid:
        typeof ssid === "string" && ssid.trim()
          ? ssid.trim()
          : null,
      band:
        typeof band === "string" && band.trim()
          ? band.trim()
          : null,
    });

    return res.status(201).json({
      success: true,
      message: "Point d'accès ajouté avec succès.",
      data: accessPoint,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   UPDATE
============================================================ */

export async function updateAccessPointController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { name, routerId, vendor, model, macAddress, managementIp } =
      req.body;

    const accessPoint = await updateAccessPointData(
      String(id ?? ""),
      {
        name:
          typeof name === "string" && name.trim()
            ? name.trim()
            : undefined,
        routerId:
          routerId === null
            ? null
            : typeof routerId === "string"
              ? routerId.trim() || null
              : undefined,
        vendor:
          vendor === null
            ? null
            : typeof vendor === "string"
              ? vendor.trim() || null
              : undefined,
        model:
          model === null
            ? null
            : typeof model === "string"
              ? model.trim() || null
              : undefined,
        macAddress:
          macAddress === null
            ? null
            : typeof macAddress === "string"
              ? macAddress.trim().toUpperCase() || null
              : undefined,
        managementIp:
          managementIp === null
            ? null
            : typeof managementIp === "string"
              ? managementIp.trim() || null
              : undefined,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Point d'accès mis à jour avec succès.",
      data: accessPoint,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteAccessPointController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    await deleteAccessPointById(String(id ?? ""));

    return res.status(200).json({
      success: true,
      message: "Point d'accès supprimé avec succès.",
    });
  } catch (error) {
    return next(error);
  }
}
