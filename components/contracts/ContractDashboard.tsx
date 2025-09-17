// components/contracts/ContractDashboard.tsx
"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList,
  LineChart as RLineChart, Line, Legend,
} from "recharts";
import type { AnalyzeResult, LatestPerf } from "@/lib/contract-analysis";

/* ================= formatters ================= */
function eur0(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
}
function pct(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return `${(v * 100).toFixed(1)}%`;
}
function safe(n?: number) {
  return Number.isFinite(n || NaN) ? (n as number) : 0;
}

/* ================= helpers: normaliseren & aggregaties ================= */
type PeriodRow = { period: string; klant: string; sku?: string; revenue?: number; units?: number };

function normalizeLatest(latest: LatestPerf[]): LatestPerf[] {
  return (latest || []).map((r) => ({
    ...r,
    klant: r.klant || "",
    sku: r.sku || undefined,
    revenue: Number.isFinite((r as any).revenue) ? (r as any).revenue : 0,
    growthPct: Number.isFinite((r as any).growthPct) ? (r as any).growthPct : 0,
    deltaVsTotal: Number.isFinite((r as any).deltaVsTotal) ? (r as any).deltaVsTotal : 0,
  })) as any;
}

function unique<T>(arr: T[]) { return Array.from(new Set(arr)); }

/** Zoek perioderijen in byPeriod/history/series/rows. */
function extractPeriodRows(data: any): PeriodRow[] {
  const candidates: any[] = []
    .concat(Array.isArray(data?.byPeriod) ? data.byPeriod : [])
    .concat(Array.isArray(data?.history) ? data.history : [])
    .concat(Array.isArray(data?.series) ? data.series : [])
    .concat(Array.isArray(data?.rows) ? data.rows : []);
  if (!candidates.length) return [];

  return candidates.map((r) => {
    const period = String(r.period ?? r.month ?? r.label ?? "").trim();
    const klant = String(r.klant ?? r.customer ?? r.partner ?? "").trim();
    const sku = String(r.sku ?? r.SKU ?? r.product ?? r.Product ?? "").trim() || undefined;
    const revenue = Number.isFinite(r.revenue) ? r.revenue : Number(r.revenue) || undefined;
    const units = Number.isFinite(r.units) ? r.units : Number(r.units) || undefined;
    return { period, klant, sku, revenue, units };
  }).filter((r) => r.period && r.klant);
}

/** Canonicaliseer: som per (period, klant, sku); negeer agg-rij zonder sku als sku-rijen bestaan. */
function canonicalizeRows(rows: PeriodRow[]): PeriodRow[] {
  // 1) som per (period, klant, sku)
  const byKey = new Map<string, PeriodRow>();
  const key = (p: string, k: string, s?: string) => `${p}||${k}||${s ?? ""}`;
  for (const r of rows) {
    const k = key(r.period, r.klant, r.sku || undefined);
    const cur = byKey.get(k) || { period: r.period, klant: r.klant, sku: r.sku || undefined, revenue: 0, units: 0 };
    cur.revenue = (cur.revenue || 0) + (r.revenue || 0);
    cur.units   = (cur.units   || 0) + (r.units   || 0);
    byKey.set(k, cur);
  }
  const grouped = Array.from(byKey.values());

  // 2) markeer (period, klant) die sku-rijen hebben
  const hasSku = new Set<string>(); // key2 = period||klant
  const key2 = (p: string, k: string) => `${p}||${k}`;
  for (const r of grouped) if (r.sku) hasSku.add(key2(r.period, r.klant));

  // 3) filter: als sku’s bestaan voor (p,k), gooi agg-rij zonder sku weg
  return grouped.filter(r => r.sku || !hasSku.has(key2(r.period, r.klant)));
}

