// lib/contract-analysis.ts
import { monthToQuarter, normalizePeriodFlexible, type NormPeriod } from "./contract-time";

export type ContractLevel = "klant_sku" | "klant";
export type Row = {
  klant: string;
  sku: string;
  aantal_units: number;
  claimbedrag: number;
  omzet: number;
  periode: string; // mag MM-YYYY / YYYY-MM / Qn-YYYY / YYYY-Qn
};

export type AggRow = {
  key: string;         // aggregatiesleutel
  klant: string;
  sku?: string;
  periodKey: string;   // canonical (YYYY-MM of YYYY-Qn)
  periodLabel: string; // mooi label
  revenue: number;
  units: number;
  claim: number;
};

export type TotalRow = {
  periodKey: string;
  periodLabel: string;
  revenue: number;
  units: number;
  claim: number;
};

export type LatestPerf = {
  key: string;
  klant: string;
  sku?: string;
  periodKey: string;
  revenue: number;
  growthPct: number;       // vs vorige periode
  deltaVsTotal: number;    // growthPct - totalGrowthPct
};

export type AnalyzeResult = {
  agg: AggRow[];
  totals: TotalRow[];
  latest: LatestPerf[];
  kpis: {
    latestPeriod: string;
    totalRevenue: number;
    totalGrowthPct: number;
    topSharePct: number; // aandeel top-5 contracts in omzet
  };
};

type CanonRow = Row & { norm: NormPeriod };

function compactSum<T>(arr: T[], sel: (t: T) => number) {
  return arr.reduce((a, t) => a + (Number.isFinite(sel(t)) ? sel(t) : 0), 0);
}

/** Normaliseer + filter (periode, getallen) */
function normalizeRows(rows: Row[]): CanonRow[] {
  const out: CanonRow[] = [];
  for (const r of rows) {
    const normP = normalizePeriodFlexible(r.periode);
    if (!normP) continue;
    const rev = Number.isFinite(r.omzet) ? r.omzet : 0;
    const units = Number.isFinite(r.aantal_units) ? r.aantal_units : 0;
    const claim = Number.isFinite(r.claimbedrag) ? r.claimbedrag : 0;
    out.push({ ...r, omzet: rev, aantal_units: units, claimbedrag: claim, norm: normP });
  }
  return out;
}

/** Indien mix van maanden en kwartalen: aggregeer maanden → kwartalen. */
function coerceToUniformPeriod(rows: CanonRow[]): { kind: "M" | "Q"; rows: CanonRow[] } {
  const hasM = rows.some((r) => r.norm.kind === "M");
  const hasQ = rows.some((r) => r.norm.kind === "Q");
  if (hasM && hasQ) {
    // map alle maanden naar kwartalen
    const map = new Map<string, CanonRow[]>();
    for (const r of rows) {
      const k = r.norm.kind === "M" ? monthToQuarter(r.norm.key) : r.norm.key;
      const key = `${r.klant}||${r.sku}||${k}`;
      const cur = map.get(key) || [];
      cur.push(r);
      map.set(key, cur);
    }
    const mixed: CanonRow[] = [];
    for (const list of map.values()) {
      const first = list[0];
      const yyyyQ = first.norm.kind === "M" ? monthToQuarter(first.norm.key) : first.norm.key;
      const [yyyy, qS] = yyyyQ.split("-Q");
      const norm: NormPeriod = {
        kind: "Q",
        key: yyyyQ,
        label: `Q${qS}-${yyyy}`,
        sortKey: Number(yyyy) * 10 + Number(qS),
      };
      mixed.push({
        ...first,
        norm,
        omzet: compactSum(list, (x) => x.omzet),
        aantal_units: compactSum(list, (x) => x.aantal_units),
        claimbedrag: compactSum(list, (x) => x.claimbedrag),
      });
    }
    return { kind: "Q", rows: mixed };
  }
  return { kind: hasQ ? "Q" : "M", rows };
}

