import {
  getDashboardOverview as fetchDashboardOverview,
  getNetworkActivity,
  getPaymentMethodBreakdown,
  getPeriodRange,
  getRevenueSeries,
  getSalesByPlan,
  getStatKpi,
} from "./statistics.repository.js";

import type {
  StatisticsOverview,
  StatsPeriod,
} from "../../routes/statistics.types.js";

export async function getDashboardOverview(
  sessionsSeriesDays?: number
) {
  return fetchDashboardOverview(sessionsSeriesDays);
}

export async function getStatisticsOverview(
  period: StatsPeriod
): Promise<StatisticsOverview> {
  const range = getPeriodRange(period);

  const [
    kpi,
    revenueSeries,
    paymentMethodBreakdown,
    salesByPlan,
    networkActivity,
  ] = await Promise.all([
    getStatKpi(range),
    getRevenueSeries(period, range),
    getPaymentMethodBreakdown(range),
    getSalesByPlan(range),
    getNetworkActivity(range),
  ]);

  return {
    kpi,
    revenueSeries,
    paymentMethodBreakdown,
    salesByPlan,
    networkActivity,
  };
}
