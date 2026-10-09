import type { PoolClient } from "pg";
import { pool } from "../../database/pool.js";
import { badRequest, conflict, forbidden, notFoundError } from "../../lib/errors.js";
import { calculateDailyFinancials, calculateDailyStock, validateTicketEvent } from "./pointOfSaleDaily.calculations.js";

export const POS_TICKET_EVENT_TYPES = ["STOCK_ASSIGNED","SOLD","UNSOLD_CONFIRMED","REJECTED","RETURN_REQUESTED","RETURNED_TO_STOCK","REPLACED","UNUSABLE","MISSING","REFUNDED"] as const;
export type PosTicketEventType = (typeof POS_TICKET_EVENT_TYPES)[number];
type PosAccess = { id: string; organizationId: string };

async function assertExternalPosAccess(client: PoolClient, pointOfSaleId: string, userId: string): Promise<PosAccess> {
  const result = await client.query<PosAccess>(`SELECT pos.id, pos.organization_id AS "organizationId"
    FROM point_of_sale pos JOIN "user" u ON u.organization_id = pos.organization_id
    WHERE pos.id = $1 AND u.id = $2 AND pos.type = 'EXTERNAL' LIMIT 1`, [pointOfSaleId,userId]);
  if (!result.rows[0]) throw notFoundError("Point de vente externe introuvable.");
  return result.rows[0];
}
async function assertPermission(client: PoolClient, userId: string, organizationId: string, code: string) {
  const result = await client.query(`SELECT 1 FROM user_role ur
    JOIN role r ON r.id=ur.role_id AND r.status='ACTIVE'
    JOIN role_permission rp ON rp.role_id=r.id JOIN permission p ON p.id=rp.permission_id
    WHERE ur.user_id=$1 AND p.code=$2 AND (r.organization_id=$3 OR r.organization_id IS NULL) LIMIT 1`,
    [userId,code,organizationId]);
  if (!result.rows[0]) throw forbidden("Vous ne disposez pas de la permission nécessaire pour cette opération.");
}

