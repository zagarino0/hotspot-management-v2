import {
  deleteSite,
  findSiteById,
  findSites,
  insertSite,
  updateSite,
  type UpdateSiteData,
} from "./site.repository.js";

import { conflict, notFoundError } from "../../lib/errors.js";
import { isForeignKeyViolation, isUniqueViolation } from "../../lib/dbErrors.js";

import type { CreateSiteData } from "../../routes/site.types.js";

/* ============================================================
   LIST
============================================================ */

export async function getSites() {
  return findSites();
}

/* ============================================================
   FIND
============================================================ */

export async function getSiteById(id: string) {
  const site = await findSiteById(id);

  if (!site) {
    throw notFoundError("Site introuvable.");
  }

  return site;
}

/* ============================================================
   UPDATE
============================================================ */

export async function updateSiteData(
  id: string,
  data: UpdateSiteData
) {
  await getSiteById(id);

  try {
    const updated = await updateSite(id, data);

    if (!updated) {
      throw notFoundError("Site introuvable.");
    }

    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(
        `Le code "${data.code}" est déjà utilisé par un autre site.`
      );
    }

    throw error;
  }
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteSiteById(id: string) {
  await getSiteById(id);

  try {
    await deleteSite(id);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw conflict(
        "Impossible de supprimer ce site : des routeurs, clients ou autres données y sont encore rattachés. Supprimez-les d'abord."
      );
    }

    throw error;
  }
}

/* ============================================================
   CREATE
============================================================ */

export async function createSite(data: CreateSiteData) {
  try {
    return await insertSite(data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(
        `Le code "${data.code}" est déjà utilisé par un autre site.`
      );
    }

    throw error;
  }
}
