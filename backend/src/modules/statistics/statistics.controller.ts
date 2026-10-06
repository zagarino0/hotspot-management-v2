import type { NextFunction, Request, Response } from "express";

import { getDashboardOverview } from "./statistics.service.js";

export async function dashboardController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawDays = Number(req.query.days);
    const days: 7 | 30 | 90 = rawDays === 30 || rawDays === 90 ? rawDays : 7;

    res.status(200).json({
      success: true,
      data: await getDashboardOverview(days),
    });
  } catch (error) {
    next(error);
  }
}
