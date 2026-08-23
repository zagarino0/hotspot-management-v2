import {
  deleteUser,
  findUserById,
  findUsers,
  insertUser,
  setUserRoles,
  updateUser,
} from "./user.repository.js";

import {
  badRequest,
  conflict,
  notFoundError,
} from "../../lib/errors.js";
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from "../../lib/dbErrors.js";

import type {
  CreateUserData,
  UpdateUserData,
} from "../../routes/user.types.js";

/* ============================================================
   LIST
============================================================ */

export async function getUsers() {
  return findUsers();
}

export async function getUserById(id: string) {
  const user = await findUserById(id);

  if (!user) {
    throw notFoundError("Utilisateur introuvable.");
  }

  return user;
}

/* ============================================================
   CREATE
============================================================ */

export async function createUser(data: CreateUserData) {
  if (data.password.length < 8) {
    throw badRequest(
      "Le mot de passe doit contenir au moins 8 caractères."
    );
  }

  try {
    return await insertUser(data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(
        `L'identifiant "${data.username}" est déjà utilisé.`
      );
    }

    throw error;
  }
}

/* ============================================================
   UPDATE
============================================================ */

export async function updateUserData(
  id: string,
  data: UpdateUserData,
  requesterId: string
) {
  const existing = await getUserById(id);

  /*
   * Un utilisateur ne peut pas se bloquer/désactiver lui-même —
   * il se retrouverait déconnecté sans personne pour annuler.
   */
  if (
    id === requesterId &&
    data.status !== undefined &&
    data.status !== "ACTIVE"
  ) {
    throw badRequest(
      "Vous ne pouvez pas changer votre propre statut."
    );
  }

  if (data.password !== undefined && data.password.length < 8) {
    throw badRequest(
      "Le mot de passe doit contenir au moins 8 caractères."
    );
  }

  const updated = await updateUser(id, data);

  if (!updated) {
    throw notFoundError("Utilisateur introuvable.");
  }

  return { ...existing, ...updated };
}

/* ============================================================
   SET ROLES
============================================================ */

export async function updateUserRoles(
  id: string,
  roleIds: string[]
) {
  await getUserById(id);

  await setUserRoles(id, roleIds);

  return getUserById(id);
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteUserById(
  id: string,
  requesterId: string
) {
  if (id === requesterId) {
    throw badRequest(
      "Vous ne pouvez pas supprimer votre propre compte."
    );
  }

  await getUserById(id);

  try {
    await deleteUser(id);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw conflict(
        "Impossible de supprimer cet utilisateur : des données lui sont encore rattachées (ventes, audit...)."
      );
    }

    throw error;
  }
}
