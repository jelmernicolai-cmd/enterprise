// lib/upload-schema.ts
export type RawRow = Record<string, any>;

// Compleet genormaliseerde rij (alles wat analyses nodig kunnen hebben)
export type NormalizedRow = {
  period: string;   // YYYY-MM
  cust: string;
  pg: string;
  sku: string;

  // Sales
  gross: number;

  // Discounts (sales level)
  d_channel: number;
  d_customer: number;
  d_product: number;
  d_volume: number;
  d_other_sales: number; // Value + Other Sales
  d_mandatory: number;
  d_local: number;

  // Derived
  invoiced: number;

  // Rebates (claims)
  r_direct: number;
  r_prompt: number;
  r_indirect: number;
  r_mandatory: number;
  r_local: number;

  // Net
  net: number;

  // (optioneel ingelezen maar niet vereist in Row-type)
  royalty_income?: number;
  other_income?: number;
};

export const REQUIRED_HEADERS = [
  "Product Group Name",
  "SKU Name",
  "Customer Name (Sold-to)",
  "Fiscal year / period",
  "Sum of Gross Sales",
  "Sum of Channel Discounts",
  "Sum of Customer Discounts",
  "Sum of Product Discounts",
  "Sum of Volume Discounts",
  "Sum of Value Discounts",
  "Sum of Other Sales Discounts",
  "Sum of Mandatory Discounts",
  "Sum of Discount Local",
] as const;

type Req = (typeof REQUIRED_HEADERS)[number];

// alias mapping (case/underscore/space insensitive)
const ALIASES: Record<string, string> = {
  // Core dimensions
  "product group": "Product Group Name",
  "product group name": "Product Group Name",
  "pg": "Product Group Name",

  "sku": "SKU Name",
  "sku name": "SKU Name",

  "customer": "Customer Name (Sold-to)",
  "customer name": "Customer Name (Sold-to)",
  "sold-to": "Customer Name (Sold-to)",
  "sold to": "Customer Name (Sold-to)",
  "customer name (sold-to)": "Customer Name (Sold-to)",

  "fiscal year / period": "Fiscal year / period",
  "fiscal period": "Fiscal year / period",
  "period": "Fiscal year / period",
  "fy period": "Fiscal year / period",
  "fy/period": "Fiscal year / period",

  // Gross
  "sum of gross sales": "Sum of Gross Sales",
  "gross": "Sum of Gross Sales",
  "gross sales": "Sum of Gross Sales",

  // Discounts
  "sum of channel discounts": "Sum of Channel Discounts",
  "channel discounts": "Sum of Channel Discounts",
  "sum of customer discounts": "Sum of Customer Discounts",
  "customer discounts": "Sum of Customer Discounts",
  "sum of product discounts": "Sum of Product Discounts",
  "product discounts": "Sum of Product Discounts",
  "sum of volume discounts": "Sum of Volume Discounts",
  "volume discounts": "Sum of Volume Discounts",
  "sum of value discounts": "Sum of Value Discounts",
  "value discounts": "Sum of Value Discounts",
  "sum of other sales discounts": "Sum of Other Sales Discounts",
  "other sales discounts": "Sum of Other Sales Discounts",
  "sum of mandatory discounts": "Sum of Mandatory Discounts",
  "mandatory discounts": "Sum of Mandatory Discounts",
  "sum of discount local": "Sum of Discount Local",
  "discount local": "Sum of Discount Local",

  // Invoiced
  "sum of invoiced sales": "Sum of Invoiced Sales",
  "invoiced": "Sum of Invoiced Sales",

  // Rebates
  "sum of direct rebates": "Sum of Direct Rebates",
  "direct rebates": "Sum of Direct Rebates",
  "sum of prompt payment rebates": "Sum of Prompt Payment Rebates",
  "prompt payment rebates": "Sum of Prompt Payment Rebates",
  "sum of indirect rebates": "Sum of Indirect Rebates",
  "indirect rebates": "Sum of Indirect Rebates",
  "sum of mandatory rebates": "Sum of Mandatory Rebates",
  "mandatory rebates": "Sum of Mandatory Rebates",
  "sum of rebate local": "Sum of Rebate Local",
  "rebate local": "Sum of Rebate Local",

  // Income & Net
  "sum of royalty income": "Sum of Royalty Income",
  "royalty income": "Sum of Royalty Income",
  "sum of other income": "Sum of Other Income",
  "other income": "Sum of Other Income",
  "sum of net sales": "Sum of Net Sales",
  "net sales": "Sum of Net Sales",
};

function normHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, " ").replace(/[_-]/g, " ");
}

export function resolveHeader(name: string): string | null {
  const n = normHeader(name);
  const all = [
    ...REQUIRED_HEADERS,
    "Sum of Invoiced Sales",
    "Sum of Direct Rebates",
    "Sum of Prompt Payment Rebates",
    "Sum of Indirect Rebates",
    "Sum of Mandatory Rebates",
    "Sum of Rebate Local",
    "Sum of Royalty Income",
    "Sum of Other Income",
    "Sum of Net Sales",
  ];
  const direct = all.find((h) => normHeader(h) === n);
  if (direct) return direct;
  return ALIASES[n] || null;
}

// ✅ Verbeterde parseNumber: robuust voor EU/US notatie & negatieve bedragen
export function parseNumber(val: any): number {
  if (val == null) return 0;
  if (typeof val === "number" && isFinite(val)) return val;

  let s = String(val)
    .replace(/\u00A0/g, " ")     // non-breaking space
    .replace(/[€$]/g, "")        // valuta
    .trim();

  if (!s) return 0;

  // Verwijder spaties in cijfers (bv. "1 234,56")
  s = s.replace(/\s+/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // EU: 1.234,56 -> verwijder punten (duizend), vervang komma door punt
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US: 1,234.56 -> verwijder komma’s
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // Alleen komma: decimaal
    s = s.replace(",", ".");
  }

  // Als er meerdere punten overblijven, verwijder alle behalve de laatste (duizendtallen)
  const parts = s.split(".");
  if (parts.length > 2) {
    const dec = parts.pop();
    s = parts.join("") + (dec ? "." + dec : "");
  }

  const n = Number(s);
  return isFinite(n) ? n : 0;
}

