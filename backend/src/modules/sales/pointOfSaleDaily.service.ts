import type { PoolClient } from "pg";

import { pool } from "../../database/pool.js";
import { badRequest, conflict, notFoundError } from "../../lib/errors.js";

export const POS_TICKET_EVENT_TYPES = [
  "STOCK_ASSIGNED", "SOLD", "UNSOLD_CONFIRMED", "REJECTED",
  "RETURN_REQUESTED", "RETURNED_TO_STOCK", "REPLACED", "UNUSABLE",
  "MISSING", "REFUNDED",
] as const;
export type PosTicketEventType = (typeof POS_TICKET_EVENT_TYPES)[number];

async function assertExternalPosAccess(client: PoolClient, pointOfSaleId: string, userId: string) {
  const result = await client.query<{ id: string; organizationId: string }>(
    `SELECT pos.id, pos.organization_id AS "organizationId"
       FROM point_of_sale pos
       JOIN "user" u ON u.organization_id = pos.organization_id
      WHERE pos.id = $1 AND u.id = $2 AND pos.type = 'EXTERNAL'
      LIMIT 1`,
    [pointOfSaleId, userId],
  );
  const pos = result.rows[0];
  if (!pos) throw notFoundError("Point de vente externe introuvable.");
  return pos;
}

export async function listDailyClosures(pointOfSaleId: string, userId: string, from?: string, to?: string) {
  const client = await pool.connect();
  try {
    await assertExternalPosAccess(client, pointOfSaleId, userId);
    const result = await client.query(
      `SELECT * FROM point_of_sale_daily_closure
        WHERE point_of_sale_id = $1
          AND ($2::date IS NULL OR business_date >= $2::date)
          AND ($3::date IS NULL OR business_date <= $3::date)
        ORDER BY business_date DESC LIMIT 120`,
      [pointOfSaleId, from ?? null, to ?? null],
    );
    return result.rows;
  } finally { client.release(); }
}

export async function listTicketEvents(pointOfSaleId: string, userId: string, businessDate?: string) {
  const client = await pool.connect();
  try {
    await assertExternalPosAccess(client, pointOfSaleId, userId);
    const result = await client.query(
      `SELECT e.* FROM point_of_sale_ticket_event e
        WHERE e.point_of_sale_id = $1
          AND ($2::date IS NULL OR (e.occurred_at AT TIME ZONE 'Indian/Antananarivo')::date = $2::date)
        ORDER BY e.occurred_at DESC LIMIT 500`,
      [pointOfSaleId, businessDate ?? null],
    );
    return result.rows;
  } finally { client.release(); }
}

