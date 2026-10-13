import {
  findPlanById,
  findPlans,
  insertPlan,
} from "./plan.repository.js";

import { badRequest, conflict, notFoundError } from "../../lib/errors.js";

import type { CreatePlanData } from "../../routes/plan.types.js";

export async function getPlans() {
  return findPlans();
}

export async function getPlanById(id: string) {
  const plan = await findPlanById(id);

  if (!plan) {
    throw notFoundError("Forfait introuvable.");
  }

  return plan;
}

export async function createPlan(data: CreatePlanData) {
  if (data.price < 0) {
    throw badRequest("Le prix ne peut pas être négatif.");
  }

  if (
    data.durationSeconds !== undefined &&
    data.durationSeconds !== null &&
    data.durationSeconds <= 0
  ) {
    throw badRequest(
      "La durée doit être supérieure à zéro."
    );
  }

  try {
    if (data.mikrotikProfileCode?.trim()) {
      if (data.mikrotikProfileCode.trim().length > 50) {
        throw badRequest("Le nom du profil MikroTik ne peut pas dépasser 50 caractères.");
      }

      // Les profils lus directement depuis RouterOS peuvent ne pas exister
      // encore dans le catalogue local. On les référence sans écraser les
      // tarifs déjà configurés pour un profil connu.
      const { pool } = await import("../../database/pool.js");
      await pool.query(
        `INSERT INTO hotspot_profile (
           code, name, duration_seconds, default_price, currency
         )
         VALUES ($1, $1, $2, $3, $4)
         ON CONFLICT (code) DO NOTHING`,
        [
          data.mikrotikProfileCode.trim(),
          data.durationSeconds ?? null,
          data.price,
          data.currency ?? "MGA",
        ]
      );
    }

    return await insertPlan(data);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      throw conflict(
        `Le code "${data.code}" est déjà utilisé par un autre forfait sur ce site.`
      );
    }

    throw error;
  }
}
