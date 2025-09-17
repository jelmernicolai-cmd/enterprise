"use client";

import React, { useMemo, useState, useCallback } from "react";

/** ============ Helpers & formatters ============ */
const eur = (n: number, d = 0) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: d }).format(Number.isFinite(n) ? n : 0);
const fmt = (n: number, d = 0) => new Intl.NumberFormat("nl-NL", { maximumFractionDigits: d }).format(Number.isFinite(n) ? n : 0);
const pctS = (p: number, d = 1) => `${((Number.isFinite(p) ? p : 0) * 100).toFixed(d)}%`;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** ============ Types ============ */
type RawRow = { sku: string; period: string; inmarket_units: number; }; // period: MM-YYYY
type SeriesPoint = { t: string; y: number; bd: number; x: Date };       // bd=werkdagen in maand

type ForecastPoint = {
  t: string; x: Date; p50: number; // point forecast
  p10: number; p90: number;        // simpele baan (±) als interval
};

type SKUForecast = {
  sku: string;
  hist: SeriesPoint[];
  fc: ForecastPoint[];
  metrics: { MAPE: number; MAE: number; Bias: number; WAPE: number };
};

type AllocationRow = { customer: string; share: number; allocUnits: number; min?: number; max?: number };

type UploadResult = {
  rows: RawRow[];
  issues: string[];
  skus: string[];
};

/** ============ CSV/XLSX parsing (client-side) ============ */
async function parseFile(file: File): Promise<UploadResult> {
  const ext = (file.name.toLowerCase().split(".").pop() || "").trim();
  let rows: any[] = [];
  if (ext === "xlsx" || ext === "xls") {
    const XLSX: any = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  } else if (ext === "csv") {
    const text = await file.text();
    rows = csvToJson(text);
  } else {
    throw new Error("Ondersteunde formaten: .xlsx, .xls, .csv");
  }

  const issues: string[] = [];
  const out: RawRow[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const sku = (r.sku ?? r.SKU ?? r.product ?? r.Product ?? "").toString().trim();
    const period = (r.period ?? r.Period ?? r.month ?? r.Month ?? "").toString().trim();
    const units = toNum(r.inmarket_units ?? r.units ?? r.InMarket ?? r.Inmarket ?? r.quantity ?? 0);

    if (!sku) { issues.push("Rij met lege SKU overgeslagen."); continue; }
    const norm = normalizePeriod(period);
    if (!norm.ok) { issues.push(`Ongeldige periode: "${period}" (verwacht MM-YYYY of YYYY-MM)`); continue; }

    const key = `${sku}::${norm.value}`;
    if (seen.has(key)) issues.push(`Dubbele rij: ${key} (laatste telt)`);
    seen.add(key);

    out.push({ sku, period: norm.value, inmarket_units: Math.round(units) });
  }

  const skus = Array.from(new Set(out.map(r => r.sku))).sort();
  return { rows: out, issues, skus };
}