export async function createTicketEvent(pointOfSaleId: string, userId: string, input: {
  siteId: string; voucherId?: string | null; replacementVoucherId?: string | null;
  voucherCode: string; replacementVoucherCode?: string | null; eventType: PosTicketEventType;
  reasonCode?: string | null; reason?: string | null; unitPrice?: number; currency?: string;
  eventKey: string; metadata?: Record<string, unknown>;
}) {
  if (!POS_TICKET_EVENT_TYPES.includes(input.eventType)) throw badRequest("Type d'événement de ticket invalide.");
  if (!input.siteId?.trim() || !input.voucherCode?.trim() || !input.eventKey?.trim()) {
    throw badRequest("Le site, le code du ticket et la clé d'événement sont obligatoires.");
  }
  if (input.eventType === "REPLACED" && !input.replacementVoucherCode?.trim()) {
    throw badRequest("Un remplacement doit référencer le nouveau ticket.");
  }
  if (input.eventType === "REPLACED" && Number(input.unitPrice ?? 0) !== 0) {
    throw badRequest("Le remplacement doit toujours être gratuit (0 MGA).");
  }
  const unitPrice = Number(input.unitPrice ?? 0);
  const currency = (input.currency ?? "MGA").toUpperCase();
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw badRequest("Le prix doit être positif ou nul.");
  if (!/^[A-Z]{3}$/.test(currency)) throw badRequest("La devise doit être un code de trois lettres.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pos = await assertExternalPosAccess(client, pointOfSaleId, userId);
    const site = await client.query(
      "SELECT id FROM site WHERE id = $1 AND organization_id = $2 LIMIT 1",
      [input.siteId, pos.organizationId],
    );
    if (!site.rows[0]) throw badRequest("Le site n'appartient pas à l'organisation du point de vente.");


    if (input.eventType === "SOLD") {
      const alreadySold = await client.query(
        `SELECT id FROM point_of_sale_ticket_event
          WHERE point_of_sale_id = $1 AND LOWER(voucher_code) = LOWER($2)
            AND event_type = 'SOLD' LIMIT 1`,
        [pointOfSaleId, input.voucherCode.trim()],
      );
      if (alreadySold.rows[0]) throw conflict("Ce ticket est déjà enregistré comme vendu pour ce point de vente.");
    }

    const result = await client.query(
      `INSERT INTO point_of_sale_ticket_event (
         point_of_sale_id, site_id, voucher_id, replacement_voucher_id,
         voucher_code, replacement_voucher_code, event_type, reason_code,
         reason, unit_price, currency, source, actor_user_id, event_key, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'APPLICATION',$12,$13,$14::jsonb)
       ON CONFLICT (event_key) DO NOTHING
       RETURNING *`,
      [
        pointOfSaleId, input.siteId, input.voucherId ?? null, input.replacementVoucherId ?? null,
        input.voucherCode.trim(), input.replacementVoucherCode?.trim() ?? null,
        input.eventType, input.reasonCode ?? null, input.reason ?? null, unitPrice, currency,
        userId, input.eventKey.trim(), JSON.stringify(input.metadata ?? {}),
      ],
    );
    if (!result.rows[0]) throw conflict("Cet événement de ticket a déjà été enregistré.");
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function closeDailySales(pointOfSaleId: string, userId: string, input: {
  businessDate: string; currency?: string; openingStock: number; ticketsReceived?: number;
  unsoldInStock: number; rejectedPending: number; unusableOrReplaced: number;
  missingTickets: number; notes?: string | null;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate)) throw badRequest("La date doit respecter le format YYYY-MM-DD.");
  const physicalCounts = [
    input.openingStock, input.ticketsReceived ?? 0, input.unsoldInStock,
    input.rejectedPending, input.unusableOrReplaced, input.missingTickets,
  ];
  if (physicalCounts.some((value) => !Number.isInteger(value) || value < 0)) {
    throw badRequest("Les compteurs de stock doivent être des entiers positifs ou nuls.");
  }
  const currency = (input.currency ?? "MGA").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw badRequest("La devise doit être un code de trois lettres.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertExternalPosAccess(client, pointOfSaleId, userId);

    // Les ventes et remboursements proviennent du registre événementiel,
    // jamais d'un total financier fourni librement par le client API.
    const totals = await client.query<{
      ticketsSold: string;
      grossRevenue: string;
      refunds: string;
      freeReplacements: string;
      replacementTicketsIssued: string;
    }>(
      `SELECT
         COUNT(DISTINCT LOWER(voucher_code)) FILTER (WHERE event_type = 'SOLD')::text AS "ticketsSold",
         COALESCE(SUM(unit_price) FILTER (WHERE event_type = 'SOLD' AND currency = $3), 0)::text AS "grossRevenue",
         COALESCE(SUM(unit_price) FILTER (WHERE event_type = 'REFUNDED' AND currency = $3), 0)::text AS refunds,
         COUNT(*) FILTER (WHERE event_type = 'REPLACED')::text AS "freeReplacements",
         COUNT(*) FILTER (WHERE event_type = 'REPLACED')::text AS "replacementTicketsIssued"
       FROM point_of_sale_ticket_event
       WHERE point_of_sale_id = $1
         AND (occurred_at AT TIME ZONE 'Indian/Antananarivo')::date = $2::date`,
      [pointOfSaleId, input.businessDate, currency],
    );
    const aggregate = totals.rows[0];
    const ticketsSold = Number(aggregate.ticketsSold ?? 0);
    const gross = Number(aggregate.grossRevenue ?? 0);
    const refunds = Number(aggregate.refunds ?? 0);
    const freeReplacements = Number(aggregate.freeReplacements ?? 0);
    const replacementTicketsIssued = Number(aggregate.replacementTicketsIssued ?? 0);
    if (refunds > gross) throw conflict("Les remboursements de la journée dépassent la recette brute; vérifiez les événements.");

    const expected = input.openingStock + (input.ticketsReceived ?? 0);
    const accounted = ticketsSold + input.unsoldInStock + input.rejectedPending
      + input.unusableOrReplaced + replacementTicketsIssued + input.missingTickets;
    const discrepancy = expected - accounted;

    const result = await client.query(
      `INSERT INTO point_of_sale_daily_closure (
         point_of_sale_id, business_date, currency, opening_stock, tickets_received,
         tickets_sold, unsold_in_stock, rejected_pending, unusable_or_replaced,
         replacement_tickets_issued, missing_tickets, free_replacements,
         gross_revenue, refunds, net_revenue, stock_discrepancy, status, notes,
         created_by, closed_by, closed_at
       ) VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                 'CLOSED',$17,$18,$18,NOW()) RETURNING *`,
      [
        pointOfSaleId, input.businessDate, currency, input.openingStock, input.ticketsReceived ?? 0,
        ticketsSold, input.unsoldInStock, input.rejectedPending, input.unusableOrReplaced,
        replacementTicketsIssued, input.missingTickets, freeReplacements,
        gross, refunds, gross - refunds, discrepancy, input.notes ?? null, userId,
      ],
    );
    await client.query("COMMIT");
    return { ...result.rows[0], stockBalanced: discrepancy === 0 };
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") throw conflict("Une clôture existe déjà pour ce point de vente et cette date. Toute correction doit être auditée.");
    throw error;
  } finally { client.release(); }
}
