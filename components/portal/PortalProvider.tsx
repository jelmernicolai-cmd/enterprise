'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Row } from '@/lib/ingest';

export type WaterfallTotals = {
  grossSales: number;
  invoicedSales: number;
  netSales: number;
  totalGtNSpend: number; // gross - net
  totalDiscount: number; // som van alle discount-categorieën
  totalRebate: number;   // som van alle rebate-categorieën
  pctGtN: number;        // totalGtNSpend / gross
  pctDiscount: number;   // totalDiscount / gross
  pctRebate: number;     // totalRebate / gross
  table: { level: string; amount: number; pct: number }[];
  topCustomers: { name: string; gtn: number; pct: number }[];
  topSkus: { name: string; gtn: number; pct: number }[];
};

export type ConsistencyView = {
  totalGrossSales: number;
  totalIncentives: number;      // som totalGtNSpend
  pctIncentives: number;        // / gross
  topCustomers: { name: string; gross: number; incentive: number; pct: number }[]; // top 15
};

type PortalCtx = {
  rows: Row[];
  setRows: (r: Row[]) => void;
  waterfall: WaterfallTotals | null;
  consistency: ConsistencyView | null;
};

const Ctx = createContext<PortalCtx | null>(null);

function sum(...vals: (number | undefined)[]) {
  return vals.reduce((a, b) => a + (b || 0), 0);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function buildWaterfall(rows: Row[]): WaterfallTotals | null {
  if (!rows.length) return null;

  let gross = 0, invoiced = 0, net = 0;
  let discChannel = 0, discCustomer = 0, discProduct = 0, discVolume = 0, discValue = 0,
      discOther = 0, discMandatory = 0, discLocal = 0;

  let rebDirect = 0, rebPrompt = 0, rebIndirect = 0, rebMandatory = 0, rebLocal = 0;
  let royalty = 0, otherIncome = 0;

  const byCustomer: Record<string, number> = {};
  const bySku: Record<string, number> = {};

  for (const r of rows) {
    gross += r.grossSales || 0;
    invoiced += r.invoicedSales || 0;
    net += r.netSales || 0;

    discChannel += r.channelDiscounts || 0;
    discCustomer += r.customerDiscounts || 0;
    discProduct += r.productDiscounts || 0;
    discVolume += r.volumeDiscounts || 0;
    discValue += r.valueDiscounts || 0;
    discOther += r.otherSalesDiscounts || 0;
    discMandatory += r.mandatoryDiscounts || 0;
    discLocal += r.discountLocal || 0;

    rebDirect += r.directRebates || 0;
    rebPrompt += r.promptPaymentRebates || 0;
    rebIndirect += r.indirectRebates || 0;
    rebMandatory += r.mandatoryRebates || 0;
    rebLocal += r.rebateLocal || 0;

    royalty += r.royaltyIncome || 0;
    otherIncome += r.otherIncome || 0;

    const gtn = (r.totalGtNSpend != null)
      ? r.totalGtNSpend
      : Math.max(0, (r.grossSales || 0) - (r.netSales || 0));

    if (r.customerName) byCustomer[r.customerName] = (byCustomer[r.customerName] || 0) + gtn;
    if (r.skuName) bySku[r.skuName] = (bySku[r.skuName] || 0) + gtn;
  }

  const totalDiscount = sum(
    discChannel, discCustomer, discProduct, discVolume, discValue,
    discOther, discMandatory, discLocal
  );
  const totalRebate = sum(rebDirect, rebPrompt, rebIndirect, rebMandatory, rebLocal);

  const totalGtNSpend = Math.max(0, gross - net);

  const pctGtN = gross > 0 ? (totalGtNSpend / gross) * 100 : 0;
  const pctDiscount = gross > 0 ? (totalDiscount / gross) * 100 : 0;
  const pctRebate = gross > 0 ? (totalRebate / gross) * 100 : 0;

  const table: { level: string; amount: number; pct: number }[] = [
    { level: 'Gross Sales', amount: gross, pct: 100 },
    { level: 'Channel Discounts', amount: -discChannel, pct: gross ? (-discChannel / gross) * 100 : 0 },
    { level: 'Customer Discounts', amount: -discCustomer, pct: gross ? (-discCustomer / gross) * 100 : 0 },
    { level: 'Product Discounts', amount: -discProduct, pct: gross ? (-discProduct / gross) * 100 : 0 },
    { level: 'Volume Discounts', amount: -discVolume, pct: gross ? (-discVolume / gross) * 100 : 0 },
    { level: 'Value Discounts', amount: -discValue, pct: gross ? (-discValue / gross) * 100 : 0 },
    { level: 'Other Sales Discounts', amount: -discOther, pct: gross ? (-discOther / gross) * 100 : 0 },
    { level: 'Mandatory Discounts', amount: -discMandatory, pct: gross ? (-discMandatory / gross) * 100 : 0 },
    { level: 'Local Discount', amount: -discLocal, pct: gross ? (-discLocal / gross) * 100 : 0 },
    { level: 'Invoiced Sales', amount: invoiced, pct: gross ? (invoiced / gross) * 100 : 0 },
    { level: 'Direct Rebates', amount: -rebDirect, pct: gross ? (-rebDirect / gross) * 100 : 0 },
    { level: 'Prompt Payment Rebates', amount: -rebPrompt, pct: gross ? (-rebPrompt / gross) * 100 : 0 },
    { level: 'Indirect Rebates', amount: -rebIndirect, pct: gross ? (-rebIndirect / gross) * 100 : 0 },
    { level: 'Mandatory Rebates', amount: -rebMandatory, pct: gross ? (-rebMandatory / gross) * 100 : 0 },
    { level: 'Local Rebate', amount: -rebLocal, pct: gross ? (-rebLocal / gross) * 100 : 0 },
    { level: 'Royalty Income*', amount: royalty, pct: gross ? (royalty / gross) * 100 : 0 },
    { level: 'Other Income*', amount: otherIncome, pct: gross ? (otherIncome / gross) * 100 : 0 },
    { level: 'Net Sales', amount: net, pct: gross ? (net / gross) * 100 : 0 },
  ].map(r => ({ ...r, amount: round2(r.amount), pct: round2(r.pct) }));

  const sortTop = (obj: Record<string, number>) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, gtn]) => ({
        name,
        gtn,
        pct: gross > 0 ? (gtn / totalGtNSpend) * 100 : 0,
      }));

  return {
    grossSales: round2(gross),
    invoicedSales: round2(invoiced),
    netSales: round2(net),
    totalGtNSpend: round2(totalGtNSpend),
    totalDiscount: round2(totalDiscount),
    totalRebate: round2(totalRebate),
    pctGtN: round2(pctGtN),
    pctDiscount: round2(pctDiscount),
    pctRebate: round2(pctRebate),
    table,
    topCustomers: sortTop(byCustomer).map(x => ({ ...x, gtn: round2(x.gtn), pct: round2(x.pct) })),
    topSkus: sortTop(bySku).map(x => ({ ...x, gtn: round2(x.gtn), pct: round2(x.pct) })),
  };
}

