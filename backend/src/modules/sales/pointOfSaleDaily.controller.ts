import type { NextFunction, Request, Response } from "express";
import {
  closeDailySales, createTicketEvent, listDailyClosures, listTicketEvents, POS_TICKET_EVENT_TYPES,
} from "./pointOfSaleDaily.service.js";

function authenticatedUser(req: Request, res: Response): string | null {
  const id = req.auth?.sub;
  if (!id) { res.status(401).json({ success: false, message: "Utilisateur non authentifié." }); return null; }
  return id;
}

export async function listPointOfSaleClosures(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = authenticatedUser(req, res); if (!userId) return;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    return res.status(200).json({ success: true, data: await listDailyClosures(String(req.params.id), userId, from, to) });
  } catch (error) { return next(error); }
}

export async function listPointOfSaleTicketEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = authenticatedUser(req, res); if (!userId) return;
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    return res.status(200).json({ success: true, data: await listTicketEvents(String(req.params.id), userId, date) });
  } catch (error) { return next(error); }
}

export async function createPointOfSaleTicketEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = authenticatedUser(req, res); if (!userId) return;
    const body = req.body ?? {};
    if (typeof body.eventType !== "string" || !POS_TICKET_EVENT_TYPES.includes(body.eventType)) {
      return res.status(400).json({ success: false, message: `Type invalide. Valeurs : ${POS_TICKET_EVENT_TYPES.join(", ")}.` });
    }
    const data = await createTicketEvent(String(req.params.id), userId, {
      siteId: String(body.siteId ?? ""), voucherId: typeof body.voucherId === "string" ? body.voucherId : null,
      replacementVoucherId: typeof body.replacementVoucherId === "string" ? body.replacementVoucherId : null,
      voucherCode: String(body.voucherCode ?? ""),
      replacementVoucherCode: typeof body.replacementVoucherCode === "string" ? body.replacementVoucherCode : null,
      eventType: body.eventType, reasonCode: typeof body.reasonCode === "string" ? body.reasonCode : null,
      reason: typeof body.reason === "string" ? body.reason : null,
      unitPrice: body.unitPrice === undefined ? 0 : Number(body.unitPrice),
      currency: typeof body.currency === "string" ? body.currency : "MGA",
      eventKey: String(body.eventKey ?? ""),
      metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {},
    });
    return res.status(201).json({ success: true, data });
  } catch (error) { return next(error); }
}

export async function closePointOfSaleDailySales(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = authenticatedUser(req, res); if (!userId) return;
    const body = req.body ?? {};
    const required = [
      "businessDate", "openingStock", "ticketsSold", "unsoldInStock", "rejectedPending",
      "unusableOrReplaced", "missingTickets", "grossRevenue",
    ];
    if (required.some((key) => body[key] === undefined || body[key] === null)) {
      return res.status(400).json({ success: false, message: "Les champs obligatoires de la clôture sont incomplets." });
    }
    const data = await closeDailySales(String(req.params.id), userId, {
      businessDate: String(body.businessDate), currency: typeof body.currency === "string" ? body.currency : "MGA",
      openingStock: Number(body.openingStock), ticketsReceived: body.ticketsReceived === undefined ? 0 : Number(body.ticketsReceived),
      ticketsSold: Number(body.ticketsSold), unsoldInStock: Number(body.unsoldInStock),
      rejectedPending: Number(body.rejectedPending), unusableOrReplaced: Number(body.unusableOrReplaced),
      replacementTicketsIssued: body.replacementTicketsIssued === undefined ? 0 : Number(body.replacementTicketsIssued),
      missingTickets: Number(body.missingTickets), freeReplacements: body.freeReplacements === undefined ? 0 : Number(body.freeReplacements),
      grossRevenue: Number(body.grossRevenue), refunds: body.refunds === undefined ? 0 : Number(body.refunds),
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) { return next(error); }
}
