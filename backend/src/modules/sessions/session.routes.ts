import { Router } from "express";

import {
  listSessions,
  syncSessions,
  syncSingleRouter,
  terminateSessionController,
} from "./session.controller.js";

const router = Router();

router.get("/", listSessions);

router.post("/sync", syncSessions);

router.post("/sync/:routerId", syncSingleRouter);

router.post("/:id/terminate", terminateSessionController);

export default router;
