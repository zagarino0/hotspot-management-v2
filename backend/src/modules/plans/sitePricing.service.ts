import {
  findSiteById,
  findSiteProfilePrices,
  upsertSiteProfilePrice,
} from "./sitePricing.repository.js";

import { badRequest, notFoundError } from "../../lib/errors.js";

export async function getSiteProfilePrices(siteId: string) {
  if (!siteId.trim()) {
    throw badRequest("Le site est obligatoire.");
  }

  if (!(await findSiteById(siteId))) {
    throw notFoundError("Site introuvable.");
  }

  return findSiteProfilePrices(siteId);
}

export async function updateSiteProfilePrice(
  siteId: string,
  profileCode: string,
  price: number
) {
  if (!siteId.trim()) {
    throw badRequest("Le site est obligatoire.");
  }

  if (!profileCode.trim()) {
    throw badRequest("Le profil est obligatoire.");
  }

  if (!Number.isFinite(price) || price < 0) {
    throw badRequest("Le prix doit être un nombre positif ou nul.");
  }

  if (!(await findSiteById(siteId))) {
    throw notFoundError("Site introuvable.");
  }

  const updated = await upsertSiteProfilePrice(
    siteId,
    profileCode.trim().toLowerCase(),
    price
  );

  if (!updated) {
    throw notFoundError("Profil hotspot introuvable.");
  }

  return updated;
}
