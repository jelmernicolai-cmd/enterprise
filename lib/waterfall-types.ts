// lib/waterfall-types.ts
export type Row = {
  pg: string;
  sku: string;
  cust: string;
  period: string;

  gross: number;

  // Discounts (zorg dat dit matcht met je Excel parsing)
  d_channel: number;
  d_customer: number;
  d_product: number;
  d_volume: number;
  d_other_sales: number;
  d_mandatory: number;
  d_local: number;

  invoiced: number;

  // Rebates
  r_direct: number;
  r_prompt: number;
  r_indirect: number;
  r_mandatory: number;
  r_local: number;

  // Overig
  inc_royalty: number;
  inc_other: number;

  net: number;
};
