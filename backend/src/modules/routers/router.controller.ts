import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  createRouter,
  deleteRouterById,
  getRouterById,
  getRouters,
  testRouterConnection,
  updateRouterData,
} from "./router.service.js";

/* ============================================================
   LIST ROUTERS
============================================================ */

export async function listRouters(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const routers = await getRouters();

    return res.status(200).json({
      success: true,
      data: routers,
      count: routers.length,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   TEST MIKROTIK CONNECTION
============================================================ */

export async function testRouter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      host,
      port,
      username,
      password,
    } = req.body;

    /* --------------------------------------------------------
       HOST
    -------------------------------------------------------- */

    if (
      typeof host !== "string" ||
      !host.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Adresse IP ou hostname obligatoire.",
      });
    }

    /* --------------------------------------------------------
       USERNAME
    -------------------------------------------------------- */

    if (
      typeof username !== "string" ||
      !username.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Utilisateur MikroTik obligatoire.",
      });
    }

    /* --------------------------------------------------------
       PASSWORD
    -------------------------------------------------------- */

    if (
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Mot de passe MikroTik obligatoire.",
      });
    }

    /* --------------------------------------------------------
       PORT
    -------------------------------------------------------- */

    const apiPort =
      port === undefined ||
      port === null ||
      port === ""
        ? 8728
        : Number(port);

    if (
      !Number.isInteger(apiPort) ||
      apiPort < 1 ||
      apiPort > 65535
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Le port API doit être un entier compris entre 1 et 65535.",
      });
    }

    /* --------------------------------------------------------
       TEST
    -------------------------------------------------------- */

    const result =
      await testRouterConnection({
        siteId: "",
        name: "",
        code: "",
        host: host.trim(),
        port: apiPort,
        username: username.trim(),
        password,
      });

    return res.status(200).json({
      success: true,
      message:
        "Connexion MikroTik réussie.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   CREATE ROUTER
============================================================ */

export async function createRouterController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      siteId,
      name,
      code,
      host,
      port,
      username,
      password,
    } = req.body;

    /* --------------------------------------------------------
       SITE
    -------------------------------------------------------- */

    if (
      typeof siteId !== "string" ||
      !siteId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Le site du routeur est obligatoire.",
      });
    }

    /* --------------------------------------------------------
       NAME
    -------------------------------------------------------- */

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Le nom du routeur est obligatoire.",
      });
    }

    /* --------------------------------------------------------
       CODE
    -------------------------------------------------------- */

    if (
      typeof code !== "string" ||
      !code.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Le code du routeur est obligatoire.",
      });
    }

    /* --------------------------------------------------------
       HOST
    -------------------------------------------------------- */

    if (
      typeof host !== "string" ||
      !host.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Adresse IP ou hostname du routeur obligatoire.",
      });
    }

    /* --------------------------------------------------------
       USERNAME
    -------------------------------------------------------- */

    if (
      typeof username !== "string" ||
      !username.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Utilisateur MikroTik obligatoire.",
      });
    }

    /* --------------------------------------------------------
       PASSWORD
    -------------------------------------------------------- */

    if (
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Mot de passe MikroTik obligatoire.",
      });
    }

    /* --------------------------------------------------------
       PORT
    -------------------------------------------------------- */

    const apiPort =
      port === undefined ||
      port === null ||
      port === ""
        ? 8728
        : Number(port);

    if (
      !Number.isInteger(apiPort) ||
      apiPort < 1 ||
      apiPort > 65535
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Le port API doit être un entier compris entre 1 et 65535.",
      });
    }

    /* --------------------------------------------------------
       CREATE
    -------------------------------------------------------- */

    const router = await createRouter({
      siteId: siteId.trim(),
      name: name.trim(),
      code: code.trim(),
      host: host.trim(),
      port: apiPort,
      username: username.trim(),
      password,
    });

    return res.status(201).json({
      success: true,
      message:
        "Routeur ajouté avec succès.",
      data: router,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   FIND ROUTER
============================================================ */

export async function getRouter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    if (
      typeof id !== "string" ||
      !id.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Identifiant de routeur invalide.",
      });
    }

    const router =
      await getRouterById(id.trim());

    if (!router) {
      return res.status(404).json({
        success: false,
        message:
          "Routeur introuvable.",
      });
    }

    return res.status(200).json({
      success: true,
      data: router,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   UPDATE ROUTER
============================================================ */

export async function updateRouterController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { name, model, managementIp, apiPort, syncEnabled } =
      req.body;

    const router = await updateRouterData(String(id ?? ""), {
      name:
        typeof name === "string" && name.trim()
          ? name.trim()
          : undefined,
      model:
        model === null
          ? null
          : typeof model === "string"
            ? model.trim() || null
            : undefined,
      managementIp:
        typeof managementIp === "string" && managementIp.trim()
          ? managementIp.trim()
          : undefined,
      apiPort:
        apiPort !== undefined && apiPort !== null && apiPort !== ""
          ? Number(apiPort)
          : undefined,
      syncEnabled:
        typeof syncEnabled === "boolean" ? syncEnabled : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Routeur mis à jour avec succès.",
      data: router,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   DELETE ROUTER
============================================================ */

export async function deleteRouterController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    await deleteRouterById(String(id ?? ""));

    return res.status(200).json({
      success: true,
      message: "Routeur supprimé avec succès.",
    });
  } catch (error) {
    return next(error);
  }
}