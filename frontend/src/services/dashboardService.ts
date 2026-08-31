import api from "./api";
import { getRouters } from "./routerService";
import { fetchSessions } from "./sessionService";

export interface DashboardOverview {
  counts: {
    clients: number;
    routers: number;
    routersOnline: number;
    accessPoints: number;
    accessPointsOnline: number;
    vouchersAvailable: number;
  };
  trends: {
    clients: { changePercent: number | null };
    sessions: { changePercent: number | null };
    revenue: { changePercent: number | null };
    vouchers: { changePercent: number | null };
  };
  recentSales: Array<{
    id: string;
    planName: string;
    price: number;
    method: string;
    createdAt: string;
  }>;
  networkStatus: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    uptime: string;
  }>;
  sessionsSeries: Array<{ time: string; value: number }>;
}

export async function getDashboardOverview(days: number): Promise<DashboardOverview> {
  try {
    // Récupérer les données réelles
    const [routers, sessions] = await Promise.all([
      getRouters(),
      fetchSessions().catch(() => []),
    ]);

    const routersOnline = routers.filter((r) => r.status === "ONLINE").length;
    const activeSessions = sessions?.length || 0;

    return {
      counts: {
        clients: 150, // TODO: Récupérer depuis l'API users
        routers: routers.length,
        routersOnline,
        accessPoints: 0, // TODO: Récupérer depuis l'API access points
        accessPointsOnline: 0, // TODO: Récupérer depuis l'API access points
        vouchersAvailable: 45, // TODO: Récupérer depuis l'API vouchers
      },
      trends: {
        clients: { changePercent: 15.4 },
        sessions: { changePercent: 50 },
        revenue: { changePercent: 18.4 },
        vouchers: { changePercent: 50 },
      },
      recentSales: [], // TODO: Récupérer depuis l'API sales
      networkStatus: routers.map((r) => ({
        id: r.id,
        name: r.name,
        type: "Router",
        status: r.status,
        uptime: r.uptimeSeconds ? formatUptime(r.uptimeSeconds) : "—",
      })),
      sessionsSeries: generateSessionsSeries(days),
    };
  } catch (error) {
    console.error("Erreur lors du chargement du dashboard:", error);
    // Fallback avec des données factices en cas d'erreur
    return {
      counts: {
        clients: 150,
        routers: 1,
        routersOnline: 0,
        accessPoints: 0,
        accessPointsOnline: 0,
        vouchersAvailable: 45,
      },
      trends: {
        clients: { changePercent: 15.4 },
        sessions: { changePercent: 50 },
        revenue: { changePercent: 18.4 },
        vouchers: { changePercent: 50 },
      },
      recentSales: [],
      networkStatus: [],
      sessionsSeries: generateSessionsSeries(days),
    };
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days} j ${hours} h`;
  }
  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }
  return `${minutes} min`;
}

function generateSessionsSeries(days: number): Array<{ time: string; value: number }> {
  const series = [];
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const timeStr = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    // Générer des données factices pour l'instant
    series.push({
      time: timeStr,
      value: Math.floor(Math.random() * 20) + 5,
    });
  }

  return series;
}
