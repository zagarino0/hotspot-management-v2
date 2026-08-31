import { Router } from "express";

import {
  getClient,
  listClients,
  createClient,
  updateClient,
  deleteClient,
} from "../modules/subscribers/client.controller.js";

const router = Router();

router.get("/", listClients);

router.post("/", createClient);

router.get("/:id", getClient);

router.patch("/:id", updateClient);

router.delete("/:id", deleteClient);

export default router;