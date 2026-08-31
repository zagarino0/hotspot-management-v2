import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  getDashboardOverview,
  getStatisticsOverview,
} from "./statistics.service.js";

import type { StatsPeriod } from "../../routes/statistics.types.js";

const VALID_PERIODS: readonly StatsPeriod[] = [
  "today",
  "week",
  "month",
  "year",
];

export async function dashboardController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawDays = Number(req.query.days);

    const days =
      [7, 30, 90].indexOf(rawDays) !== -1 ? rawDays : 7;

    const data = await getDashboardOverview(days);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function statisticsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawPeriod = req.query.period;

    const period: StatsPeriod =
      typeof rawPeriod === "string" &&
      VALID_PERIODS.indexOf(rawPeriod as StatsPeriod) !== -1
        ? (rawPeriod as StatsPeriod)
        : "month";

    const data = await getStatisticsOverview(period);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}
