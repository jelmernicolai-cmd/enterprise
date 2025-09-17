// lib/pricing/types.ts
export type Product = {
  id: string;
  sku: string;
  name: string;
  pack_size?: string;
  registration_no?: string;
  zi_number?: string;
  aip_eur: number;
  min_order_qty: number;
  case_pack?: string;
  custom?: Record<string, unknown>;
};

export type Customer = { id: string; name: string; code?: string };
export type CustomerDiscount = {
  id: string;
  customer_id: string;
  discount_pct: number; // 0..100
  valid_from: string;   // ISO date
  valid_to?: string | null;
};
