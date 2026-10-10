import { Router } from "express";
import {
  patchPosSalesSettings,
  postPosRemittance,
  readPosClosureAudit,
  readPosRemittances,
  readPosSalesSettings,
} from "./posOperations.controller.js";

const router = Router();
router.get("/settings", readPosSalesSettings);
router.patch("/settings", patchPosSalesSettings);
router.get("/:id/remittances", readPosRemittances);
router.post("/:id/remittances", postPosRemittance);
router.get("/:id/closure-audit", readPosClosureAudit);

export default router;
