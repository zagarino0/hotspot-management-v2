import { getDashboardOverview as fetchDashboardOverview } from "./statistics.repository.js";

export function getDashboardOverview(days: 7 | 30 | 90) {
  return fetchDashboardOverview(days);
}
