import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  createRole,
  deleteRoleById,
  getAllPermissions,
  getRoleWithPermissions,
  getRoles,
  updateRoleData,
} from "./role.service.js";

/* ============================================================
   LIST
============================================================ */

export async function listRoles(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const roles = await getRoles();

    return res.status(200).json({
      success: true,
      data: roles,
      count: roles.length,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   PERMISSIONS CATALOG
============================================================ */

export async function listPermissions(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const permissions = await getAllPermissions();

    return res.status(200).json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   GET ROLE (+ permissions attribuées)
============================================================ */

export async function getRole(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    const result = await getRoleWithPermissions(
      String(id ?? "")
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   CREATE
============================================================ */

export async function createRoleController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { name, code, description, permissionIds } =
      req.body;

    const organizationId = req.auth?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentification requise.",
      });
    }

    if (typeof name !== "string") {
      return res.status(400).json({
        success: false,
        message: "Le nom du rôle est obligatoire.",
      });
    }

    if (typeof code !== "string") {
      return res.status(400).json({
        success: false,
        message: "Le code du rôle est obligatoire.",
      });
    }

    const role = await createRole({
      organizationId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description:
        typeof description === "string" && description.trim()
          ? description.trim()
          : null,
      permissionIds: Array.isArray(permissionIds)
        ? permissionIds
        : [],
    });

    return res.status(201).json({
      success: true,
      message: "Rôle créé avec succès.",
      data: role,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   UPDATE
============================================================ */

export async function updateRoleController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { name, description, status, permissionIds } =
      req.body;

    const role = await updateRoleData(String(id ?? ""), {
      name:
        typeof name === "string" && name.trim()
          ? name.trim()
          : undefined,
      description:
        description === null
          ? null
          : typeof description === "string"
            ? description.trim() || null
            : undefined,
      status:
        typeof status === "string" ? (status as any) : undefined,
      permissionIds: Array.isArray(permissionIds)
        ? permissionIds
        : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Rôle mis à jour avec succès.",
      data: role,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteRoleController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    await deleteRoleById(String(id ?? ""));

    return res.status(200).json({
      success: true,
      message: "Rôle supprimé avec succès.",
    });
  } catch (error) {
    return next(error);
  }
}
