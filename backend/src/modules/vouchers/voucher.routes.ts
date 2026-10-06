import { Router } from "express";

import {
  deleteVoucherController,
  generateVouchers,
  listVouchers,
  mikrotikVouchers,
  voucherStats,
  updateVoucherStatusController,
  updateMikrotikVoucherCommentController,
} from "./voucher.controller.js";

const router = Router();

router.get("/mikrotik", mikrotikVouchers);
router.patch("/mikrotik/:routerId/:username/comment", updateMikrotikVoucherCommentController);
router.get("/stats", voucherStats);
router.get("/", listVouchers);

router.post("/generate", generateVouchers);

router.patch("/:id/status", updateVoucherStatusController);

router.delete("/:id", deleteVoucherController);

export default router;
