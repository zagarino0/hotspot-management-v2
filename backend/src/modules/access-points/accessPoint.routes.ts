import { Router } from "express";

import {
  createAccessPointController,
  deleteAccessPointController,
  getAccessPoint,
  listAccessPoints,
  updateAccessPointController,
} from "./accessPoint.controller.js";

const router = Router();

router.get("/", listAccessPoints);

router.post("/", createAccessPointController);

router.get("/:id", getAccessPoint);

router.patch("/:id", updateAccessPointController);

router.delete("/:id", deleteAccessPointController);

export default router;
