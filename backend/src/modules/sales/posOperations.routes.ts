import { Router } from "express";
import {
  patchPosSalesSettings,
  postPosRemittance,
  readPosRemittances,
  readPosSalesSettings,
} from "./posOperations.controller.js";

const router = Router();
router.get("/settings", readPosSalesSettings);
router.patch("/settings", patchPosSalesSettings);
router.get("/:id/remittances", readPosRemittances);
router.post("/:id/remittances", postPosRemittance);

export default router;
