import { Router } from "express";

import {
  cancelSaleController,
  createSaleController,
  deleteSaleController,
  getSale,
  listSales,
  listPointOfSales,
  createPointOfSaleController,
  recordPaymentController,
  salesSummary,
} from "./sale.controller.js";

const router = Router();

router.get("/", listSales);

router.get("/point-of-sales", listPointOfSales);

router.post("/point-of-sales", createPointOfSaleController);

router.get("/summary", salesSummary);

router.post("/", createSaleController);

router.get("/:id", getSale);

router.post("/:id/payments", recordPaymentController);

router.post("/:id/cancel", cancelSaleController);

router.delete("/:id", deleteSaleController);

export default router;