export async function listDailyClosures(id: string, userId: string, from?: string, to?: string) {
  const c=await pool.connect(); try {
    const pos=await assertExternalPosAccess(c,id,userId); await assertPermission(c,userId,pos.organizationId,"POS_DAILY_CLOSURES_READ");
    const r=await c.query(`SELECT * FROM point_of_sale_daily_closure WHERE point_of_sale_id=$1
      AND ($2::date IS NULL OR business_date >= $2::date) AND ($3::date IS NULL OR business_date <= $3::date)
      ORDER BY business_date DESC LIMIT 120`,[id,from??null,to??null]); return r.rows;
  } finally { c.release(); }
}
export async function listTicketEvents(id: string,userId: string,date?: string) {
  const c=await pool.connect(); try {
    const pos=await assertExternalPosAccess(c,id,userId); await assertPermission(c,userId,pos.organizationId,"POS_TICKET_EVENTS_READ");
    const r=await c.query(`SELECT e.* FROM point_of_sale_ticket_event e WHERE e.point_of_sale_id=$1
      AND ($2::date IS NULL OR (e.occurred_at AT TIME ZONE 'Indian/Antananarivo')::date=$2::date)
      ORDER BY e.occurred_at DESC LIMIT 500`,[id,date??null]); return r.rows;
  } finally { c.release(); }
}
export async function createTicketEvent(id: string,userId: string,input: {
  siteId:string; voucherId?:string|null; replacementVoucherId?:string|null; voucherCode:string;
  replacementVoucherCode?:string|null; eventType:PosTicketEventType; reasonCode?:string|null; reason?:string|null;
  unitPrice?:number; currency?:string; eventKey:string; metadata?:Record<string,unknown>;
}) {
  if (!POS_TICKET_EVENT_TYPES.includes(input.eventType)) throw badRequest("Type d'événement de ticket invalide.");
  if (!input.siteId?.trim()||!input.voucherCode?.trim()||!input.eventKey?.trim()) throw badRequest("Le site, le code du ticket et la clé d'événement sont obligatoires.");
  let price:{unitPrice:number;currency:string};
  try { price=validateTicketEvent(input); } catch(e) { throw badRequest(e instanceof Error?e.message:"Données de ticket invalides."); }
  const c=await pool.connect();
  try {
    await c.query("BEGIN"); const pos=await assertExternalPosAccess(c,id,userId);
    await assertPermission(c,userId,pos.organizationId,"POS_TICKET_EVENTS_CREATE");
    const site=await c.query("SELECT id FROM site WHERE id=$1 AND organization_id=$2 LIMIT 1",[input.siteId,pos.organizationId]);
    if (!site.rows[0]) throw badRequest("Le site n'appartient pas à l'organisation du point de vente.");
    if (input.eventType==="SOLD") {
      const prior=await c.query(`SELECT id FROM point_of_sale_ticket_event WHERE point_of_sale_id=$1 AND LOWER(voucher_code)=LOWER($2) AND event_type='SOLD' LIMIT 1`,[id,input.voucherCode.trim()]);
      if(prior.rows[0]) throw conflict("Ce ticket est déjà enregistré comme vendu pour ce point de vente.");
    }
    if(input.eventType==="REFUNDED") {
      const sale=await c.query<{unitPrice:string;currency:string}>(`SELECT unit_price AS "unitPrice",currency FROM point_of_sale_ticket_event
        WHERE point_of_sale_id=$1 AND LOWER(voucher_code)=LOWER($2) AND event_type='SOLD' ORDER BY occurred_at ASC LIMIT 1 FOR UPDATE`,[id,input.voucherCode.trim()]);
      if(!sale.rows[0]) throw badRequest("Impossible de rembourser un ticket sans vente initiale enregistrée.");
      if(sale.rows[0].currency!==price.currency) throw badRequest("La devise du remboursement ne correspond pas à celle de la vente initiale.");
      const previous=await c.query<{total:string}>(`SELECT COALESCE(SUM(unit_price),0)::text AS total FROM point_of_sale_ticket_event
        WHERE point_of_sale_id=$1 AND LOWER(voucher_code)=LOWER($2) AND event_type='REFUNDED'`,[id,input.voucherCode.trim()]);
      if(Number(previous.rows[0]?.total??0)+price.unitPrice>Number(sale.rows[0].unitPrice)) throw conflict("Le remboursement cumulé dépasserait le montant de la vente initiale.");
    }
    if(input.eventType==="REPLACED") {
      const duplicate=await c.query(`SELECT id FROM point_of_sale_ticket_event WHERE point_of_sale_id=$1
        AND (LOWER(voucher_code)=LOWER($2) OR LOWER(COALESCE(replacement_voucher_code,''))=LOWER($2)) LIMIT 1`,[id,input.replacementVoucherCode!.trim()]);
      if(duplicate.rows[0]) throw conflict("Le ticket de remplacement a déjà été utilisé dans un autre événement.");
    }
    const r=await c.query(`INSERT INTO point_of_sale_ticket_event
      (point_of_sale_id,site_id,voucher_id,replacement_voucher_id,voucher_code,replacement_voucher_code,event_type,reason_code,reason,unit_price,currency,source,actor_user_id,event_key,metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'APPLICATION',$12,$13,$14::jsonb) ON CONFLICT(event_key) DO NOTHING RETURNING *`,
      [id,input.siteId,input.voucherId??null,input.replacementVoucherId??null,input.voucherCode.trim(),input.replacementVoucherCode?.trim()??null,input.eventType,input.reasonCode??null,input.reason??null,price.unitPrice,price.currency,userId,input.eventKey.trim(),JSON.stringify(input.metadata??{})]);
    if(!r.rows[0]) throw conflict("Cet événement de ticket a déjà été enregistré.");
    await c.query("COMMIT"); return r.rows[0];
  } catch(e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
}
export async function closeDailySales(id:string,userId:string,input:{
  businessDate:string;currency?:string;openingStock:number;ticketsReceived?:number;unsoldInStock:number;
  rejectedPending:number;unusableOrReplaced:number;missingTickets:number;notes?:string|null;
}) {
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(input.businessDate)) throw badRequest("La date doit respecter le format YYYY-MM-DD.");
  const d=new Date(input.businessDate+"T00:00:00Z");
  if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==input.businessDate) throw badRequest("La date de clôture est invalide.");
  const currency=(input.currency??"MGA").toUpperCase(); if(currency!=="MGA") throw badRequest("La devise de ce point de vente doit être MGA.");
  const baseCounts=[input.openingStock,input.ticketsReceived??0,input.unsoldInStock,input.rejectedPending,input.unusableOrReplaced,input.missingTickets];
  if(baseCounts.some(n=>!Number.isSafeInteger(n)||n<0)) throw badRequest("Les compteurs de stock doivent être des entiers positifs ou nuls.");
  const c=await pool.connect();
  try {
    await c.query("BEGIN"); const pos=await assertExternalPosAccess(c,id,userId);
    await assertPermission(c,userId,pos.organizationId,"POS_DAILY_CLOSURES_CLOSE");
    const events=await c.query<{eventType:string;voucherCode:string;unitPrice:string;currency:string}>(`SELECT event_type AS "eventType",voucher_code AS "voucherCode",unit_price::text AS "unitPrice",currency
      FROM point_of_sale_ticket_event WHERE point_of_sale_id=$1 AND (occurred_at AT TIME ZONE 'Indian/Antananarivo')::date=$2::date AND event_type IN ('SOLD','REFUNDED')`,[id,input.businessDate]);
    let fin:ReturnType<typeof calculateDailyFinancials>;
    try { fin=calculateDailyFinancials(events.rows.map(e=>({...e,unitPrice:Number(e.unitPrice)})),currency); }
    catch(e) { throw badRequest(e instanceof Error?e.message:"Événements financiers incohérents."); }
    const reps=await c.query<{count:string}>(`SELECT COUNT(*)::text AS count FROM point_of_sale_ticket_event
      WHERE point_of_sale_id=$1 AND (occurred_at AT TIME ZONE 'Indian/Antananarivo')::date=$2::date AND event_type='REPLACED'`,[id,input.businessDate]);
    const replacementCount=Number(reps.rows[0]?.count??0);
    const stock=calculateDailyStock({openingStock:input.openingStock,ticketsReceived:input.ticketsReceived??0,ticketsSold:fin.ticketsSold,
      unsoldInStock:input.unsoldInStock,rejectedPending:input.rejectedPending,unusableOrReplaced:input.unusableOrReplaced,
      replacementTicketsIssued:replacementCount,missingTickets:input.missingTickets});
    const r=await c.query(`INSERT INTO point_of_sale_daily_closure
      (point_of_sale_id,business_date,currency,opening_stock,tickets_received,tickets_sold,unsold_in_stock,rejected_pending,unusable_or_replaced,replacement_tickets_issued,missing_tickets,free_replacements,gross_revenue,refunds,net_revenue,stock_discrepancy,status,notes,created_by,closed_by,closed_at)
      VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$10,$12,$13,$14,$15,'CLOSED',$16,$17,$17,NOW()) RETURNING *`,
      [id,input.businessDate,currency,input.openingStock,input.ticketsReceived??0,fin.ticketsSold,input.unsoldInStock,input.rejectedPending,input.unusableOrReplaced,replacementCount,input.missingTickets,fin.grossRevenue,fin.refunds,fin.netRevenue,stock.discrepancy,input.notes??null,userId]);
    await c.query("COMMIT"); return {...r.rows[0],stockBalanced:stock.stockBalanced,expectedStock:stock.expectedStock,accountedStock:stock.accountedStock};
  } catch(e:any) { await c.query("ROLLBACK"); if(e?.code==="23505") throw conflict("Une clôture existe déjà pour ce point de vente et cette date. Toute correction doit être auditée."); throw e; }
  finally { c.release(); }
}
