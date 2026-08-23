import {
  deleteRole,
  findAllPermissions,
  findRoleById,
  findRolePermissionIds,
  findRoles,
  insertRole,
  updateRole,
} from "./role.repository.js";

import {
  badRequest,
  conflict,
  forbidden,
  notFoundError,
} from "../../lib/errors.js";
import { isUniqueViolation } from "../../lib/dbErrors.js";

import type {
  CreateRoleData,
  UpdateRoleData,
} from "../../routes/role.types.js";

/* ============================================================
   LIST
============================================================ */

export async function getRoles() {
  return findRoles();
}

export async function getAllPermissions() {
  return findAllPermissions();
}

/* ============================================================
   FIND (avec le détail des permissions attribuées)
============================================================ */

export async function getRoleWithPermissions(id: string) {
  const role = await findRoleById(id);

  if (!role) {
    throw notFoundError("Rôle introuvable.");
  }

  const permissionIds = await findRolePermissionIds(id);

  return { role, permissionIds };
}

/* ============================================================
   CREATE
============================================================ */

export async function createRole(data: CreateRoleData) {
  if (!data.name.trim()) {
    throw badRequest("Le nom du rôle est obligatoire.");
  }

  if (!data.code.trim()) {
    throw badRequest("Le code du rôle est obligatoire.");
  }

  try {
    return await insertRole(data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(
        `Le code "${data.code}" est déjà utilisé par un autre rôle.`
      );
    }

    throw error;
  }
}

/* ============================================================
   UPDATE
   Les rôles système (is_system = true, ex: SUPER_ADMIN) ne
   peuvent pas être modifiés — ce sont des rôles protégés
   fournis par la plateforme.
============================================================ */

export async function updateRoleData(
  id: string,
  data: UpdateRoleData
) {
  const existing = await findRoleById(id);

  if (!existing) {
    throw notFoundError("Rôle introuvable.");
  }

  if (existing.isSystem) {
    throw forbidden(
      "Ce rôle est un rôle système protégé et ne peut pas être modifié."
    );
  }

  const updated = await updateRole(id, data);

  if (!updated) {
    throw notFoundError("Rôle introuvable.");
  }

  return updated;
}

/* ============================================================
   DELETE
   Bloqué si : rôle système, OU encore attribué à au moins un
   utilisateur (on ne retire jamais silencieusement un rôle à
   quelqu'un via une suppression — il faut le faire
   explicitement d'abord).
============================================================ */

export async function deleteRoleById(id: string) {
  const existing = await findRoleById(id);

  if (!existing) {
    throw notFoundError("Rôle introuvable.");
  }

  if (existing.isSystem) {
    throw forbidden(
      "Ce rôle est un rôle système protégé et ne peut pas être supprimé."
    );
  }

  if (existing.userCount > 0) {
    throw conflict(
      `Ce rôle est encore attribué à ${existing.userCount} utilisateur(s). Retirez-le d'abord de leurs comptes.`
    );
  }

  await deleteRole(id);
}
