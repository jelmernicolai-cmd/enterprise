// lib/pricing/db.ts
export type Product = {
  sku: string;
  productName: string;
  packSize: string; // "Standaard Verpakk. Grootte"
  registration: string; // Registratienummer (RVG/…)
  zi: string; // ZI-nummer
  aip: number; // AIP (EUR)
  minOrder: number; // Minimale bestelgrootte
  casePack: string; // Doosverpakking
  custom?: Record<string, string | number | boolean | null>;
};

export type Customer = {
  id: string;    // bv. "wh-a"
  name: string;  // bv. "Groothandel A"
  discountPct: number; // GIP-korting in %
};

/**
 * Eenvoudige in-memory storage.
 * In productie vervang je dit met een echte DB (Postgres/Supabase/PlanetScale/etc.).
 * We gebruiken globalThis om dezelfde instance te delen binnen één Vercel runtime.
 */
type PricingDB = {
  products: Product[];
  customers: Customer[];
};

const g = globalThis as any;
if (!g.__PRICING_DB__) {
  const seed: PricingDB = {
    products: [],
    customers: [],
  };
  g.__PRICING_DB__ = seed;
}
const store: PricingDB = g.__PRICING_DB__;

/* -------- API ------- */
export async function getProducts(): Promise<Product[]> {
  return store.products;
}
export async function setProducts(rows: Product[]): Promise<void> {
  // simpele validatie
  store.products = (rows || []).map((r) => ({
    ...r,
    aip: Number(r.aip) || 0,
    minOrder: Number(r.minOrder) || 0,
  }));
}

export async function getCustomers(): Promise<Customer[]> {
  return store.customers;
}
export async function setCustomers(rows: Customer[]): Promise<void> {
  store.customers = (rows || []).map((r) => ({
    ...r,
    discountPct: Number(r.discountPct) || 0,
  }));
}
