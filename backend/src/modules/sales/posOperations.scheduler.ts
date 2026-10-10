import { pool } from "../../database/pool.js";

import {
  POS_TIME_ZONE as TIME_ZONE,
  addDays,
  isClosureDue,
  localDate,
  localTime,
} from "./posOperations.rules.js";

const POLL_INTERVAL_MS = 30_000;
let timer: NodeJS.Timeout | null = null;
let running = false;

export async function refreshClosedDay(client: import("pg").PoolClient, closureId: string, reason: string) {
  const oldResult = await client.query(
    `SELECT * FROM point_of_sale_daily_closure WHERE id = $1 FOR UPDATE`,
    [closureId],
  );
  const old = oldResult.rows[0];
  if (!old) return;

  const financials = await client.query(
    `SELECT
       COUNT(DISTINCT LOWER(voucher_code)) FILTER (WHERE event_type = 'SOLD')::int AS tickets_sold,
       COALESCE(SUM(unit_price) FILTER (WHERE event_type = 'SOLD'), 0)::numeric(14,2) AS gross_revenue,
       COALESCE(SUM(unit_price) FILTER (WHERE event_type = 'REFUNDED'), 0)::numeric(14,2) AS refunds
     FROM point_of_sale_ticket_event
     WHERE point_of_sale_id = $1
       AND (occurred_at AT TIME ZONE $3)::date = $2::date
       AND event_type IN ('SOLD', 'REFUNDED')`,
    [old.point_of_sale_id, old.business_date, TIME_ZONE],
  );
  const f = financials.rows[0];
  const newSnapshot = {
    tickets_sold: Number(f.tickets_sold),
    gross_revenue: Number(f.gross_revenue),
    refunds: Number(f.refunds),
    net_revenue: Number(f.gross_revenue) - Number(f.refunds),
  };
  const previousSnapshot = {
    status: old.status,
    tickets_sold: Number(old.tickets_sold),
    gross_revenue: Number(old.gross_revenue),
    refunds: Number(old.refunds),
    net_revenue: Number(old.net_revenue),
  };

  await client.query(
    `UPDATE point_of_sale_daily_closure
        SET status = 'OPEN', closed_at = NULL, updated_at = NOW()
      WHERE id = $1`,
    [closureId],
  );
  await client.query(
    `INSERT INTO point_of_sale_closure_audit
      (closure_id, action, previous_snapshot, new_snapshot, reason, source)
     VALUES ($1, 'REOPENED', $2::jsonb, $3::jsonb, $4, 'SYSTEM')`,
    [closureId, JSON.stringify(previousSnapshot), JSON.stringify({ ...previousSnapshot, status: "OPEN" }), reason],
  );
  await client.query(
    `UPDATE point_of_sale_daily_closure
        SET tickets_sold = $2,
            gross_revenue = $3,
            refunds = $4,
            net_revenue = $5,
            status = 'CLOSED',
            closed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [closureId, newSnapshot.tickets_sold, newSnapshot.gross_revenue, newSnapshot.refunds, newSnapshot.net_revenue],
  );
  await client.query(
    `INSERT INTO point_of_sale_closure_audit
      (closure_id, action, previous_snapshot, new_snapshot, reason, source)
     VALUES ($1, 'RECALCULATED', $2::jsonb, $3::jsonb, $4, 'SYSTEM')`,
    [closureId, JSON.stringify({ ...previousSnapshot, status: "OPEN" }), JSON.stringify({ ...newSnapshot, status: "CLOSED" }), reason],
  );
}

async function detectFirstUse() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const candidates = await client.query<{
      voucherId: string;
      siteId: string;
      pointOfSaleId: string;
      code: string;
      firstSessionAt: string;
      unitPrice: string;
      currency: string;
      priceSource: string;
      businessDate: string;
    }>(
      `SELECT v.id AS "voucherId", v.site_id AS "siteId",
              pos.id AS "pointOfSaleId", v.code,
              first_session.started_at AS "firstSessionAt",
              COALESCE(v.price_snapshot, sp.price, p.price)::text AS "unitPrice",
              COALESCE(v.currency_snapshot, sp.currency, p.currency) AS currency,
              CASE
                WHEN v.price_snapshot IS NOT NULL THEN 'VOUCHER_SNAPSHOT'
                WHEN sp.price IS NOT NULL THEN 'CURRENT_SITE_PROFILE'
                ELSE 'CURRENT_PLAN'
              END AS "priceSource",
              (first_session.started_at AT TIME ZONE $1)::date::text AS "businessDate"
         FROM voucher v
         JOIN point_of_sale pos ON pos.id = v.point_of_sale_id
           AND pos.type = 'EXTERNAL' AND pos.status = 'ACTIVE'
         JOIN plan p ON p.id = v.plan_id AND p.site_id = v.site_id
         LEFT JOIN pos_sales_settings setting ON setting.organization_id = pos.organization_id
         LEFT JOIN site_hotspot_profile_price sp
           ON sp.site_id = v.site_id AND LOWER(sp.profile_code) = LOWER(v.mikrotik_profile)
         JOIN LATERAL (
           SELECT MIN(s.started_at) AS started_at
             FROM session s
            WHERE s.voucher_id = v.id
         ) first_session ON first_session.started_at IS NOT NULL
        WHERE v.first_use_detected_at IS NULL
          AND COALESCE(setting.detect_sale_on_first_use, TRUE) = TRUE
        ORDER BY first_session.started_at
        LIMIT 50
        FOR UPDATE OF v SKIP LOCKED`,
      [TIME_ZONE],
    );

    for (const item of candidates.rows) {
      if (Number(item.unitPrice) <= 0 || item.currency !== "MGA") {
        const issue = await client.query(
          `UPDATE voucher SET first_use_detection_issue = $2
            WHERE id = $1 AND first_use_detection_issue IS NULL`,
          [item.voucherId, "Prix ou devise du forfait non résolu pour la détection de vente."],
        );
        if (issue.rowCount) {
          console.warn(`[pos-sales] Détection mise en attente: prix non résolu pour le voucher ${item.code}.`);
        }
        continue;
      }

      const event = await client.query<{ id: string }>(
        `INSERT INTO point_of_sale_ticket_event
          (point_of_sale_id, site_id, voucher_id, voucher_code, event_type,
           unit_price, currency, source, actor_user_id, event_key, metadata, occurred_at)
         VALUES ($1,$2,$3,$4,'SOLD',$5,$6,'SYSTEM',NULL,$7,$8::jsonb,$9)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          item.pointOfSaleId,
          item.siteId,
          item.voucherId,
          item.code,
          Number(item.unitPrice),
          item.currency,
          `voucher-first-use:${item.voucherId}`,
          JSON.stringify({
            detection: "FIRST_SUCCESSFUL_SESSION",
            detectedAt: new Date().toISOString(),
            firstSessionStartedAt: item.firstSessionAt,
            priceSource: item.priceSource,
            saleTimeVerified: false,
          }),
          item.firstSessionAt,
        ],
      );

      await client.query(
        `UPDATE voucher SET first_use_detected_at = COALESCE(first_use_detected_at, NOW()),
            first_use_detection_issue = NULL
          WHERE id = $1`,
        [item.voucherId],
      );

      if (event.rows[0]) {
        const closure = await client.query<{ id: string }>(
          `SELECT id FROM point_of_sale_daily_closure
            WHERE point_of_sale_id = $1 AND business_date = $2::date
              AND status = 'CLOSED'
            FOR UPDATE`,
          [item.pointOfSaleId, item.businessDate],
        );
        if (closure.rows[0]) {
          await refreshClosedDay(
            client,
            closure.rows[0].id,
            `Première utilisation détectée tardivement pour le ticket ${item.code}; l'heure réelle de vente n'est pas connue.`,
          );
        }
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeFinancialDay(pointOfSaleId: string, businessDate: string, currency = "MGA") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [pointOfSaleId, businessDate]);
    const existing = await client.query<{ id: string; status: string; [key: string]: unknown }>(
      `SELECT * FROM point_of_sale_daily_closure
        WHERE point_of_sale_id = $1 AND business_date = $2::date FOR UPDATE`,
      [pointOfSaleId, businessDate],
    );
    if (existing.rows[0]?.status === "CLOSED") {
      await client.query("COMMIT");
      return;
    }

    const totals = await client.query(
      `SELECT
         COUNT(DISTINCT LOWER(voucher_code)) FILTER (WHERE event_type = 'SOLD')::int AS tickets_sold,
         COALESCE(SUM(unit_price) FILTER (WHERE event_type = 'SOLD'), 0)::numeric(14,2) AS gross_revenue,
         COALESCE(SUM(unit_price) FILTER (WHERE event_type = 'REFUNDED'), 0)::numeric(14,2) AS refunds,
         COUNT(*) FILTER (WHERE event_type = 'STOCK_ASSIGNED')::int AS tickets_received,
         COUNT(*) FILTER (WHERE event_type = 'UNSOLD_CONFIRMED')::int AS unsold_in_stock,
         COUNT(*) FILTER (WHERE event_type = 'REJECTED')::int AS rejected_pending,
         COUNT(*) FILTER (WHERE event_type IN ('UNUSABLE','REPLACED'))::int AS unusable_or_replaced,
         COUNT(*) FILTER (WHERE event_type = 'MISSING')::int AS missing_tickets,
         COUNT(*) FILTER (WHERE event_type = 'REPLACED')::int AS free_replacements
       FROM point_of_sale_ticket_event
       WHERE point_of_sale_id = $1
         AND (occurred_at AT TIME ZONE $3)::date = $2::date`,
      [pointOfSaleId, businessDate, TIME_ZONE],
    );
    const t = totals.rows[0];
    const gross = Number(t.gross_revenue);
    const refunds = Number(t.refunds);
    const snapshot = {
      businessDate,
      ticketsSold: Number(t.tickets_sold),
      grossRevenue: gross,
      refunds,
      netRevenue: gross - refunds,
      automatic: true,
      physicalStockCount: null,
      stockReviewRequired: true,
    };
    const previous = existing.rows[0];
    let closureId = previous?.id;
    if (previous) {
      await client.query(
        `UPDATE point_of_sale_daily_closure
            SET currency = $2,
                tickets_received = $3,
                tickets_sold = $4,
                unsold_in_stock = $5,
                rejected_pending = $6,
                unusable_or_replaced = $7,
                missing_tickets = $8,
                free_replacements = $9,
                replacement_tickets_issued = $9,
                gross_revenue = $10,
                refunds = $11,
                net_revenue = $12,
                status = 'CLOSED',
                notes = COALESCE(notes || E'\\n', '') || 'Clôture financière automatique; comptage physique du stock à effectuer.',
                closed_at = NOW(),
                physical_stock_count = NULL,
                theoretical_stock = NULL,
                stock_review_required = TRUE,
                updated_at = NOW()
          WHERE id = $1`,
        [
          previous.id, currency, Number(t.tickets_received), Number(t.tickets_sold),
          Number(t.unsold_in_stock), Number(t.rejected_pending), Number(t.unusable_or_replaced),
          Number(t.missing_tickets), Number(t.free_replacements), gross, refunds, gross - refunds,
        ],
      );
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO point_of_sale_daily_closure
          (point_of_sale_id, business_date, currency, opening_stock, tickets_received,
           tickets_sold, unsold_in_stock, rejected_pending, unusable_or_replaced,
           missing_tickets, free_replacements, replacement_tickets_issued,
           gross_revenue, refunds, net_revenue, stock_discrepancy, status, notes,
           closed_by, closed_at, physical_stock_count, theoretical_stock, stock_review_required)
         VALUES ($1,$2::date,$3,0,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12,$13,0,
           'CLOSED','Clôture financière automatique; comptage physique du stock à effectuer.',NULL,NOW(),NULL,NULL,TRUE)
         ON CONFLICT (point_of_sale_id, business_date) DO NOTHING
         RETURNING id`,
        [
          pointOfSaleId, businessDate, currency, Number(t.tickets_received), Number(t.tickets_sold),
          Number(t.unsold_in_stock), Number(t.rejected_pending), Number(t.unusable_or_replaced),
          Number(t.missing_tickets), Number(t.free_replacements), gross, refunds, gross - refunds,
        ],
      );
      closureId = inserted.rows[0]?.id;
    }
    if (closureId) {
      await client.query(
        `INSERT INTO point_of_sale_closure_audit
          (closure_id, action, previous_snapshot, new_snapshot, reason, source)
         VALUES ($1,'AUTO_CLOSED',$2::jsonb,$3::jsonb,'Clôture financière automatique planifiée','SYSTEM')`,
        [
          closureId,
          previous ? JSON.stringify(previous) : null,
          JSON.stringify(snapshot),
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function runSchedulerCycle() {
  if (running) return;
  running = true;
  let lockClient: import("pg").PoolClient | null = null;
  let lockAcquired = false;
  try {
    lockClient = await pool.connect();
    const lock = await lockClient.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext('pos-operations-scheduler')) AS locked",
    );
    lockAcquired = lock.rows[0]?.locked === true;
    if (!lockAcquired) return;

    await detectFirstUse();

    const nowDate = localDate();
    const nowTime = localTime();
    const settings = await pool.query<{
      organizationId: string;
      closureTime: string;
      enabled: boolean;
    }>(
      `SELECT o.id AS "organizationId",
              COALESCE(s.closure_time, TIME '20:00')::text AS "closureTime",
              COALESCE(s.auto_closure_enabled, TRUE) AS enabled
         FROM organization o
         LEFT JOIN pos_sales_settings s ON s.organization_id = o.id`,
    );

    for (const setting of settings.rows) {
      if (!setting.enabled) continue;
      const closureTime = setting.closureTime.slice(0, 5);
      const targetDate = isClosureDue(nowTime, closureTime) ? nowDate : addDays(nowDate, -1);
      const posResult = await pool.query<{ id: string }>(
        `SELECT pos.id
           FROM point_of_sale pos
          WHERE pos.organization_id = $1 AND pos.type = 'EXTERNAL' AND pos.status = 'ACTIVE'`,
        [setting.organizationId],
      );
      for (const pos of posResult.rows) {
        const existing = await pool.query<{ lastDate: string | null }>(
          `SELECT MAX(business_date)::text AS "lastDate"
             FROM point_of_sale_daily_closure WHERE point_of_sale_id = $1`,
          [pos.id],
        );
        // Au premier lancement de cette fonctionnalité, ne pas créer rétroactivement
        // des centaines de clôtures vides: commencer à la date cible. Ensuite, rattraper
        // chaque journée manquée depuis la dernière clôture persistée.
        let date = existing.rows[0]?.lastDate
          ? addDays(existing.rows[0].lastDate as string, 1)
          : targetDate;
        // Bound catch-up work to one year per cycle; next cycles continue from the last closed date.
        if (date < addDays(targetDate, -365)) date = addDays(targetDate, -365);
        for (let n = 0; date <= targetDate && n < 366; n++, date = addDays(date, 1)) {
          await closeFinancialDay(pos.id, date);
        }
      }
    }
  } catch (error) {
    console.error("[pos-operations] Erreur du planificateur:", error);
  } finally {
    if (lockClient) {
      if (lockAcquired) {
        try { await lockClient.query("SELECT pg_advisory_unlock(hashtext('pos-operations-scheduler'))"); }
        catch (error) { console.error("[pos-operations] Impossible de libérer le verrou:", error); }
      }
      lockClient.release();
    }
    running = false;
  }
}

export function startPosOperationsScheduler() {
  if (timer) return;
  console.log(`[pos-operations] Planificateur actif; fuseau ${TIME_ZONE}; contrôle toutes les ${POLL_INTERVAL_MS / 1000}s.`);
  void runSchedulerCycle();
  timer = setInterval(() => void runSchedulerCycle(), POLL_INTERVAL_MS);
}

export function stopPosOperationsScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
