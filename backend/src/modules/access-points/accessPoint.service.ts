import {
  deleteAccessPoint,
  findAccessPointById,
  findAccessPoints,
  insertAccessPoint,
  updateAccessPoint,
  type UpdateAccessPointData,
} from "./accessPoint.repository.js";

import { conflict, notFoundError } from "../../lib/errors.js";
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from "../../lib/dbErrors.js";

import type { CreateAccessPointData } from "../../routes/accessPoint.types.js";

export async function getAccessPoints() {
  return findAccessPoints();
}

export async function getAccessPointById(id: string) {
  const accessPoint = await findAccessPointById(id);

  if (!accessPoint) {
    throw notFoundError("Point d'accès introuvable.");
  }

  return accessPoint;
}

export async function updateAccessPointData(
  id: string,
  data: UpdateAccessPointData
) {
  await getAccessPointById(id);

  const updated = await updateAccessPoint(id, data);

  if (!updated) {
    throw notFoundError("Point d'accès introuvable.");
  }

  return updated;
}

export async function deleteAccessPointById(id: string) {
  await getAccessPointById(id);

  try {
    await deleteAccessPoint(id);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw conflict(
        "Impossible de supprimer ce point d'accès : des données y sont encore rattachées."
      );
    }

    throw error;
  }
}

export async function createAccessPoint(
  data: CreateAccessPointData
) {
  try {
    return await insertAccessPoint(data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(
        `Le code "${data.code}" est déjà utilisé sur ce site.`
      );
    }

    throw error;
  }
}
