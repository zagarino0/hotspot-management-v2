import type { NextFunction, Request, Response } from "express";
import {
  getPosSalesSettings,
  listPosRemittances,
  recordPosRemittance,
  updatePosSalesSettings,
} from "./posOperations.service.js";

function identity(req: Request, res: Response) {
  const userId = req.auth?.sub;
  const organizationId = req.auth?.organizationId;
  if (!userId || !organizationId) {
    res.status(401).json({ success: false, message: "Authentification et organisation requises." });
    return null;
  }
  return { userId, organizationId };
}

export async function readPosSalesSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = identity(req, res);
    if (!auth) return;
    return res.status(200).json({ success: true, data: await getPosSalesSettings(auth.userId, auth.organizationId) });
  } catch (error) { return next(error); }
}

export async function patchPosSalesSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = identity(req, res);
    if (!auth) return;
    const body = req.body ?? {};
    if (body.autoClosureEnabled !== undefined && typeof body.autoClosureEnabled !== "boolean") {
      return res.status(400).json({ success: false, message: "autoClosureEnabled doit être un booléen." });
    }
    if (body.detectSaleOnFirstUse !== undefined && typeof body.detectSaleOnFirstUse !== "boolean") {
      return res.status(400).json({ success: false, message: "detectSaleOnFirstUse doit être un booléen." });
    }
    if (body.closureTime !== undefined && typeof body.closureTime !== "string") {
      return res.status(400).json({ success: false, message: "closureTime doit être une heure HH:mm." });
    }
    const data = await updatePosSalesSettings(auth.userId, auth.organizationId, {
      autoClosureEnabled: body.autoClosureEnabled,
      closureTime: body.closureTime,
      detectSaleOnFirstUse: body.detectSaleOnFirstUse,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) { return next(error); }
}

export async function readPosRemittances(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = identity(req, res);
    if (!auth) return;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const data = await listPosRemittances(auth.userId, auth.organizationId, String(req.params.id), from, to);
    return res.status(200).json({ success: true, data });
  } catch (error) { return next(error); }
}

export async function postPosRemittance(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = identity(req, res);
    if (!auth) return;
    const body = req.body ?? {};
    if (typeof body.businessDate !== "string" || body.remittedAmount === undefined) {
      return res.status(400).json({ success: false, message: "businessDate et remittedAmount sont obligatoires." });
    }
    const data = await recordPosRemittance(auth.userId, auth.organizationId, String(req.params.id), {
      businessDate: body.businessDate,
      remittedAmount: Number(body.remittedAmount),
      note: typeof body.note === "string" ? body.note : null,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) { return next(error); }
}
