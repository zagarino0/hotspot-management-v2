export interface VoucherBatch {
  id: string;

  siteId: string;
  planId: string;

  createdBy: string;

  batchNumber: string;

  quantity: number;

  createdAt: Date;
}