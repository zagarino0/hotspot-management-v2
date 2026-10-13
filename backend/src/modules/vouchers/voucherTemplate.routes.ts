import { Router } from "express";
import { getVoucherPrintTemplate, saveVoucherPrintTemplate } from "./voucherTemplate.controller.js";

const router = Router();
router.get("/", getVoucherPrintTemplate);
router.put("/", saveVoucherPrintTemplate);
export default router;
