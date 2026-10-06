import { getRouters } from "./routerService";
import { getAccessPoints } from "./accessPointService";
import { getSites } from "./siteService";

export interface InfrastructureItem {
  id: string;
  name: string;
  type: "Router" | "AccessPoint";
  address: string | null;
  site: string;
  siteId: string;
  status: "ONLINE" | "OFFLINE" | "UNKNOWN" | "DISABLED";
  uptime: string;
}

export interface ServiceStatus {
  name: string;
  description: string;
  status: "Operational" | "Degraded" | "Down";
}

export interface HealthMetric {
  label: string;
  value: string;
}

/* ============================================================
   GET INFRASTRUCTURE
============================================================ */

export async function getInfrastructure(): Promise<InfrastructureItem[]> {
  const [routers, accessPoints, sites] = await Promise.all([
    getRouters(),
    getAccessPoints(),
    getSites().catch(() => []),
  ]);

  const siteMap = new Map<string, string>();
  sites.forEach((site) => siteMap.set(site.id, site.name));

  const infrastructure: InfrastructureItem[] = [];

  // Add routers
  routers.forEach((router) => {
    infrastructure.push({
      id: router.id,
      name: router.name,
      type: "Router",
      address: router.managementIp,
      site: siteMap.get(router.siteId) || "Site inconnu",
      siteId: router.siteId,
      status: router.status,
      uptime: router.uptimeSeconds
        ? formatUptime(router.uptimeSeconds)
        : "—",
    });
  });

  // Add access points
  accessPoints.forEach((ap) => {
    const routerSiteId = routers.find((r) => r.id === ap.routerId)?.siteId;
    infrastructure.push({
      id: ap.id,
      name: ap.name,
      type: "AccessPoint",
      address: ap.managementIp,
      site: siteMap.get(routerSiteId || "") || "Site inconnu",
      siteId: routerSiteId || "",
      status: "ONLINE", // APs don't have status in current schema
      uptime: "—",
    });
  });

  return infrastructure;
}

/* ============================================================
   GET SERVICE STATUS
============================================================ */

export async function getServiceStatus(): Promise<ServiceStatus[]> {
  // For now, return static status. In a real implementation,
  // this would check the actual health of each service
  return [
    {
      name: "Backend API",
      description: "Service applicatif",
      status: "Operational",
    },
    {
      name: "PostgreSQL",
      description: "Base de données",
      status: "Operational",
    },
    {
      name: "Hotspot",
      description: "Service réseau",
      status: "Operational",
    },
    {
      name: "Monitoring",
      description: "Supervision",
      status: "Operational",
    },
  ];
}

/* ============================================================
   GET HEALTH METRICS
============================================================ */

export async function getHealthMetrics(): Promise<HealthMetric[]> {
  // For now, return static metrics. In a real implementation,
  // this would calculate actual network health metrics
  return [
    {
      label: "Disponibilité",
      value: "98,7 %",
    },
    {
      label: "Latence moyenne",
      value: "24 ms",
    },
    {
      label: "Paquets perdus",
      value: "0,4 %",
    },
    {
      label: "Dernière synchronisation",
      value: "Il y a 2 min",
    },
  ];
}

/* ============================================================
   HELPERS
============================================================ */

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
