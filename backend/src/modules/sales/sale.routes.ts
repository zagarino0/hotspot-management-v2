import { Router } from "express";
import { closePointOfSaleDailySales, createPointOfSaleTicketEvent, listPointOfSaleClosures, listPointOfSaleTicketEvents } from "./pointOfSaleDaily.controller.js";

import {
  cancelSaleController,
  createSaleController,
  deleteSaleController,
  getSale,
  listSales,
  listPointOfSales,
  createPointOfSaleController,
  deactivatePointOfSaleController,
  activatePointOfSaleController,
  recordPaymentController,
  salesSummary,
} from "./sale.controller.js";

const router = Router();

router.get("/", listSales);

router.get("/point-of-sales", listPointOfSales);

router.post("/point-of-sales", createPointOfSaleController);
router.get("/point-of-sales/:id/daily-closures", listPointOfSaleClosures);
router.post("/point-of-sales/:id/daily-closures", closePointOfSaleDailySales);
router.get("/point-of-sales/:id/ticket-events", listPointOfSaleTicketEvents);
router.post("/point-of-sales/:id/ticket-events", createPointOfSaleTicketEvent);
router.post("/point-of-sales/:id/deactivate", deactivatePointOfSaleController);
router.post("/point-of-sales/:id/activate", activatePointOfSaleController);

router.get("/summary", salesSummary);

router.post("/", createSaleController);

router.get("/:id", getSale);

router.post("/:id/payments", recordPaymentController);

router.post("/:id/cancel", cancelSaleController);

router.delete("/:id", deleteSaleController);

export default router;
