import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  getSiteProfilePrices,
  updateSiteProfilePrice,
} from "./sitePricing.service.js";

export async function listSiteProfilePrices(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const siteId =
      typeof req.query.siteId === "string"
        ? req.query.siteId
        : "";

    const data = await getSiteProfilePrices(siteId);

    return res.status(200).json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateSiteProfilePriceController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { siteId, profileCode, price } = req.body;

    const data = await updateSiteProfilePrice(
      typeof siteId === "string" ? siteId : "",
      typeof profileCode === "string" ? profileCode : "",
      Number(price)
    );

    return res.status(200).json({
      success: true,
      message: "Tarif du site mis à jour.",
      data,
    });
  } catch (error) {
    return next(error);
  }
}