function csvToJson(text: string): any[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim().length > 0);
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0], detectDelim(lines[0]));
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], detectDelim(lines[0]));
    const obj: any = {};
    headers.forEach((h, idx) => obj[h] = cols[idx] ?? "");
    rows.push(obj);
  }
  return rows;
}
function detectDelim(header: string) {
  const c = { ";": (header.match(/;/g) || []).length, ",": (header.match(/,/g) || []).length, "\t": (header.match(/\t/g) || []).length };
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
}
function splitCSVLine(line: string, delim: string) {
  const out: string[] = []; let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === delim && !inQ) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur); return out;
}
function toNum(v: any) {
  if (typeof v === "number") return v;
  const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
function normalizePeriod(s: string): { ok: boolean; value: string } {
  // accepts "MM-YYYY" or "YYYY-MM" and normalizes to "MM-YYYY"
  const a = s.trim();
  const m1 = /^(\d{2})-(\d{4})$/.exec(a);
  const m2 = /^(\d{4})-(\d{2})$/.exec(a);
  if (m1) return { ok: true, value: `${m1[1]}-${m1[2]}` };
  if (m2) return { ok: true, value: `${m2[2]}-${m2[1]}` };
  return { ok: false, value: s };
}

/** ============ Kalender/werkdagen ============ */
function workingDaysInMonth(year: number, month0: number, extraClosedDays: number) {
  // month0: 0..11. Excl. weekends; user-provided extraClosedDays per maand.
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  let wd = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month0, d).getDay(); // 0=Sun..6=Sat
    if (dow >= 1 && dow <= 5) wd++;
  }
  wd = Math.max(0, wd - Math.max(0, extraClosedDays || 0));
  return wd;
}
function parseMMYYYY(mmYYYY: string): Date {
  const [mm, yyyy] = mmYYYY.split("-").map(Number);
  return new Date(yyyy, mm - 1, 1);
}
function fmtMMYYYY(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${mm}-${d.getFullYear()}`;
}

/** ============ Holt-Winters ETS (additief, s=12) (compact) ============ */
function holtWintersAdditive(y: number[], seasonLen = 12, alpha = 0.4, beta = 0.2, gamma = 0.2, horizon = 6) {
  const n = y.length;
  if (n < seasonLen * 2) return null; // niet genoeg data
  // init
  const seasonAvg: number[] = [];
  for (let i = 0; i < seasonLen; i++) {
    let s = 0, count = 0;
    for (let k = i; k < n; k += seasonLen) { s += y[k]; count++; }
    seasonAvg[i] = count ? s / count : 0;
  }
  const L0 = y.slice(0, seasonLen).reduce((a, b) => a + b, 0) / seasonLen;
  const T0 = (y.slice(seasonLen, seasonLen * 2).reduce((a, b) => a + b, 0) / seasonLen - L0) / seasonLen;

  const L: number[] = []; const T: number[] = []; const S: number[] = Array(seasonLen).fill(0).map((_, i) => seasonAvg[i] - L0);

  L[seasonLen - 1] = L0; T[seasonLen - 1] = T0;
  const fitted: number[] = [];

  for (let t = seasonLen; t < n; t++) {
    const i = (t - seasonLen) % seasonLen;
    const prevL = L[t - 1] ?? L0;
    const prevT = T[t - 1] ?? T0;
    const prevS = S[i];

    const Lt = alpha * (y[t] - prevS) + (1 - alpha) * (prevL + prevT);
    const Tt = beta * (Lt - prevL) + (1 - beta) * prevT;
    const St = gamma * (y[t] - Lt) + (1 - gamma) * prevS;

    L[t] = Lt; T[t] = Tt; S[i] = St;
    fitted[t] = Lt + Tt + S[i];
  }

  const fc: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const i = (n - seasonLen + h - 1) % seasonLen;
    fc.push((L[n - 1] ?? L0) + (T[n - 1] ?? T0) * h + S[i]);
  }
  return { fitted, forecast: fc };
}

/** ============ Forecast pipeline ============ */
function buildSeries(raw: RawRow[], extraClosedDays: Record<string, number>): SeriesPoint[] {
  // completeer gaten met 0; compute working days
  if (raw.length === 0) return [];
  const byPeriod = new Map<string, number>();
  let minD = parseMMYYYY(raw[0].period), maxD = parseMMYYYY(raw[0].period);
  raw.forEach(r => {
    const d = parseMMYYYY(r.period);
    if (d < minD) minD = d;
    if (d > maxD) maxD = d;
    byPeriod.set(r.period, (byPeriod.get(r.period) || 0) + (r.inmarket_units || 0));
  });

  const out: SeriesPoint[] = [];
  for (let d = new Date(minD); d <= maxD; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const t = fmtMMYYYY(d);
    const y = byPeriod.get(t) || 0;
    const extra = extraClosedDays[t] || 0;
    const bd = workingDaysInMonth(d.getFullYear(), d.getMonth(), extra);
    out.push({ t, y, bd, x: new Date(d) });
  }
  return out;
}
function daysAdjusted(series: SeriesPoint[]) {
  // scale to per-workday, then normalize back to average WD for stability
  const wdAvg = series.reduce((a, r) => a + r.bd, 0) / (series.length || 1);
  return series.map(r => ({ ...r, yAdj: r.bd > 0 ? (r.y / r.bd) * wdAvg : r.y, wdAvg }));
}

function backtestOneStep(seriesAdj: { yAdj: number; t: string }[], horizon = 12) {
  // rolling origin one-step-ahead (laatste 'horizon' maanden)
  const n = seriesAdj.length;
  const start = Math.max(12, n - horizon); // beginpunt zodat we genoeg data hebben
  let absErr = 0, absAct = 0, signedPctSum = 0, cnt = 0, absErrSum = 0;

  for (let i = start; i < n; i++) {
    const hist = seriesAdj.slice(0, i).map(s => s.yAdj);
    let fc1 = NaN;
    if (hist.length >= 24) {
      const hw = holtWintersAdditive(hist, 12, 0.4, 0.2, 0.2, 1);
      fc1 = hw?.forecast?.[0] ?? hist[hist.length - 12] ?? hist[hist.length - 1];
    } else if (hist.length >= 12) {
      fc1 = hist[hist.length - 12]; // seasonal naïef
    } else {
      fc1 = hist[hist.length - 1]; // naïef
    }

    const act = seriesAdj[i].yAdj;
    const err = act - fc1;
    absErr += Math.abs(err);
    absAct += Math.abs(act);
    signedPctSum += (act === 0 ? 0 : (err / act));
    absErrSum += Math.abs(err);
    cnt++;
  }

  const MAE = cnt ? absErr / cnt : 0;
  const MAPE = absAct ? absErr / absAct : 0;
  const Bias = cnt ? signedPctSum / cnt : 0;
  const WAPE = absAct ? absErrSum / absAct : 0;

  return { MAE, MAPE, Bias, WAPE };
}

function forecastSKU(hist: SeriesPoint[], monthsFwd: number, extraClosedDays: Record<string, number>, exoPctByMonth: Record<string, number>): SKUForecast {
  const sAdj = daysAdjusted(hist);
  const y = sAdj.map(s => s.yAdj);

  // backtest metrics
  const metrics = backtestOneStep(sAdj.map(s => ({ t: s.t, yAdj: s.yAdj })), Math.min(12, Math.max(6, Math.floor(y.length / 3))));

  // core forecast
  let fcCore: number[] = [];
  if (y.length >= 24) {
    const hw = holtWintersAdditive(y, 12, 0.4, 0.2, 0.2, monthsFwd);
    fcCore = hw?.forecast ?? [];
  } else if (y.length >= 12) {
    for (let h = 1; h <= monthsFwd; h++) fcCore.push(y[y.length - 12 + ((h - 1) % 12)]);
  } else {
    const last = y[y.length - 1] ?? 0;
    fcCore = Array.from({ length: monthsFwd }, () => last);
  }

  // rebuild future timeline + re-scale by working days of future months
  const lastDate = hist[hist.length - 1].x;
  const fc: ForecastPoint[] = [];
  for (let h = 1; h <= monthsFwd; h++) {
    const d = new Date(lastDate.getFullYear(), lastDate.getMonth() + h, 1);
    const t = fmtMMYYYY(d);
    const extra = extraClosedDays[t] || 0;
    const wd = workingDaysInMonth(d.getFullYear(), d.getMonth(), extra);
    const wdAvg = sAdj[0]?.wdAvg ?? 21;
    const base = fcCore[h - 1] ?? 0;
    let p50 = wd > 0 ? Math.max(0, Math.round(base * (wd / wdAvg))) : Math.max(0, Math.round(base));

    // apply exogenous monthly impact (±%)
    const exo = exoPctByMonth[t] ?? 0;
    p50 = Math.max(0, Math.round(p50 * (1 + exo)));

    // simple interval band: ±(MAPE of 15%) of p50
    const band = Math.max(0.15, metrics.MAPE || 0.15);
    const p10 = Math.max(0, Math.round(p50 * (1 - band)));
    const p90 = Math.max(0, Math.round(p50 * (1 + band)));

    fc.push({ t, x: d, p50, p10, p90 });
  }

  return {
    sku: hist[0]?.t ? "" : "", // niet nodig nu
    hist,
    fc,
    metrics,
  };
}

/** ============ UI: kleine bouwstenen ============ */
function FieldNumber({
  label, value, onChange, step = 1, min, max, suffix,
}: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <label className="text-sm w-full">
      <div className="font-medium">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step} min={min} max={max}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full rounded-lg border px-3 py-2"
        />
        {suffix ? <span className="text-gray-500">{suffix}</span> : null}
      </div>
    </label>
  );
}
function FieldPct({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-sm w-full">
      <div className="font-medium">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <input type="range" min={-0.5} max={0.5} step={0.01} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
               className="w-36 sm:w-44" />
        <input type="number" min={-0.5} max={0.5} step={0.01} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
               className="w-24 rounded-lg border px-3 py-2" />
        <span className="text-gray-500">{pctS(value)}</span>
      </div>
    </label>
  );
}
function Kpi({ title, value, help }: { title: string; value: string; help?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-3 sm:p-4">
      <div className="text-[12px] text-gray-600">{title}</div>
      <div className="text-lg sm:text-xl font-semibold mt-1">{value}</div>
      {help ? <div className="text-[11px] sm:text-xs text-gray-500 mt-1">{help}</div> : null}
    </div>
  );
}

/** ============ Export helpers ============ */
function downloadCSV(name: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(c => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** ============ Page ============ */
export default function SupplyChainOptimizationPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadResult | null>(null);

  // Controls
  const [monthsFwd, setMonthsFwd] = useState(6);
  const [selectedSKU, setSelectedSKU] = useState<string | null>(null);

  // Werkdagen-correctie: extra sluitdagen per maand (optioneel)
  const [extraClosedDays, setExtraClosedDays] = useState<Record<string, number>>({}); // { "01-2025": 1, ... }

  // Exogene impact per maand (±%)
  const [exoImpact, setExoImpact] = useState<Record<string, number>>({}); // { "02-2025": -0.10, ... }

  // Allocatie-instellingen
  const defaultCustomers = Array.from({ length: 10 }, (_, i) => `Klant ${String.fromCharCode(65 + i)}`);
  const [customers, setCustomers] = useState<string[]>(defaultCustomers);
  const [shares, setShares] = useState<number[]>([20, 15, 12, 10, 9, 8, 8, 7, 6, 5]); // som = 100
  const [caseSize, setCaseSize] = useState<number | null>(null);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  }, []);
  const handleBrowse = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
    e.currentTarget.value = "";
  };
  async function handleFile(file: File) {
    setBusy(true); setErr(null); setUpload(null);
    try {
      const parsed = await parseFile(file);
      if (parsed.skus.length === 0) throw new Error("Geen geldige rijen gevonden. Vereist: sku, period (MM-YYYY), inmarket_units.");
      setUpload(parsed);
      setSelectedSKU(parsed.skus[0]);
    } catch (e: any) {
      setErr(e?.message || "Upload mislukt");
    } finally {
      setBusy(false);
    }
  }

  // Build per-SKU series
  const seriesBySKU = useMemo(() => {
    if (!upload) return new Map<string, SeriesPoint[]>();
    const map = new Map<string, SeriesPoint[]>();
    for (const sku of upload.skus) {
      const rows = upload.rows.filter(r => r.sku === sku).sort((a, b) => parseMMYYYY(a.period).getTime() - parseMMYYYY(b.period).getTime());
      const s = buildSeries(rows, extraClosedDays);
      map.set(sku, s);
    }
    return map;
  }, [upload, extraClosedDays]);

  // Forecasts per SKU
  const forecasts = useMemo(() => {
    const map = new Map<string, SKUForecast>();
    for (const [sku, hist] of seriesBySKU.entries()) {
      const fc = forecastSKU(hist, monthsFwd, extraClosedDays, exoImpact);
      map.set(sku, { ...fc, sku });
    }
    return map;
  }, [seriesBySKU, monthsFwd, extraClosedDays, exoImpact]);

  // Portfolio accuracy (gewogen WAPE)
  const portfolioAcc = useMemo(() => {
    if (!forecasts.size) return { WAPE: 0, MAPE: 0, MAE: 0, Bias: 0 };
    let num = 0, den = 0, mapeSum = 0, maeSum = 0, biasSum = 0, n = 0;
    for (const sk of forecasts.values()) {
      // benader totale historische vraag als gewicht
      const tot = sk.hist.reduce((a, r) => a + Math.abs(r.y), 0);
      num += sk.metrics.WAPE * tot;
      den += tot;
      mapeSum += sk.metrics.MAPE; maeSum += sk.metrics.MAE; biasSum += sk.metrics.Bias; n++;
    }
    return {
      WAPE: den ? num / den : 0,
      MAPE: n ? mapeSum / n : 0,
      MAE: n ? maeSum / n : 0,
      Bias: n ? biasSum / n : 0,
    };
  }, [forecasts]);

  // Helpers
  function totalShare() { return shares.reduce((a, b) => a + b, 0); }
  function normalizeShares() {
    const s = totalShare();
    if (s === 100) return;
    setShares(prev => prev.map(v => (v / s) * 100));
  }

  function allocForNextMonth(sku: string): { rows: AllocationRow[]; total: number } | null {
    const f = forecasts.get(sku);
    if (!f || f.fc.length === 0) return null;
    const next = f.fc[0].p50;
    let remain = next;
    const rows: AllocationRow[] = shares.map((sh, idx) => {
      const units = Math.max(0, Math.round((next * sh) / 100));
      remain -= units;
      return { customer: customers[idx], share: sh, allocUnits: units };
    });
    // verdeel rest (door afronding) top-down
    for (let i = 0; i < rows.length && remain > 0; i++) { rows[i].allocUnits += 1; remain--; }
    // afronden op case size indien gevraagd
    if (caseSize && caseSize > 1) {
      let sum = 0;
      for (const r of rows) {
        r.allocUnits = Math.round(r.allocUnits / caseSize) * caseSize;
        sum += r.allocUnits;
      }
      // pas totalen eventueel aan zodat som ≈ forecast (we laten afrondingsverschil staan, maar tonen waarschuwing)
      return { rows, total: sum };
    }
    return { rows, total: next };
  }

  function exportForecastCSV() {
    const rows: (string | number)[][] = [["sku", "period", "p10", "p50", "p90"]];
    for (const [sku, f] of forecasts.entries()) {
      for (const p of f.fc) rows.push([sku, p.t, p.p10, p.p50, p.p90]);
    }
    downloadCSV("forecast", rows);
  }
  function exportAllocationsCSV() {
    const rows: (string | number)[][] = [["sku", "period", "customer", "share_pct", "alloc_units"]];
    for (const [sku, f] of forecasts.entries()) {
      if (f.fc.length === 0) continue;
      const period = f.fc[0].t;
      const alloc = allocForNextMonth(sku);
      if (!alloc) continue;
      for (const r of alloc.rows) rows.push([sku, period, r.customer, r.share, r.allocUnits]);
    }
    downloadCSV("allocations", rows);
  }
  function exportIssuesCSV() {
    if (!upload) return;
    const rows: (string | number)[][] = [["issue"]];
    (upload.issues.length ? upload.issues : ["Geen issues."]).forEach(i => rows.push([i]));
    downloadCSV("issues", rows);
  }

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-4 lg:px-6 py-4 space-y-6">
      {/* Hero */}
      <header className="rounded-2xl border bg-white p-4 sm:p-5">
        <h1 className="text-xl sm:text-2xl font-semibold">Supply Chain Optimization — Forecast & Allocatie</h1>
        <p className="text-sm text-gray-700 mt-1">
          Upload maandelijkse <b>in-market</b> afzet (NL, per SKU), voorspel de komende maanden (seizoen & werkdagen-correctie),
          en verdeel <b>volgende maand</b> over 10 klanten op basis van <b>marktaandelen</b>. Alles draait <b>client-side</b> (geen PII, geen serverupload).
        </p>
      </header>

      {/* Upload */}
      <section
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={handleDrop}
        className="rounded-2xl border-2 border-dashed p-6 bg-white text-center"
      >
        <div className="text-sm text-gray-700">Sleep je Excel/CSV hierheen of</div>
        <label className="mt-2 inline-flex items-center gap-2 rounded-lg bg-sky-600 text-white text-sm px-4 py-2 hover:bg-sky-700 cursor-pointer">
          Bestand kiezen
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBrowse} disabled={busy} />
        </label>
        <p className="mt-2 text-xs text-gray-500">Kolommen: <code>sku</code>, <code>period</code> (MM-YYYY <i>of</i> YYYY-MM), <code>inmarket_units</code>.</p>
        {busy && <div className="mt-2 text-sm text-gray-600">Verwerken…</div>}
        {err && <div className="mt-3 inline-block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{err}</div>}
        {upload?.issues?.length ? (
          <div className="mt-3 text-left inline-block rounded-lg border p-3 text-sm">
            <div className="font-medium">Meldingen ({upload.issues.length})</div>
            <ul className="list-disc pl-5 mt-1">{upload.issues.slice(0, 10).map((m, i) => <li key={i}>{m}</li>)}</ul>
            <button className="mt-2 text-xs rounded border px-2 py-1 hover:bg-gray-50" onClick={exportIssuesCSV}>Exporteer alle issues (CSV)</button>
          </div>
        ) : null}
      </section>

      {/* Controls */}
      <section className="rounded-2xl border bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FieldNumber label="Horizon (maanden)" value={monthsFwd} min={1} max={18} step={1} onChange={(v) => setMonthsFwd(clamp(Math.round(v), 1, 18))} />
          <FieldNumber label="Case size (optioneel)" value={caseSize ?? 0} min={0} step={1}
            onChange={(v) => setCaseSize(v > 0 ? Math.round(v) : null)} />
          <div className="text-sm">
            <div className="font-medium">Totale forecast-accuracy (portfolio)</div>
            <div className="mt-1 text-gray-700">
              WAPE: <b>{pctS(1 - portfolioAcc.WAPE, 1)}</b> &nbsp;|&nbsp; MAPE: <b>{pctS(portfolioAcc.MAPE, 1)}</b> &nbsp;|&nbsp; Bias: <b>{pctS(portfolioAcc.Bias, 1)}</b>
            </div>
            <div className="text-xs text-gray-500 mt-1">Op basis van rolling one-step backtest per SKU, gewogen naar historische volumes.</div>
          </div>
        </div>
      </section>

      {/* Werkdagen & Exogene events */}
      <section className="rounded-2xl border bg-white p-4">
        <h3 className="text-base font-semibold mb-2">Kalender & exogene impact</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="text-sm font-medium mb-1">Extra gesloten dagen per maand (optioneel)</div>
            <p className="text-xs text-gray-600 mb-2">Wij tellen standaard alleen werkdagen (ma–vr). Voeg hier extra feest-/sluitdagen toe (bijv. 1 voor Pinksteren-maandag).</p>
            <MonthEditor values={extraClosedDays} onChange={setExtraClosedDays} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Exogene impact per maand (±%)</div>
            <p className="text-xs text-gray-600 mb-2">Bijv. tenderverlies −10% in 03-2025, campagne +5% in 06-2025. Past point forecast aan.</p>
            <MonthPctEditor values={exoImpact} onChange={setExoImpact} />
          </div>
        </div>
      </section>

      {/* SKU selector & metrics */}
      {upload && (
        <section className="rounded-2xl border bg-white p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm">
              <span className="font-medium">SKU</span><br/>
              <select className="mt-1 rounded-lg border px-3 py-2"
                      value={selectedSKU || ""}
                      onChange={(e) => setSelectedSKU(e.target.value)}>
                {upload.skus.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          {selectedSKU && (() => {
            const sk = forecasts.get(selectedSKU);
            if (!sk) return <div className="text-sm text-gray-600">Geen forecast voor deze SKU.</div>;

            const alloc = allocForNextMonth(selectedSKU);

            return (
              <>
                {/* KPI’s */}
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                  <Kpi title="Accuracy (SKU) — 1 − WAPE" value={pctS(1 - sk.metrics.WAPE, 1)} help={`MAPE: ${pctS(sk.metrics.MAPE,1)} | Bias: ${pctS(sk.metrics.Bias,1)}`} />
                  <Kpi title="Volgende maand — P50" value={fmt(sk.fc[0]?.p50 ?? 0)} help={`Band: ${fmt(sk.fc[0]?.p10 ?? 0)}–${fmt(sk.fc[0]?.p90 ?? 0)}`} />
                  <Kpi title="Historisch totaal" value={fmt(sk.hist.reduce((a, r) => a + r.y, 0))} />
                  <Kpi title="Werkdagen (gemiddeld)" value={fmt(sk.hist.reduce((a, r) => a + r.bd, 0) / (sk.hist.length || 1), 1)} />
                </div>

                {/* Grafiek (simpel SVG) */}
                <div className="rounded-2xl border bg-white p-4">
                  <h4 className="text-sm font-semibold mb-2">Historie & Forecast — {selectedSKU}</h4>
                  <SimpleLine name="Historie" color="#0ea5e9" xs={[...sk.hist.map(h => h.t), ...sk.fc.map(f => f.t)]} ys={sk.hist.map(h => h.y)} />
                  <div className="mt-2" />
                  <SimpleLine name="Forecast (P50)" color="#22c55e" xs={sk.fc.map(f => f.t)} ys={sk.fc.map(f => f.p50)} />
                </div>

                {/* Allocatie klanten */}
                <div className="rounded-2xl border bg-white p-4">
                  <h4 className="text-sm font-semibold mb-3">Allocatie komende maand — {sk.fc[0]?.t}</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-xl border p-3">
                      <div className="text-sm font-medium mb-2">Klanten & marktaandelen (som = {fmt(totalShare(), 1)}%)</div>
                      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 120px" }}>
                        {customers.map((c, i) => (
                          <React.Fragment key={i}>
                            <input
                              value={c} onChange={(e) => {
                                const v = [...customers]; v[i] = e.target.value; setCustomers(v);
                              }}
                              className="rounded-lg border px-3 py-2 text-sm" />
                            <div className="flex items-center gap-2">
                              <input type="number" step={0.1} min={0} max={100}
                                     value={shares[i]}
                                     onChange={(e) => { const v = [...shares]; v[i] = clamp(parseFloat(e.target.value) || 0, 0, 100); setShares(v); }}
                                     className="w-24 rounded-lg border px-3 py-2 text-sm" />
                              <span className="text-xs text-gray-500">%</span>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button className="text-xs rounded border px-2 py-1 hover:bg-gray-50" onClick={normalizeShares}>Normaliseer → 100%</button>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">Tip: hou rekening met contractuele minima/maxima; zet caps via BI of contract module (later).</p>
                    </div>

                    <div className="rounded-xl border p-3">
                      {alloc ? (
                        <>
                          <div className="text-sm font-medium">Verdeling (afronding {caseSize && caseSize > 1 ? `op ${caseSize}` : "per stuk"})</div>
                          <table className="w-full text-sm mt-2 border-collapse">
                            <thead><tr className="border-b bg-gray-50">
                              <th className="text-left px-2 py-1">Klant</th>
                              <th className="text-right px-2 py-1">Share</th>
                              <th className="text-right px-2 py-1">Units</th>
                            </tr></thead>
                            <tbody>
                            {alloc.rows.map((r, i) => (
                              <tr key={i} className="border-b last:border-0">
                                <td className="px-2 py-1">{r.customer}</td>
                                <td className="px-2 py-1 text-right">{fmt(r.share, 1)}%</td>
                                <td className="px-2 py-1 text-right">{fmt(r.allocUnits)}</td>
                              </tr>
                            ))}
                            </tbody>
                          </table>
                          <div className="text-xs text-gray-600 mt-2">
                            Som allocaties: <b>{fmt(alloc.rows.reduce((a, r) => a + r.allocUnits, 0))}</b> &nbsp;|&nbsp; Forecast P50: <b>{fmt(forecasts.get(selectedSKU)?.fc[0]?.p50 ?? 0)}</b>
                            {caseSize && caseSize > 1 ? " (afrondingsverschil mogelijk door case rounding)" : ""}
                          </div>
                        </>
                      ) : <div className="text-sm text-gray-600">Geen allocatie berekend.</div>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <button className="text-sm rounded border px-3 py-1.5 hover:bg-gray-50" onClick={exportForecastCSV}>Exporteer Forecast (CSV)</button>
                    <button className="text-sm rounded border px-3 py-1.5 hover:bg-gray-50" onClick={exportAllocationsCSV}>Exporteer Allocaties (CSV)</button>
                  </div>
                </div>
              </>
            );
          })()}
        </section>
      )}

      {/* Footer note */}
      <section className="rounded-2xl border bg-white p-4">
        <div className="text-xs text-gray-600">
          <b>Definities</b>: in-market = door groothandel aan apotheken geleverde stuks (NL). PI buiten scope. SKU = interne productcode/naam.
          Forecast houdt rekening met seizoenseffecten (indien te herkennen) en werkdagen (ma–vr, plus optionele extra sluitdagen).
          Alle berekeningen draaien lokaal in je browser (geen PII/geen serverupload).
        </div>
      </section>
    </div>
  );
}

/** ============ Kleine sub-components ============ */
function SimpleLine({ name, color, xs, ys }: { name: string; color: string; xs: string[]; ys: number[] }) {
  // compact responsive SVG
  const w = 960, h = 220, padX = 48, padY = 26;
  const n = ys.length;
  const maxY = Math.max(1, ...ys);
  const minY = 0;
  const x = (i: number) => padX + (i / Math.max(1, n - 1)) * (w - 2 * padX);
  const y = (v: number) => h - padY - ((v - minY) / (maxY - minY)) * (h - 2 * padY);
  const ticks = Array.from({ length: 5 }, (_, i) => (maxY / 4) * i);
  const d = ys.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  return (
    <svg className="w-full h-auto" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={name} preserveAspectRatio="xMidYMid meet">
      <rect x={12} y={12} width={w - 24} height={h - 24} rx={16} fill="#fff" stroke="#e5e7eb" />
      {ticks.map((tv, i) => (
        <g key={i}>
          <line x1={padX} y1={y(tv)} x2={w - padX} y2={y(tv)} stroke="#f3f4f6" />
          <text x={padX - 8} y={y(tv) + 4} fontSize="10" textAnchor="end" fill="#6b7280">{fmt(tv)}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke={color} strokeWidth={2} />
      {ys.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2} fill={color} />)}
      <text x={w - padX} y={y(ys.at(-1) || 0) - 6} fontSize="10" textAnchor="end" fill={color}>{name}</text>
      {/* X labels (sparse) */}
      {xs.map((t, i) => i % Math.ceil(xs.length / 8) === 0 ? (
        <text key={i} x={x(i)} y={h - 6} fontSize="10" textAnchor="middle" fill="#6b7280">{t}</text>
      ) : null)}
    </svg>
  );
}

function MonthEditor({ values, onChange }: { values: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const [key, setKey] = useState("");
  const [val, setVal] = useState<number>(0);
  return (
    <div className="text-sm">
      <div className="flex items-end gap-2">
        <label className="w-40">
          <div className="font-medium">Maand (MM-YYYY)</div>
          <input value={key} onChange={(e) => setKey(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="03-2025" />
        </label>
        <label className="w-36">
          <div className="font-medium">Extra gesloten dagen</div>
          <input type="number" min={0} step={1} value={val} onChange={(e) => setVal(Math.max(0, Math.round(parseFloat(e.target.value) || 0)))}
                 className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <button
          className="rounded border px-3 py-2 hover:bg-gray-50"
          onClick={() => { if (/^\d{2}-\d{4}$/.test(key)) onChange({ ...values, [key]: val }); }}
        >
          Opslaan
        </button>
      </div>
      {Object.keys(values).length > 0 && (
        <div className="mt-3 rounded border p-2">
          <div className="text-xs text-gray-600 mb-1">Huidige uitzonderingen</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {Object.entries(values).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <div>{k}</div>
                <div className="flex items-center gap-2">
                  <div>{v}</div>
                  <button className="text-xs rounded border px-2 py-1 hover:bg-gray-50"
                          onClick={() => { const c = { ...values }; delete c[k]; onChange(c); }}>
                    Verwijder
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MonthPctEditor({ values, onChange }: { values: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const [key, setKey] = useState("");
  const [val, setVal] = useState<number>(0);
  return (
    <div className="text-sm">
      <div className="flex items-end gap-2">
        <label className="w-40">
          <div className="font-medium">Maand (MM-YYYY)</div>
          <input value={key} onChange={(e) => setKey(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="03-2025" />
        </label>
        <label className="w-36">
          <div className="font-medium">Impact (±%)</div>
          <input type="number" min={-50} max={50} step={0.5} value={val}
                 onChange={(e) => setVal(parseFloat(e.target.value) || 0)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <button
          className="rounded border px-3 py-2 hover:bg-gray-50"
          onClick={() => { if (/^\d{2}-\d{4}$/.test(key)) onChange({ ...values, [key]: clamp(val/100, -0.5, 0.5) }); }}
        >
          Opslaan
        </button>
      </div>
      {Object.keys(values).length > 0 && (
        <div className="mt-3 rounded border p-2">
          <div className="text-xs text-gray-600 mb-1">Huidige exogene aanpassingen</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {Object.entries(values).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <div>{k}</div>
                <div className="flex items-center gap-2">
                  <div>{pctS(v, 1)}</div>
                  <button className="text-xs rounded border px-2 py-1 hover:bg-gray-50"
                          onClick={() => { const c = { ...values }; delete c[k]; onChange(c); }}>
                    Verwijder
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
