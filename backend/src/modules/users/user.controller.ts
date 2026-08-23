import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  createUser,
  deleteUserById,
  getUserById,
  getUsers,
  updateUserData,
  updateUserRoles,
} from "./user.service.js";

const VALID_STATUSES = [
  "ACTIVE",
  "INVITED",
  "SUSPENDED",
  "DISABLED",
  "ARCHIVED",
];

/* ============================================================
   LIST
============================================================ */

export async function listUsers(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const users = await getUsers();

    return res.status(200).json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    const user = await getUserById(String(id ?? ""));

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   CREATE
============================================================ */

export async function createUserController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      username,
      email,
      phone,
      firstName,
      lastName,
      password,
      status,
      roleIds,
    } = req.body;

    const organizationId = req.auth?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentification requise.",
      });
    }

    if (typeof username !== "string" || !username.trim()) {
      return res.status(400).json({
        success: false,
        message: "L'identifiant est obligatoire.",
      });
    }

    if (typeof password !== "string" || !password) {
      return res.status(400).json({
        success: false,
        message: "Le mot de passe est obligatoire.",
      });
    }

    if (
      status !== undefined &&
      !VALID_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Statut invalide.",
      });
    }

    const user = await createUser({
      organizationId,
      username: username.trim(),
      email:
        typeof email === "string" && email.trim()
          ? email.trim()
          : null,
      phone:
        typeof phone === "string" && phone.trim()
          ? phone.trim()
          : null,
      firstName:
        typeof firstName === "string" && firstName.trim()
          ? firstName.trim()
          : null,
      lastName:
        typeof lastName === "string" && lastName.trim()
          ? lastName.trim()
          : null,
      password,
      status,
      roleIds: Array.isArray(roleIds) ? roleIds : [],
    });

    return res.status(201).json({
      success: true,
      message: "Utilisateur créé avec succès.",
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   UPDATE
============================================================ */

export async function updateUserController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const {
      email,
      phone,
      firstName,
      lastName,
      status,
      password,
    } = req.body;

    if (
      status !== undefined &&
      !VALID_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Statut invalide.",
      });
    }

    const requesterId = req.auth?.sub ?? "";

    const user = await updateUserData(
      String(id ?? ""),
      {
        email:
          email === null
            ? null
            : typeof email === "string"
              ? email.trim() || null
              : undefined,
        phone:
          phone === null
            ? null
            : typeof phone === "string"
              ? phone.trim() || null
              : undefined,
        firstName:
          firstName === null
            ? null
            : typeof firstName === "string"
              ? firstName.trim() || null
              : undefined,
        lastName:
          lastName === null
            ? null
            : typeof lastName === "string"
              ? lastName.trim() || null
              : undefined,
        status,
        password:
          typeof password === "string" && password
            ? password
            : undefined,
      },
      requesterId
    );

    return res.status(200).json({
      success: true,
      message: "Utilisateur mis à jour avec succès.",
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   SET ROLES
============================================================ */

export async function updateUserRolesController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { roleIds } = req.body;

    if (!Array.isArray(roleIds)) {
      return res.status(400).json({
        success: false,
        message: "La liste des rôles doit être un tableau.",
      });
    }

    const user = await updateUserRoles(
      String(id ?? ""),
      roleIds
    );

    return res.status(200).json({
      success: true,
      message: "Rôles mis à jour avec succès.",
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteUserController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const requesterId = req.auth?.sub ?? "";

    await deleteUserById(String(id ?? ""), requesterId);

    return res.status(200).json({
      success: true,
      message: "Utilisateur supprimé avec succès.",
    });
  } catch (error) {
    return next(error);
  }
}
