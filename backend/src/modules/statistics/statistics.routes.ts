import { Router } from "express";

import { dashboardController } from "./statistics.controller.js";

const router = Router();

router.get("/dashboard", dashboardController);

export default router;
