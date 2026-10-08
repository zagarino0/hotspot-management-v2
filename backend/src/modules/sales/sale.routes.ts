import { Router } from "express";

import {
  cancelSaleController,
  createSaleController,
  deleteSaleController,
  getSale,
  listSales,
  listPointOfSales,
  recordPaymentController,
  salesSummary,
} from "./sale.controller.js";

const router = Router();

router.get("/", listSales);

router.get("/point-of-sales", listPointOfSales);

router.get("/summary", salesSummary);

router.post("/", createSaleController);

router.get("/:id", getSale);

router.post("/:id/payments", recordPaymentController);

router.post("/:id/cancel", cancelSaleController);

router.delete("/:id", deleteSaleController);

export default router;
