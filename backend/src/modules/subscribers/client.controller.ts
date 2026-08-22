import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  getClientById,
  getClients,
  createClient as createClientService,
  updateClientData,
  deleteClientById,
} from "./client.service.js";

/* ============================================================
   LIST CLIENTS
============================================================ */

export async function listClients(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const clients = await getClients();

    return res.status(200).json({
      success: true,
      data: clients,
      count: clients.length,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   GET CLIENT
============================================================ */

export async function getClient(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    if (typeof id !== "string" || !id.trim()) {
      return res.status(400).json({
        success: false,
        message: "Identifiant client invalide.",
      });
    }

    const client = await getClientById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client introuvable.",
      });
    }

    return res.status(200).json({
      success: true,
      data: client,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   CREATE CLIENT
============================================================ */

export async function createClient(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      siteId,
      username,
      displayName,
      phone,
      email,
      status,
    } = req.body;

    /* ----------------------------------------------------------
       siteId
    ---------------------------------------------------------- */

    if (
      typeof siteId !== "string" ||
      !siteId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "siteId est obligatoire.",
      });
    }

    /* ----------------------------------------------------------
       username
    ---------------------------------------------------------- */

    if (
      username !== undefined &&
      username !== null &&
      typeof username !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "username doit être une chaîne.",
      });
    }

    /* ----------------------------------------------------------
       displayName
    ---------------------------------------------------------- */

    if (
      displayName !== undefined &&
      displayName !== null &&
      typeof displayName !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "displayName doit être une chaîne.",
      });
    }

    /* ----------------------------------------------------------
       phone
    ---------------------------------------------------------- */

    if (
      phone !== undefined &&
      phone !== null &&
      typeof phone !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "phone doit être une chaîne.",
      });
    }

    /* ----------------------------------------------------------
       email
    ---------------------------------------------------------- */

    if (
      email !== undefined &&
      email !== null &&
      typeof email !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "email doit être une chaîne.",
      });
    }

    /* ----------------------------------------------------------
       status
    ---------------------------------------------------------- */

    if (
      status !== undefined &&
      status !== "ACTIVE" &&
      status !== "INACTIVE" &&
      status !== "BLOCKED" &&
      status !== "ARCHIVED"
    ) {
      return res.status(400).json({
        success: false,
        message: "Statut client invalide.",
      });
    }

    /* ----------------------------------------------------------
       CREATE
    ---------------------------------------------------------- */

    const client =
      await createClientService({
        siteId: siteId.trim(),

        username:
          typeof username === "string"
            ? username.trim() || null
            : null,

        displayName:
          typeof displayName === "string"
            ? displayName.trim() || null
            : null,

        phone:
          typeof phone === "string"
            ? phone.trim() || null
            : null,

        email:
          typeof email === "string"
            ? email.trim() || null
            : null,

        status,
      });

    return res.status(201).json({
      success: true,
      data: client,
    });
  } catch (error) {
    return next(error);
  }
}
/* ============================================================
   UPDATE CLIENT
============================================================ */

export async function updateClient(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { displayName, phone, email, status } = req.body;

    if (
      status !== undefined &&
      status !== "ACTIVE" &&
      status !== "INACTIVE" &&
      status !== "BLOCKED" &&
      status !== "ARCHIVED"
    ) {
      return res.status(400).json({
        success: false,
        message: "Statut client invalide.",
      });
    }

    const client = await updateClientData(String(id ?? ""), {
      displayName:
        displayName === null
          ? null
          : typeof displayName === "string"
            ? displayName.trim() || null
            : undefined,
      phone:
        phone === null
          ? null
          : typeof phone === "string"
            ? phone.trim() || null
            : undefined,
      email:
        email === null
          ? null
          : typeof email === "string"
            ? email.trim() || null
            : undefined,
      status,
    });

    return res.status(200).json({
      success: true,
      message: "Client mis à jour avec succès.",
      data: client,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   DELETE CLIENT
============================================================ */

export async function deleteClient(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    await deleteClientById(String(id ?? ""));

    return res.status(200).json({
      success: true,
      message: "Client supprimé avec succès.",
    });
  } catch (error) {
    return next(error);
  }
}
