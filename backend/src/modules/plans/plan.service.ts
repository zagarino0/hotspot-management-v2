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
