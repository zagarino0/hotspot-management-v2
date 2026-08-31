import type { StatsPeriod } from "../routes/statistics.types.js";

export interface PeriodRange {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
}

/*
 * "today"/"week" : fenêtres glissantes (dernières 24h / 7 jours)
 * "month"/"year" : mois/année calendaire, comparé au mois/année
 * calendaire précédent — plus parlant pour un utilisateur qui
 * choisit "Ce mois" que des 30 derniers jours glissants.
 */
export function getPeriodRange(
  period: StatsPeriod
): PeriodRange {
  const now = new Date();

  switch (period) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);

      const previousStart = new Date(start);
      previousStart.setDate(previousStart.getDate() - 1);

      return {
        start,
        end: now,
        previousStart,
        previousEnd: start,
      };
    }

    case "week": {
      const start = new Date(
        now.getTime() - 7 * 24 * 60 * 60 * 1000
      );

      const previousStart = new Date(
        start.getTime() - 7 * 24 * 60 * 60 * 1000
      );

      return {
        start,
        end: now,
        previousStart,
        previousEnd: start,
      };
    }

    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      const previousStart = new Date(
        now.getFullYear() - 1,
        0,
        1
      );
      const previousEnd = new Date(now.getFullYear(), 0, 1);

      return { start, end: now, previousStart, previousEnd };
    }

    case "month":
    default: {
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );
      const previousStart = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );
      const previousEnd = start;

      return { start, end: now, previousStart, previousEnd };
    }
  }
}

export function computeChangePercent(
  current: number,
  previous: number
): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return ((current - previous) / previous) * 100;
}
