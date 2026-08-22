import { Router } from "express";

import {
  deleteVoucherController,
  generateVouchers,
  listVouchers,
  updateVoucherStatusController,
} from "./voucher.controller.js";

const router = Router();

router.get("/", listVouchers);

router.post("/generate", generateVouchers);

router.patch("/:id/status", updateVoucherStatusController);

router.delete("/:id", deleteVoucherController);

export default router;