function buildConsistency(rows: Row[]): ConsistencyView | null {
  if (!rows.length) return null;

  let totalGross = 0, totalIncent = 0;
  const byCustomer: Record<string, { gross: number; incentive: number }> = {};

  for (const r of rows) {
    const g = r.grossSales || 0;
    const inc = (r.totalGtNSpend != null)
      ? r.totalGtNSpend!
      : Math.max(0, (r.grossSales || 0) - (r.netSales || 0));

    totalGross += g;
    totalIncent += inc;

    const c = r.customerName || '—';
    if (!byCustomer[c]) byCustomer[c] = { gross: 0, incentive: 0 };
    byCustomer[c].gross += g;
    byCustomer[c].incentive += inc;
  }

  const pctIncent = totalGross > 0 ? (totalIncent / totalGross) * 100 : 0;

  const topCustomers = Object.entries(byCustomer)
    .map(([name, v]) => ({
      name,
      gross: round2(v.gross),
      incentive: round2(v.incentive),
      pct: round2(v.gross > 0 ? (v.incentive / v.gross) * 100 : 0),
    }))
    .sort((a, b) => b.incentive - a.incentive)
    .slice(0, 15);

  return {
    totalGrossSales: round2(totalGross),
    totalIncentives: round2(totalIncent),
    pctIncentives: round2(pctIncent),
    topCustomers,
  };
}

export function usePortalBuilder(rows: Row[]) {
  const waterfall = useMemo(() => buildWaterfall(rows), [rows]);
  const consistency = useMemo(() => buildConsistency(rows), [rows]);
  return { waterfall, consistency };
}

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [rows, setRows] = useState<Row[]>([]);
  const { waterfall, consistency } = usePortalBuilder(rows);

  const value = useMemo(() => ({ rows, setRows, waterfall, consistency }), [rows, waterfall, consistency]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePortal must be used within PortalProvider');
  return ctx;
}
