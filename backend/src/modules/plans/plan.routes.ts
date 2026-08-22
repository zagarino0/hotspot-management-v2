import { Router } from "express";

import {
  createPlanController,
  getPlan,
  listPlans,
} from "./plan.controller.js";

const router = Router();

router.get("/", listPlans);

router.post("/", createPlanController);

router.get("/:id", getPlan);

export default router;
