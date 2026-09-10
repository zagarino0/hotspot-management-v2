export type StatsPeriod = "today" | "week" | "month" | "year";

/* ============================================================
   DASHBOARD
============================================================ */

export interface TrendValue {
  current: number;
  previous: number;
  changePercent: number | null;
}

export interface DashboardCounts {
  clients: number;
  activeSessions: number;
  sites: number;
  routers: number;
  routersOnline: number;
  accessPoints: number;
  accessPointsOnline: number;
  vouchersAvailable: number;
}

export interface DashboardTrends {
  clients: TrendValue;
  sessions: TrendValue;
  revenue: TrendValue;
  vouchers: TrendValue;
}

export interface RecentSaleRow {
  id: string;
  planName: string;
  method: string | null;
  amount: number;
  currency: string;
  status: string;
  soldAt: Date;
}

export interface NetworkStatusRow {
  id: string;
  name: string;
  type: "ROUTER" | "ACCESS_POINT";
  status: "ONLINE" | "OFFLINE" | "UNKNOWN" | "DISABLED";
}

export interface DashboardOverview {
  counts: DashboardCounts;
  trends: DashboardTrends;
  recentSales: RecentSaleRow[];
  networkStatus: NetworkStatusRow[];
  sessionsSeries: { label: string; value: number }[];
  dbHealthy: boolean;
}

/* ============================================================
   STATISTICS
============================================================ */

export interface StatKpi {
  revenue: TrendValue;
  salesCount: TrendValue;
  sessionsCount: TrendValue;
  activeClients: TrendValue;
}

export interface RevenueSeriesPoint {
  label: string;
  value: number;
}

export interface PaymentMethodShare {
  method: string;
  amount: number;
  percentage: number;
}

export interface PlanSalesShare {
  planName: string;
  count: number;
  percentage: number;
}

export interface NetworkActivity {
  sessionsInPeriod: number;
  peakConcurrent: number;
  averageDurationSeconds: number;
  activeClients: number;
}

export interface StatisticsOverview {
  kpi: StatKpi;
  revenueSeries: RevenueSeriesPoint[];
  paymentMethodBreakdown: PaymentMethodShare[];
  salesByPlan: PlanSalesShare[];
  networkActivity: NetworkActivity;
}
