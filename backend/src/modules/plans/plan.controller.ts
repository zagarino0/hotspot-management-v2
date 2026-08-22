import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  createPlan,
  getPlanById,
  getPlans,
} from "./plan.service.js";

export async function listPlans(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const plans = await getPlans();

    return res.status(200).json({
      success: true,
      data: plans,
      count: plans.length,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPlan(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    const plan = await getPlanById(String(id ?? ""));

    return res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    return next(error);
  }
}

export async function createPlanController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      siteId,
      name,
      code,
      description,
      price,
      currency,
      durationSeconds,
      dataLimitBytes,
      downloadSpeedBps,
      uploadSpeedBps,
      simultaneousSessions,
    } = req.body;

    if (typeof siteId !== "string" || !siteId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Le site du forfait est obligatoire.",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Le nom du forfait est obligatoire.",
      });
    }

    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Le code du forfait est obligatoire.",
      });
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice)) {
      return res.status(400).json({
        success: false,
        message: "Le prix du forfait doit être un nombre.",
      });
    }

    const plan = await createPlan({
      siteId: siteId.trim(),
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description:
        typeof description === "string" && description.trim()
          ? description.trim()
          : null,
      price: numericPrice,
      currency:
        typeof currency === "string" && currency.trim()
          ? currency.trim().toUpperCase()
          : undefined,
      durationSeconds:
        durationSeconds !== undefined &&
        durationSeconds !== null &&
        durationSeconds !== ""
          ? Number(durationSeconds)
          : null,
      dataLimitBytes:
        dataLimitBytes !== undefined &&
        dataLimitBytes !== null &&
        dataLimitBytes !== ""
          ? Number(dataLimitBytes)
          : null,
      downloadSpeedBps:
        downloadSpeedBps !== undefined &&
        downloadSpeedBps !== null &&
        downloadSpeedBps !== ""
          ? Number(downloadSpeedBps)
          : null,
      uploadSpeedBps:
        uploadSpeedBps !== undefined &&
        uploadSpeedBps !== null &&
        uploadSpeedBps !== ""
          ? Number(uploadSpeedBps)
          : null,
      simultaneousSessions:
        simultaneousSessions !== undefined &&
        simultaneousSessions !== null &&
        simultaneousSessions !== ""
          ? Number(simultaneousSessions)
          : undefined,
    });

    return res.status(201).json({
      success: true,
      message: "Forfait créé avec succès.",
      data: plan,
    });
  } catch (error) {
    return next(error);
  }
}