export function analyze(rows: Row[], level: ContractLevel): AnalyzeResult {
  // 1) normaliseer input
  const canon0 = normalizeRows(rows);
  const { kind, rows: canon } = coerceToUniformPeriod(canon0);

  // 2) aggregatie per key x period
  const keyOf = (r: CanonRow) => (level === "klant" ? r.klant : `${r.klant} • ${r.sku}`);
  type Acc = { revenue: number; units: number; claim: number; klant: string; sku?: string; period: NormPeriod };
  const aggMap = new Map<string, Acc>();
  for (const r of canon) {
    const K = `${keyOf(r)}||${r.norm.key}`;
    const cur = aggMap.get(K) || { revenue: 0, units: 0, claim: 0, klant: r.klant, sku: level === "klant_sku" ? r.sku : undefined, period: r.norm };
    cur.revenue += r.omzet;
    cur.units += r.aantal_units;
    cur.claim += r.claimbedrag;
    aggMap.set(K, cur);
  }
  const agg: AggRow[] = [...aggMap.values()].map((a) => ({
    key: a.sku ? `${a.klant} • ${a.sku}` : a.klant,
    klant: a.klant,
    sku: a.sku,
    periodKey: a.period.key,
    periodLabel: a.period.label,
    revenue: a.revenue,
    units: a.units,
    claim: a.claim,
  }));

  // 3) totals per period
  const totalsMap = new Map<string, { revenue: number; units: number; claim: number; period: NormPeriod }>();
  for (const a of agg) {
    const per = canon.find((r) => r.norm.key === a.periodKey)?.norm!;
    const t = totalsMap.get(a.periodKey) || { revenue: 0, units: 0, claim: 0, period: per };
    t.revenue += a.revenue; t.units += a.units; t.claim += a.claim;
    totalsMap.set(a.periodKey, t);
  }
  const totals: TotalRow[] = [...totalsMap.values()]
    .sort((a, b) => a.period.sortKey - b.period.sortKey)
    .map((t) => ({ periodKey: t.period.key, periodLabel: t.period.label, revenue: t.revenue, units: t.units, claim: t.claim }));

  if (totals.length < 2) {
    // te weinig periodes om groei te tonen
    return {
      agg,
      totals,
      latest: [],
      kpis: {
        latestPeriod: totals[0]?.periodLabel ?? (kind === "Q" ? "Q?-YYYY" : "MM-YYYY"),
        totalRevenue: totals[0]?.revenue ?? 0,
        totalGrowthPct: 0,
        topSharePct: 0,
      },
    };
  }

  // 4) groei huidige vs vorige periode
  const last = totals[totals.length - 1];
  const prev = totals[totals.length - 2];
  const totalGrowthPct = prev.revenue ? (last.revenue - prev.revenue) / prev.revenue : 0;

  // groei per contract (alleen entries die in last/prev bestaan)
  const byKeyPer = new Map<string, Map<string, AggRow>>();
  for (const a of agg) {
    const m = byKeyPer.get(a.key) || new Map<string, AggRow>();
    m.set(a.periodKey, a);
    byKeyPer.set(a.key, m);
  }

  const latest: LatestPerf[] = [];
  for (const [k, m] of byKeyPer) {
    const aLast = m.get(last.periodKey);
    const aPrev = m.get(prev.periodKey);
    if (!aLast || !aPrev) continue; // geen vergelijk
    const g = aPrev.revenue ? (aLast.revenue - aPrev.revenue) / aPrev.revenue : 0;
    latest.push({
      key: k,
      klant: aLast.klant,
      sku: aLast.sku,
      periodKey: aLast.periodKey,
      revenue: aLast.revenue,
      growthPct: g,
      deltaVsTotal: g - totalGrowthPct,
    });
  }

  // KPI’s
  const sortedByRev = [...latest].sort((a, b) => b.revenue - a.revenue);
  const top5Rev = sortedByRev.slice(0, 5).reduce((s, r) => s + r.revenue, 0);
  const topSharePct = last.revenue ? top5Rev / last.revenue : 0;

  return {
    agg,
    totals,
    latest,
    kpis: {
      latestPeriod: last.periodLabel,
      totalRevenue: last.revenue,
      totalGrowthPct,
      topSharePct,
    },
  };
}
