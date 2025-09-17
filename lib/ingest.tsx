// lib/ingest.ts
import * as XLSX from 'xlsx';

export type Row = {
  productGroupName?: string;
  skuName?: string;
  customerName?: string; // Sold-to
  fiscalPeriod?: string | number;

  // Waterfall sums
  grossSales?: number;
  channelDiscounts?: number;
  customerDiscounts?: number;
  productDiscounts?: number;
  volumeDiscounts?: number;
  valueDiscounts?: number;
  otherSalesDiscounts?: number;
  mandatoryDiscounts?: number;
  discountLocal?: number;
  invoicedSales?: number;
  directRebates?: number;
  promptPaymentRebates?: number;
  indirectRebates?: number;
  mandatoryRebates?: number;
  rebateLocal?: number;
  royaltyIncome?: number;
  otherIncome?: number;
  netSales?: number;

  // Consistency sums
  totalGtNSpend?: number; // wanneer aanwezig; anders berekenbaar = grossSales - netSales
};

function n(v: any) {
  if (v === '' || v == null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') {
    const t = v.replace(/\./g, '').replace(',', '.'); // "1.234,56" -> "1234.56"
    const num = Number(t);
    return Number.isFinite(num) ? num : undefined;
  }
  const num = Number(v);
  return Number.isFinite(num) ? num : undefined;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Koppelt varianten van kolomnamen aan onze canonical keys.
const MAP: Record<string, keyof Row> = (() => {
  const m: Record<string, keyof Row> = {};

  const add = (variants: string[], key: keyof Row) => {
    variants.forEach(v => (m[norm(v)] = key));
  };

  // Identifiers
  add(['Product Group Name', 'Productgroep', 'Productgroep Naam'], 'productGroupName');
  add(['SKU Name', 'SKU', 'Artikel', 'Item'], 'skuName');
  add(['Customer Name (Sold-to)', 'Customer', 'Klant', 'Sold-to'], 'customerName');
  add(['Fiscal year / period', 'Fiscale periode', 'Periode', 'Maand', 'Jaar/Periode'], 'fiscalPeriod');

  // Waterfall Sums (exact volgens jouw lijst)
  add(['Sum of Gross Sales', 'Gross Sales', 'Bruto omzet'], 'grossSales');
  add(['Sum of Channel Discounts', 'Channel Discounts'], 'channelDiscounts');
  add(['Sum of Customer Discounts', 'Customer Discounts'], 'customerDiscounts');
  add(['Sum of Product Discounts', 'Product Discounts'], 'productDiscounts');
  add(['Sum of Volume Discounts', 'Volume Discounts'], 'volumeDiscounts');
  add(['Sum of Value Discounts', 'Value Discounts'], 'valueDiscounts');
  add(['Sum of Other Sales Discounts', 'Other Sales Discounts'], 'otherSalesDiscounts');
  add(['Sum of Mandatory Discounts', 'Mandatory Discounts'], 'mandatoryDiscounts');
  add(['Sum of Discount Local', 'Local Discount', 'Discount Local'], 'discountLocal');
  add(['Sum of Invoiced Sales', 'Invoiced Sales'], 'invoicedSales');
  add(['Sum of Direct Rebates', 'Direct Rebates'], 'directRebates');
  add(['Sum of Prompt Payment Rebates', 'Prompt Payment Rebates'], 'promptPaymentRebates');
  add(['Sum of Indirect Rebates', 'Indirect Rebates'], 'indirectRebates');
  add(['Sum of Mandatory Rebates', 'Mandatory Rebates'], 'mandatoryRebates');
  add(['Sum of Rebate Local', 'Local Rebate', 'Rebate Local'], 'rebateLocal');
  add(['Sum of Royalty Income', 'Royalty Income'], 'royaltyIncome');
  add(['Sum of Other Income', 'Other Income'], 'otherIncome');
  add(['Sum of Net Sales', 'Net Sales', 'Netto omzet'], 'netSales');

  // Consistency specific
  add(['Sum of Total GtN Spend', 'Total GtN Spend', 'Totaal GtN'], 'totalGtNSpend');

  return m;
})();

export function parseWorkbook(buf: ArrayBuffer): Row[] {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  return json.map((r) => {
    const out: Row = {};
    for (const k of Object.keys(r)) {
      const key = MAP[norm(k)];
      if (!key) continue;
      if (['productGroupName', 'skuName', 'customerName', 'fiscalPeriod'].includes(String(key))) {
        (out as any)[key] = String(r[k]);
      } else {
        (out as any)[key] = n(r[k]);
      }
    }

    // Consistency fallback als TotalGtNSpend niet is meegegeven
    if (out.totalGtNSpend == null && out.grossSales != null && out.netSales != null) {
      const diff = (out.grossSales || 0) - (out.netSales || 0);
      out.totalGtNSpend = diff >= 0 ? diff : 0;
    }

    return out;
  });
}
