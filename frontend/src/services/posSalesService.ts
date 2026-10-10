import api from "./api";

export interface PosTicketEvent {
  id: string;
  point_of_sale_id: string;
  site_id: string;
  voucher_id: string | null;
  voucher_code: string;
  event_type: string;
  unit_price: string | number;
  currency: string;
  occurred_at: string;
  event_key: string;
  metadata: Record<string, unknown>;
}

export interface PosDailyClosure {
  id: string;
  point_of_sale_id: string;
  business_date: string;
  tickets_sold: number;
  gross_revenue: string | number;
  refunds: string | number;
  net_revenue: string | number;
  status: "OPEN" | "CLOSED";
  stock_review_required?: boolean;
  physical_stock_count?: number | null;
  closed_at: string | null;
}

export interface PosRemittance {
  id: string;
  point_of_sale_id: string;
  business_date: string;
  expected_amount: string | number;
  remitted_amount: string | number;
  difference: string | number;
  remitted_at: string;
  note: string | null;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function getPosTicketEvents(id: string, date?: string): Promise<PosTicketEvent[]> {
  const response = await api.get<Envelope<PosTicketEvent[]>>(
    `/api/sales/point-of-sales/${id}/ticket-events`,
    { params: date ? { date } : undefined },
  );
  return response.data.data;
}

export async function getPosDailyClosures(id: string, from?: string, to?: string): Promise<PosDailyClosure[]> {
  const response = await api.get<Envelope<PosDailyClosure[]>>(
    `/api/sales/point-of-sales/${id}/daily-closures`,
    { params: { ...(from ? { from } : {}), ...(to ? { to } : {}) } },
  );
  return response.data.data;
}

export async function getPosRemittances(id: string, from?: string, to?: string): Promise<PosRemittance[]> {
  const response = await api.get<Envelope<PosRemittance[]>>(
    `/api/pos-operations/${id}/remittances`,
    { params: { ...(from ? { from } : {}), ...(to ? { to } : {}) } },
  );
  return response.data.data;
}

export async function createPosRemittance(id: string, input: {
  businessDate: string;
  remittedAmount: number;
  note?: string;
}): Promise<PosRemittance> {
  const response = await api.post<Envelope<PosRemittance>>(
    `/api/pos-operations/${id}/remittances`,
    input,
  );
  return response.data.data;
}