// ✅ Uitgebreide normalizePeriod: ondersteunt YYYY-MM, MM-YYYY, maandnamen EN/NL
export function normalizePeriod(input: any): string | null {
  if (!input && input !== 0) return null;
  let s = String(input).trim().toUpperCase();

  // YYYY-MM of YYYY/MM
  let m = s.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;

  // MM-YYYY of MM/YYYY
  m = s.match(/^(\d{1,2})[-\/](\d{4})$/);
  if (m) return `${m[2]}-${String(Number(m[1])).padStart(2, "0")}`;

  // YYYYMM
  m = s.match(/^(\d{4})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;

  // YYYY Q1-Q4
  m = s.match(/^(\d{4})\s*Q([1-4])$/);
  if (m) {
    const map: Record<number, string> = { 1: "01", 2: "04", 3: "07", 4: "10" };
    return `${m[1]}-${map[Number(m[2])]}`;
  }

  // Alleen jaar
  m = s.match(/^(\d{4})$/);
  if (m) return `${m[1]}-01`;

  // Month YYYY (EN/NL)
  const MONTHS: Record<string, string> = {
    JAN: "01", JANUARY: "01", JANUARI: "01",
    FEB: "02", FEBRUARY: "02", FEBRUARI: "02",
    MAR: "03", MARCH: "03", MAART: "03",
    APR: "04", APRIL: "04",
    MAY: "05", MEI: "05",
    JUN: "06", JUNE: "06", JUNI: "06",
    JUL: "07", JULY: "07", JULI: "07",
    AUG: "08", AUGUST: "08", AUGUSTUS: "08",
    SEP: "09", SEPT: "09", SEPTEMBER: "09",
    OCT: "10", OKT: "10", OCTOBER: "10", OKTOBER: "10",
    NOV: "11", NOVEMBER: "11",
    DEC: "12", DECEMBER: "12",
  };
  m = s.match(/^([A-ZÄÖÜÉÈÍÓÁ]+)\s+(\d{4})$/);
  if (m) {
    const mm = MONTHS[m[1]];
    if (mm) return `${m[2]}-${mm}`;
  }

  return null;
}

export type ValidateReport = {
  ok: boolean;
  fixedHeaders: Record<string, string>;
  missing: string[];
  rows: number;
  issues: string[];
  preview: NormalizedRow[];
};

export function normalizeRows(inputRows: RawRow[]): ValidateReport {
  const issues: string[] = [];
  if (!inputRows.length) {
    return {
      ok: false,
      fixedHeaders: {},
      missing: Array.from(REQUIRED_HEADERS),
      rows: 0,
      issues: ["Leeg bestand"],
      preview: [],
    };
  }

  // Header mapping
  const originalHeaders = Object.keys(inputRows[0] || {});
  const used: Record<string, string> = {};
  const hmap: Record<string, string> = {};
  for (const oh of originalHeaders) {
    const resolved = resolveHeader(oh);
    if (resolved) {
      used[oh] = resolved;
      hmap[resolved] = oh;
    }
  }

  const missing = REQUIRED_HEADERS.filter((h) => !hmap[h]);
  const coreMissing = ["Product Group Name","SKU Name","Customer Name (Sold-to)","Fiscal year / period","Sum of Gross Sales"].filter((h)=>!hmap[h]);

  const out: NormalizedRow[] = [];
  for (let i = 0; i < inputRows.length; i++) {
    const r = inputRows[i];

    const g = (k: string) => {
      const key = hmap[k];
      return key ? r[key] : "";
    };

    const period = normalizePeriod(g("Fiscal year / period"));
    if (!period) {
      if (issues.length < 50)
        issues.push(`Rij ${i + 2}: ongeldige periode "${r[hmap["Fiscal year / period"] || ""]}"`);
      continue;
    }

    const gross = parseNumber(g("Sum of Gross Sales"));
    const d_channel = parseNumber(g("Sum of Channel Discounts"));
    const d_customer = parseNumber(g("Sum of Customer Discounts"));
    const d_product = parseNumber(g("Sum of Product Discounts"));
    const d_volume = parseNumber(g("Sum of Volume Discounts"));
    const d_value = parseNumber(g("Sum of Value Discounts"));
    const d_otherSales = parseNumber(g("Sum of Other Sales Discounts"));
    const d_mandatory = parseNumber(g("Sum of Mandatory Discounts"));
    const d_local = parseNumber(g("Sum of Discount Local"));
    const d_other_sales = d_value + d_otherSales;

    const discounts = d_channel + d_customer + d_product + d_volume + d_other_sales + d_mandatory + d_local;

    // invoiced fallback
    let invoiced = parseNumber(g("Sum of Invoiced Sales"));
    if (!invoiced && gross) invoiced = Math.max(0, gross - discounts);

    const r_direct = parseNumber(g("Sum of Direct Rebates"));
    const r_prompt = parseNumber(g("Sum of Prompt Payment Rebates"));
    const r_indirect = parseNumber(g("Sum of Indirect Rebates"));
    const r_mandatory = parseNumber(g("Sum of Mandatory Rebates"));
    const r_local = parseNumber(g("Sum of Rebate Local"));
    const rebates = r_direct + r_prompt + r_indirect + r_mandatory + r_local;

    const royalty_income = parseNumber(g("Sum of Royalty Income"));
    const other_income = parseNumber(g("Sum of Other Income"));

    // net fallback
    let net = parseNumber(g("Sum of Net Sales"));
    if (!net && invoiced) net = Math.max(0, invoiced - rebates + royalty_income + other_income);

    out.push({
      period,
      cust: String(g("Customer Name (Sold-to)") ?? "").trim(),
      pg: String(g("Product Group Name") ?? "").trim(),
      sku: String(g("SKU Name") ?? "").trim(),
      gross,
      d_channel,
      d_customer,
      d_product,
      d_volume,
      d_other_sales,
      d_mandatory,
      d_local,
      invoiced,
      r_direct,
      r_prompt,
      r_indirect,
      r_mandatory,
      r_local,
      net,
      royalty_income,
      other_income,
    });
  }

  const ok = coreMissing.length === 0 && out.length > 0;
  return {
    ok,
    fixedHeaders: used,
    missing,
    rows: out.length,
    issues,
    preview: out.slice(0, 2000),
  };
}
