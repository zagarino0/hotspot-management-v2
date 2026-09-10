import api from "./api";

export type StatsPeriod = "today" | "week" | "month" | "year";

export interface TrendValue {
  current: number;
  previous: number;
  changePercent: number | null;
}

export interface DashboardOverview {
  counts: {
    clients: number;
    activeSessions: number;
    sites: number;
    routers: number;
    routersOnline: number;
    accessPoints: number;
    accessPointsOnline: number;
    vouchersAvailable: number;
  };
  trends: {
    clients: TrendValue;
    sessions: TrendValue;
    revenue: TrendValue;
    vouchers: TrendValue;
  };
  recentSales: {
    id: string;
    planName: string;
    method: string | null;
    amount: number;
    currency: string;
    status: string;
    soldAt: string;
  }[];
  networkStatus: {
    id: string;
    name: string;
    type: "ROUTER" | "ACCESS_POINT";
    status: "ONLINE" | "OFFLINE" | "UNKNOWN" | "DISABLED";
  }[];
  sessionsSeries: { label: string; value: number }[];
  dbHealthy: boolean;
}

export interface StatisticsOverview {
  kpi: {
    revenue: TrendValue;
    salesCount: TrendValue;
    sessionsCount: TrendValue;
    activeClients: TrendValue;
  };
  revenueSeries: { label: string; value: number }[];
  paymentMethodBreakdown: {
    method: string;
    amount: number;
    percentage: number;
  }[];
  salesByPlan: {
    planName: string;
    count: number;
    percentage: number;
  }[];
  networkActivity: {
    sessionsInPeriod: number;
    peakConcurrent: number;
    averageDurationSeconds: number;
    activeClients: number;
  };
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export async function getDashboardOverview(
  days: 7 | 30 | 90 = 7
): Promise<DashboardOverview> {
  const response = await api.get<
    ApiEnvelope<DashboardOverview>
  >("/api/statistics/dashboard", {
    params: { days },
  });

  return response.data.data;
}

export async function getStatisticsOverview(
  period: StatsPeriod
): Promise<StatisticsOverview> {
  const response = await api.get<
    ApiEnvelope<StatisticsOverview>
  >("/api/statistics/overview", {
    params: { period },
  });

  return response.data.data;
}
