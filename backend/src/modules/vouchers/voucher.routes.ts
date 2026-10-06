import { Router } from "express";

import {
  deleteVoucherController,
  generateVouchers,
  listVouchers,
  mikrotikVouchers,
  voucherStats,
  updateVoucherStatusController,
} from "./voucher.controller.js";

const router = Router();

router.get("/mikrotik", mikrotikVouchers);
router.get("/stats", voucherStats);
router.get("/", listVouchers);

router.post("/generate", generateVouchers);

router.patch("/:id/status", updateVoucherStatusController);

router.delete("/:id", deleteVoucherController);

export default router;
