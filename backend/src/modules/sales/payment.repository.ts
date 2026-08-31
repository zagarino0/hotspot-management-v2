import { pool } from "../../database/pool.js";

import type {
  PaymentRow,
  RecordPaymentData,
} from "../../routes/payment.types.js";

const PAYMENT_SELECT = `
  SELECT
    id,
    site_id AS "siteId",
    sale_id AS "saleId",
    amount::float8 AS "amount",
    currency,
    method,
    status,
    paid_at AS "paidAt",
    reference,
    customer_phone AS "customerPhone",
    notes,
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM payment
`;

/* ============================================================
   LIST BY SALE
============================================================ */

export async function findPaymentsBySaleId(
  saleId: string
): Promise<PaymentRow[]> {
  const result = await pool.query<PaymentRow>(
    `
      ${PAYMENT_SELECT}
      WHERE sale_id = $1
      ORDER BY created_at ASC
    `,
    [saleId]
  );

  return result.rows;
}

/* ============================================================
   INSERT
============================================================ */

export async function insertPayment(
  siteId: string,
  data: RecordPaymentData,
  currency: string
): Promise<PaymentRow> {
  const status = data.markAsPaid ? "SUCCESS" : "PENDING";

  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO payment (
        site_id,
        sale_id,
        amount,
        currency,
        method,
        status,
        paid_at,
        reference,
        customer_phone,
        notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        CASE WHEN $6 = 'SUCCESS' THEN NOW() ELSE NULL END,
        $7, $8, $9
      )
      RETURNING id
    `,
    [
      siteId,
      data.saleId,
      data.amount,
      currency,
      data.method,
      status,
      data.reference ?? null,
      data.customerPhone ?? null,
      data.notes ?? null,
    ]
  );

  const result2 = await pool.query<PaymentRow>(
    `
      ${PAYMENT_SELECT}
      WHERE id = $1
    `,
    [result.rows[0].id]
  );

  return result2.rows[0];
}
