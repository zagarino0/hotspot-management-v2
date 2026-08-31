import { Router } from "express";

import {
  dashboardController,
  statisticsController,
} from "./statistics.controller.js";

const router = Router();

router.get("/dashboard", dashboardController);

router.get("/overview", statisticsController);

export default router;