/** Bepaal last/prev en alle perioden (gesorteerd). */
function resolvePeriods(allRows: PeriodRow[], k: any, extras?: KpiExtras["periods"]) {
  let last = extras?.last || k?.latestPeriod || "";
  const ordered = unique(allRows.map(r => r.period)).sort();
  if (!last) last = ordered.at(-1) || "last";
  let prev = extras?.prev || "";
  if (!prev) {
    const idx = ordered.indexOf(last);
    prev = idx > 0 ? ordered[idx - 1] : ordered[0] || "prev";
  }
  return { last, prev, ordered };
}

/** Filter predicate op partner/SKU. */
function makeFilter(partners: Set<string>, skus: Set<string>) {
  const hasP = partners.size > 0;
  const hasS = skus.size > 0;
  return (row: { klant: string; sku?: string }) => {
    if (hasP && !partners.has(row.klant)) return false;
    if (hasS) return row.sku ? skus.has(row.sku) : false; // agg-rijen tellen niet mee als expliciet sku’s gekozen zijn
    return true;
  };
}

/** KPI’s uit "latest" subset. */
function kpisFromLatestSubset(latest: LatestPerf[]) {
  const totalRevenue = latest.reduce((a, r: any) => a + (r.revenue || 0), 0);
  const wGrowth = latest.reduce((a, r: any) => a + (r.growthPct || 0) * (r.revenue || 0), 0) / Math.max(1, totalRevenue);
  const top5Revenue = [...latest].sort((a: any, b: any) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 5)
    .reduce((a: number, r: any) => a + (r.revenue || 0), 0);
  const topSharePct = totalRevenue > 0 ? top5Revenue / totalRevenue : 0;
  return { totalRevenue, totalGrowthPct: Number.isFinite(wGrowth) ? wGrowth : 0, topSharePct };
}

/** Totals (units/revenue) per gekozen subset en periode. */
function totalsFromPeriods(rowsCanon: PeriodRow[], partners: Set<string>, skus: Set<string>, last: string, prev: string) {
  const pred = makeFilter(partners, skus);
  const filt = rowsCanon.filter(r => pred(r));
  const sum = (arr: PeriodRow[], key: "revenue" | "units") =>
    arr.reduce((a, r) => a + (Number(r[key]) || 0), 0);

  const lastRows = filt.filter(r => r.period === last);
  const prevRows = filt.filter(r => r.period === prev);

  return {
    curUnits: sum(lastRows, "units"),
    prevUnits: sum(prevRows, "units"),
    curRevenue: sum(lastRows, "revenue"),
    prevRevenue: sum(prevRows, "revenue"),
  };
}

/* ================= types ================= */
type KpiExtras = {
  periods: { last: string; prev: string };
  totals: { curUnits: number; prevUnits: number; curRevenue: number; prevRevenue: number };
};

/* ================= UI: filter chips & selectors ================= */
function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-white">
      {label}
      <button onClick={onClear} className="text-gray-500 hover:text-gray-800" aria-label={`Verwijder ${label}`}>×</button>
    </span>
  );
}

