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
    sales: TrendValue;
    revenue: TrendValue;
    vouchers: TrendValue;
  };
  recentSales: Array<{
    id: string;
    planName: string;
    method: string | null;
    amount: number;
    currency: string;
    status: string;
    soldAt: Date;
  }>;
  networkStatus: Array<{
    id: string;
    name: string;
    type: "ROUTER" | "ACCESS_POINT";
    status: "ONLINE" | "OFFLINE" | "UNKNOWN" | "DISABLED";
  }>;
  sessionsSeries: Array<{ label: string; value: number }>;
  dbHealthy: boolean;
}
