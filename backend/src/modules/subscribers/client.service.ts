import {
  findClientById,
  findClients,
  createClient as createClientRepository,
  updateClient as updateClientRepository,
  deleteClient as deleteClientRepository,
  type CreateClientData,
  type UpdateClientData,
} from "./client.repository.js";

import { conflict, notFoundError } from "../../lib/errors.js";
import { isForeignKeyViolation } from "../../lib/dbErrors.js";

export type {
  CreateClientData,
};

/* ============================================================
   LIST
============================================================ */

export async function getClients() {
  return findClients();
}

/* ============================================================
   FIND BY ID
============================================================ */

export async function getClientById(
  id: string
) {
  return findClientById(id);
}

/* ============================================================
   CREATE
============================================================ */

export async function createClient(
  data: CreateClientData
) {
  return createClientRepository(data);
}

/* ============================================================
   UPDATE
============================================================ */

export async function updateClientData(
  id: string,
  data: UpdateClientData
) {
  const existing = await findClientById(id);

  if (!existing) {
    throw notFoundError("Client introuvable.");
  }

  const updated = await updateClientRepository(id, data);

  if (!updated) {
    throw notFoundError("Client introuvable.");
  }

  return updated;
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteClientById(id: string) {
  const existing = await findClientById(id);

  if (!existing) {
    throw notFoundError("Client introuvable.");
  }

  try {
    await deleteClientRepository(id);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw conflict(
        "Impossible de supprimer ce client : des sessions ou ventes y sont encore rattachées."
      );
    }

    throw error;
  }
}