function MultiSelect({
  label, options, value, onChange,
}: {
  label: string;
  options: string[];
  value: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <label className="text-sm w-full">
      <div className="font-medium">{label}</div>
      <select
        multiple
        className="mt-1 w-full rounded-lg border px-3 py-2 h-28"
        value={Array.from(value)}
        onChange={(e) => {
          const next = new Set<string>();
          for (const opt of Array.from(e.target.selectedOptions)) next.add(opt.value);
          onChange(next);
        }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <div className="mt-1 text-[11px] text-gray-500">Ctrl/Cmd-klik om meerdere te kiezen. Leeg = alles.</div>
    </label>
  );
}

/* ================= hoofdcomponent ================= */
export default function ContractDashboard({
  dataOverride,
  kpiExtras,
}: {
  dataOverride: AnalyzeResult;
  kpiExtras?: KpiExtras;
}) {
  const [partnersSel, setPartnersSel] = useState<Set<string>>(new Set());
  const [skusSel, setSkusSel] = useState<Set<string>>(new Set());
  const [trendPartnerManual, setTrendPartnerManual] = useState<string>(""); // alleen gebruikt als er ≠1 partner geselecteerd is

  // Normaliseer brondata
  const data = dataOverride;
  const latestAll = useMemo(() => normalizeLatest(data.latest || []), [data.latest]);

  // Indexen voor filters
  const partners = useMemo(() => unique(latestAll.map(r => r.klant).filter(Boolean)).sort(), [latestAll]);
  const skusByPartner = useMemo(() => {
    const m = new Map<string, Set<string>>();
    latestAll.forEach(r => {
      const p = r.klant || "";
      const s = (r.sku || "").trim();
      if (!m.has(p)) m.set(p, new Set());
      if (s) m.get(p)!.add(s);
    });
    return m;
  }, [latestAll]);

  // SKU-opties beperken tot gekozen partners (of alles als geen partner gekozen)
  const skuOptions = useMemo(() => {
    if (partnersSel.size === 0) {
      return unique(latestAll.map(r => (r.sku || "").trim()).filter(Boolean)).sort();
    }
    const merged = new Set<string>();
    partnersSel.forEach(p => (skusByPartner.get(p) || new Set()).forEach(s => merged.add(s)));
    return Array.from(merged).sort();
  }, [latestAll, partnersSel, skusByPartner]);

  // Filter predicate
  const pred = useMemo(() => makeFilter(partnersSel, skusSel), [partnersSel, skusSel]);

  // Gefilterde "latest"
  const latest = useMemo(() => latestAll.filter(pred), [latestAll, pred]);

  // KPI’s op subset
  const kAll = data.kpis;
  const kSub = kpisFromLatestSubset(latest);
  const k = { ...kAll, ...kSub, latestPeriod: kAll.latestPeriod }; // behoud label

  // Periodedata → canonicaliseren
  const rawPeriodRows = useMemo(() => extractPeriodRows(data), [data]);
  const periodRows = useMemo(() => canonicalizeRows(rawPeriodRows), [rawPeriodRows]);

  // Perioden & totals voor KPI’s
  const { last, prev, ordered } = useMemo(() => resolvePeriods(periodRows, kAll, kpiExtras?.periods), [periodRows, kAll, kpiExtras?.periods]);

  const totals = useMemo(() => {
    if (periodRows.length) {
      return totalsFromPeriods(periodRows, partnersSel, skusSel, last, prev);
    }
    // fallback naar meegegeven kpiExtras
    return {
      curUnits: safe(kpiExtras?.totals.curUnits),
      prevUnits: safe(kpiExtras?.totals.prevUnits),
      curRevenue: safe(kpiExtras?.totals.curRevenue) || k.totalRevenue,
      prevRevenue: safe(kpiExtras?.totals.prevRevenue),
    };
  }, [periodRows, partnersSel, skusSel, last, prev, kpiExtras, k.totalRevenue]);

  // Afgeleide KPI’s
  const unitGrowthPct = totals.prevUnits > 0 ? (totals.curUnits - totals.prevUnits) / totals.prevUnits : (totals.curUnits > 0 ? 1 : 0);

  // Top/bottom en bars op subset
  const top = useMemo(() => {
    const arr = [...latest].sort((a, b) => b.deltaVsTotal - a.deltaVsTotal);
    return arr.slice(0, 5);
  }, [latest]);

  const bottom = useMemo(() => {
    const arr = [...latest].sort((a, b) => a.deltaVsTotal - b.deltaVsTotal);
    return arr.slice(0, 5);
  }, [latest]);

  const bars = useMemo(() => {
    const top6 = [...latest].sort((a, b) => b.deltaVsTotal - a.deltaVsTotal).slice(0, 6);
    const bot6 = [...latest].sort((a, b) => a.deltaVsTotal - b.deltaVsTotal).slice(0, 6);
    const pick = [...top6, ...bot6];
    return pick.map((r) => ({
      name: r.sku ? `${r.klant} • ${r.sku}` : r.klant,
      growth: Math.round((r.growthPct || 0) * 1000) / 1000,
      delta: Math.round((r.deltaVsTotal || 0) * 1000) / 1000,
      revenue: (r as any).revenue,
    }));
  }, [latest]);

  // ======== Trend per klant (Units, 1 filter logica) ========
  // effectiveTrendPartner: als precies 1 partner in hoofdfilter → die; anders → handmatige selectie
  const effectiveTrendPartner = useMemo(() => {
    if (partnersSel.size === 1) return Array.from(partnersSel)[0];
    return trendPartnerManual || "";
  }, [partnersSel, trendPartnerManual]);

  const trendOptions = partners; // voor handmatige selectie wanneer nodig

  const trendData = useMemo(() => {
    if (!effectiveTrendPartner || !periodRows.length) return [];
    // filter op gekozen partner + huidige SKU-filter
    const predForTrend = makeFilter(new Set([effectiveTrendPartner]), skusSel);
    const rows = periodRows.filter(r => predForTrend(r));
    const periods = unique(rows.map(r => r.period)).sort((a, b) => a.localeCompare(b));
    return periods.map(p => {
      const inP = rows.filter(r => r.period === p);
      return {
        period: p,
        units: inP.reduce((a, r) => a + (r.units || 0), 0),
      };
    });
  }, [effectiveTrendPartner, periodRows, skusSel]);

  const lastLabel = last || kAll.latestPeriod || "laatste";
  const prevLabel = prev || "vorige";

  const clearFilters = () => { setPartnersSel(new Set()); setSkusSel(new Set()); setTrendPartnerManual(""); };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <section className="rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-base font-semibold">Filter</h3>
          <div className="flex items-center gap-2 text-xs">
            {partnersSel.size > 0 && <Chip label={`${partnersSel.size} partner(s)`} onClear={() => setPartnersSel(new Set())} />}
            {skusSel.size > 0 && <Chip label={`${skusSel.size} SKU(s)`} onClear={() => setSkusSel(new Set())} />}
            <button onClick={clearFilters} className="rounded border px-2 py-1 hover:bg-gray-50">Wis alles</button>
          </div>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <MultiSelect label="Contractpartners" options={partners} value={partnersSel} onChange={(s) => { setPartnersSel(s); /* reset manual trend als exact 1 partner */ if (s.size === 1) setTrendPartnerManual(""); }} />
          <MultiSelect label="SKU’s" options={skuOptions} value={skusSel} onChange={setSkusSel} />
        </div>
        {periodRows.length > 0 ? (
          <p className="mt-2 text-[11px] text-gray-500">
            KPI’s & grafieken volgen de subset. Periodevergelijking: <b>{lastLabel}</b> vs <b>{prevLabel}</b>.
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-amber-700">Geen periodedata gevonden; trend en precieze unit-tellingen per periode zijn beperkt.</p>
        )}
      </section>

      {/* KPI’s (subset) */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title={`Omzet (${lastLabel})`}
          main={eur0(totals.curRevenue)}
          sub={`vs ${prevLabel}: ${eur0(totals.prevRevenue)}`}
        />
        <Kpi
          title="Groei t.o.v. vorige"
          main={pct(k.totalGrowthPct)}
          sub={`Units: ${totals.curUnits.toLocaleString("nl-NL")} vs ${totals.prevUnits.toLocaleString("nl-NL")} (${pct(unitGrowthPct)})`}
          tone={k.totalGrowthPct >= 0 ? "up" : "down"}
        />
        <Kpi
          title="Aandeel top-5"
          main={pct(k.topSharePct)}
          sub="Top-5 in omzet (subset)"
        />
        <Kpi
          title="# contracts (subset)"
          main={String(latest.length)}
          sub="Laatste vs vorige periode"
        />
      </section>

      {/* Bar-chart: delta vs totaal-groei (subset) */}
      <section className="rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Top & underperformers — groei vs. totaal</h3>
          <div className="text-xs text-gray-600">Referentie (subset) = {pct(k.totalGrowthPct)}</div>
        </div>
        <div className="mt-3" style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer>
            <BarChart data={bars} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" hide />
              <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip formatter={(v: any, n: any) => (n === "growth" || n === "delta" ? pct(v as number) : eur0(v as number))} />
              <ReferenceLine y={k.totalGrowthPct} stroke="#0ea5e9" strokeDasharray="4 4" />
              <Bar dataKey="growth" fill="#0ea5e9">
                <LabelList dataKey="name" position="insideTop" className="text-[10px] fill-white" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-gray-600">Balk = groei per contract/SKU (subset); blauwe lijn = subset-totaal.</p>
        </div>
      </section>

      {/* Trend per klant (Units, 1-filter logica) */}
      <section className="rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-base font-semibold">Trend per klant — Units</h3>
          {partnersSel.size === 1 ? (
            <div className="text-xs text-gray-600">
              Gebruikt partnerfilter: <b>{Array.from(partnersSel)[0]}</b>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <select
                value={trendPartnerManual}
                onChange={(e) => setTrendPartnerManual(e.target.value)}
                className="rounded-lg border px-3 py-1.5"
              >
                <option value="">— kies klant —</option>
                {trendOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>

        {effectiveTrendPartner && trendData.length > 0 ? (
          <div className="mt-3" style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <RLineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(v) => String(v)} />
                <Tooltip formatter={(v: any) => Number(v).toLocaleString("nl-NL")} />
                <Legend />
                <Line type="monotone" dataKey="units" name="Units" stroke="#0ea5e9" dot />
              </RLineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-gray-600">
              Trendlijn voor <b>{effectiveTrendPartner}</b> (respecteert huidige SKU-selectie).
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-600">
            {partnersSel.size === 1
              ? "Geen periodedata of units voor deze klant."
              : "Kies 1 partner in het filter of selecteer een klant hierboven."}
          </p>
        )}
      </section>

      {/* Lijsten top/bottom (subset) */}
      <section className="grid gap-4 lg:grid-cols-2">
        <CardList title="Top 5 — boven benchmark (subset)" items={top.map(toActionRow("top"))} />
        <CardList title="Bottom 5 — onder benchmark (subset)" items={bottom.map(toActionRow("bottom"))} />
      </section>
    </div>
  );
}

/* ================= presentatielagen ================= */
function Kpi({
  title,
  main,
  sub,
  tone,
}: {
  title: string;
  main: string;
  sub?: string;
  tone?: "up" | "down";
}) {
  const toneClass = tone === "up" ? "text-emerald-700" : tone === "down" ? "text-rose-700" : "text-gray-900";
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>
      <div className={`text-lg font-semibold mt-1 ${toneClass}`}>{main}</div>
      {sub ? <div className="text-[11px] text-gray-500 mt-1">{sub}</div> : null}
    </div>
  );
}

function toActionRow(kind: "top" | "bottom") {
  return (r: LatestPerf) => {
    const name = r.sku ? `${r.klant} • ${r.sku}` : r.klant;
    const action =
      kind === "top"
        ? "Bestendigen: bonus aan realisatie koppelen; uitbreiden naar lookalikes."
        : "Interventie: heronderhandel (front→bonus), prijs/pack of kanaalcondities herijken.";
    return {
      title: name,
      right: eur0((r as any).revenue),
      lines: [`Groei: ${pct((r as any).growthPct)} • Δ vs totaal: ${pct((r as any).deltaVsTotal)}`],
      action,
    };
  };
}

function CardList({
  title,
  items,
}: {
  title: string;
  items: { title: string; right: string; lines: string[]; action: string }[];
}) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <ul className="space-y-2 text-sm">
        {items.map((it) => (
          <li key={it.title} className="border rounded-xl p-3 hover:shadow-sm transition">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium truncate">{it.title}</div>
              <div className="text-gray-700 shrink-0">{it.right}</div>
            </div>
            <div className="mt-1 text-gray-600">{it.lines.join(" • ")}</div>
            <div className="mt-2 text-gray-700">
              <span className="font-medium">Actie:</span> {it.action}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
