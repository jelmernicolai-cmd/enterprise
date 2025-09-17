"use client";

import { useMemo, useState } from "react";

/** ===== Helpers ===== */
const eur = (n: number, d = 0) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: d, minimumFractionDigits: d })
    .format(Number.isFinite(n) ? n : 0);
const pctS = (p: number, d = 1) => `${((Number.isFinite(p) ? p : 0) * 100).toFixed(d)}%`;
const compact = (n: number) =>
  new Intl.NumberFormat("nl-NL", { notation: "compact", maximumFractionDigits: 1 })
    .format(Number.isFinite(n) ? n : 0);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** ===== Types ===== */
type Inputs = {
  listNL: number;         // €/unit (list)
  discount: number;       // 0..1 (koperprijs = list × (1 − discount))
  parallelRef: number;    // €/unit (parallel referentie)
  units: number;          // units/maand (NL)

  // Handmatig PI (optioneel)
  manualPI: boolean;
  manualPIEnd: number;    // 0..1 (eind-PI)
  manualPIRampM: number;  // maanden naar eindniveau
};

type Settings = {
  threshold: number;      // €/unit: gap-drempel voordat PI start
  slope: number;          // pp PI per € boven drempel
  cap: number;            // max PI-share
  rampMonths: number;     // PI ramp-in (gap-model)
  horizon: number;        // maanden
};

type Point = {
  t: number;
  netOriginatorPrice: number; // €/unit na discount
  gap: number;                // €/unit vs parallelRef
  sPI: number;                // PI-share
  sOriginator: number;        // 1 − sPI
  unitsOriginator: number;
  unitsPI: number;
  grossOriginator: number;    // unitsOriginator * list
  discountSpend: number;      // grossOriginator * discount
  netSalesOriginator: number; // gross − discount
  netSalesPI: number;         // unitsPI * parallelRef
};

type KPIs = {
  netY1: number;        // originator net sales (jaar 1)
  discY1: number;       // discount spend (jaar 1)
  grossY1: number;      // gross sales (jaar 1)
  piY1: number;         // parallel omzet (jaar 1)
  endPIshare: number;
  endGap: number;
  endNetPrice: number;
};

type BreakEven = { discount: number; atLowerBound: boolean; atUpperBound: boolean };

/** ===== Defaults ===== */
const DEFAULTS_A: Inputs = {
  listNL: 100,
  discount: 0.22,
  parallelRef: 65,
  units: 9000,
  manualPI: false,
  manualPIEnd: 0.18,
  manualPIRampM: 3,
};
const DEFAULTS_B: Inputs = { ...DEFAULTS_A, discount: 0.27 };

const DEFAULT_CFG: Settings = {
  threshold: 2,
  slope: 0.06,
  cap: 0.35,
  rampMonths: 3,
  horizon: 24,
};

/** ===== PI-share generator ===== */
function piShare(gap: number, t: number, cfg: Settings, manual: { on: boolean; end: number; ramp: number }) {
  if (manual.on) {
    const ramp = Math.min(1, manual.ramp > 0 ? t / manual.ramp : 1);
    return clamp(manual.end * ramp, 0, cfg.cap);
  }
  if (gap <= cfg.threshold) return 0;
  const base = (gap - cfg.threshold) * cfg.slope;
  const ramp = Math.min(1, cfg.rampMonths > 0 ? t / cfg.rampMonths : 1);
  return clamp(base * ramp, 0, cfg.cap);
}

/** ===== Simulatie ===== */
function simulateScenario(inp: Inputs, cfg: Settings) {
  const pts: Point[] = [];
  const netPrice = inp.listNL * (1 - clamp(inp.discount, 0, 0.9)); // 0..90% guard

  for (let t = 0; t < cfg.horizon; t++) {
    const gap = netPrice - inp.parallelRef;
    const sPI = piShare(gap, t, cfg, {
      on: inp.manualPI,
      end: Math.min(inp.manualPIEnd, cfg.cap),
      ramp: inp.manualPIRampM,
    });
    const sOriginator = 1 - sPI;

    const unitsOriginator = Math.max(0, inp.units * sOriginator);
    const unitsPI = Math.max(0, inp.units * sPI);

    const grossOriginator = unitsOriginator * inp.listNL;
    const discountSpend = grossOriginator * clamp(inp.discount, 0, 0.9);
    const netSalesOriginator = grossOriginator - discountSpend;
    const netSalesPI = unitsPI * inp.parallelRef;

    pts.push({
      t, netOriginatorPrice: netPrice, gap, sPI, sOriginator,
      unitsOriginator, unitsPI, grossOriginator, discountSpend, netSalesOriginator, netSalesPI,
    });
  }

  const y1 = pts.slice(0, Math.min(12, pts.length));
  const sumY1 = (f: (p: Point) => number) => y1.reduce((a, p) => a + f(p), 0);
  const end = pts.at(-1)!;

  const kpis: KPIs = {
    netY1: sumY1((p) => p.netSalesOriginator),
    discY1: sumY1((p) => p.discountSpend),
    grossY1: sumY1((p) => p.grossOriginator),
    piY1: sumY1((p) => p.netSalesPI),
    endPIshare: end.sPI,
    endGap: end.gap,
    endNetPrice: end.netOriginatorPrice,
  };

  return { points: pts, kpis };
}

/** ===== Break-even over B, binnen 0..0.9 korting ===== */
function findBreakEvenDiscount(base: Inputs, cfg: Settings, targetNetY1: number): BreakEven {
  let best = clamp(base.discount, 0, 0.9);
  let bestAbs = Infinity;

  // sample sweep (robuust bij niet-monotone curves)
  for (let d = 0; d <= 0.900001; d += 0.002) {
    const sim = simulateScenario({ ...base, discount: d }, cfg);
    const abs = Math.abs(sim.kpis.netY1 - targetNetY1);
    if (abs < bestAbs) { bestAbs = abs; best = d; }
  }

  // boundary flags
  const atLowerBound = Math.abs(best - 0) < 1e-6;
  const atUpperBound = Math.abs(best - 0.9) < 1e-6;
  return { discount: best, atLowerBound, atUpperBound };
}

/** ===== Kleine UI ===== */
function FieldNumber({
  label, value, onChange, step = 1, min, max, suffix, help,
}: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; suffix?: string; help?: string;
}) {
  return (
    <label className="text-sm w-full">
      <div className="font-medium">{label}</div>
      {help ? <div className="text-xs text-gray-500">{help}</div> : null}
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : 0)}
          className="w-full rounded-lg border px-3 py-2"
        />
        {suffix ? <span className="text-gray-500">{suffix}</span> : null}
      </div>
    </label>
  );
}
function FieldPct({
  label, value, onChange, max = 1, help,
}: {
  label: string; value: number; onChange: (v: number) => void; max?: number; help?: string;
}) {
  const val = clamp(value ?? 0, 0, max);
  return (
    <label className="text-sm w-full">
      <div className="font-medium">{label}</div>
      {help ? <div className="text-xs text-gray-500">{help}</div> : null}
      <div className="mt-1 grid grid-cols-[1fr_auto_auto] items-center gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input
          type="range"
          min={0}
          max={max}
          step={0.005}
          value={val}
          onChange={(e) => onChange(clamp(parseFloat(e.target.value), 0, max))}
          className="w-full"
        />
        <input
          type="number"
          inputMode="decimal"
          step={0.01}
          min={0}
          max={max}
          value={val}
          onChange={(e) => onChange(clamp(parseFloat(e.target.value), 0, max))}
          className="w-24 rounded-lg border px-3 py-2"
          aria-label={`${label} numeriek`}
        />
        <span className="text-gray-500">{pctS(val)}</span>
      </div>
    </label>
  );
}
function Kpi({
  title, value, help, tone = "default", titleTooltip,
}: {
  title: string; value: string; help?: string; tone?: "default" | "good" | "warn" | "bad"; titleTooltip?: string;
}) {
  const color =
    tone === "good" ? "border-emerald-200 bg-emerald-50" :
    tone === "warn" ? "border-amber-200 bg-amber-50" :
    tone === "bad"  ? "border-rose-200 bg-rose-50" : "border-gray-200 bg-white";
  return (
    <div className={`rounded-2xl border ${color} p-3 sm:p-4`} title={titleTooltip}>
      <div className="text-[12px] text-gray-600">{title}</div>
      <div className="text-lg sm:text-xl font-semibold mt-1 break-words">{value}</div>
      {help ? <div className="text-[11px] sm:text-xs text-gray-600 mt-1">{help}</div> : null}
    </div>
  );
}
function LineChart({
  name, color = "#0ea5e9", values, yFmt = (v: number) => v.toFixed(0), height = 220, className,
}: {
  name: string; color?: string; values: number[]; yFmt?: (v: number) => string; height?: number; className?: string;
}) {
  const w = 960, h = height, padX = 46, padY = 28;
  const n = values.length || 1;
  const maxY = Math.max(1, ...values);
  const minY = 0;
  const x = (i: number) => padX + (i / Math.max(1, n - 1)) * (w - 2 * padX);
  const y = (v: number) => h - padY - ((v - minY) / (maxY - minY)) * (h - 2 * padY);
  const ticks = Array.from({ length: 5 }, (_, i) => (maxY / 4) * i);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  return (
    <svg className={className ?? "w-full h-auto"} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={name} preserveAspectRatio="xMidYMid meet">
      <rect x={12} y={12} width={w - 24} height={h - 24} rx={16} fill="#fff" stroke="#e5e7eb" />
      {ticks.map((tv, i) => (
        <g key={i}>
          <line x1={padX} y1={y(tv)} x2={w - padX} y2={y(tv)} stroke="#f3f4f6" />
          <text x={padX - 8} y={y(tv) + 4} fontSize="10" textAnchor="end" fill="#6b7280">
            {yFmt(tv)}
          </text>
        </g>
      ))}
      <path d={d} fill="none" stroke={color} strokeWidth={2} />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={2} fill={color}>
          <title>{`${name} • Maand ${i + 1}: ${yFmt(v)}`}</title>
        </circle>
      ))}
      <text x={w - padX} y={y(values.at(-1) || 0) - 6} fontSize="10" textAnchor="end" fill={color}>
        {name}
      </text>
    </svg>
  );
}

/** ===== Page ===== */
export default function ParallelOneDiscountNetOnly() {
  const [cfg, setCfg] = useState<Settings>({ ...DEFAULT_CFG });
  const [A, setA] = useState<Inputs>({ ...DEFAULTS_A });
  const [B, setB] = useState<Inputs>({ ...DEFAULTS_B });
  const [beMsg, setBeMsg] = useState<string>("");

  // Simulaties
  const simA = useMemo(() => simulateScenario(A, cfg), [A, cfg]);
  const simB = useMemo(() => simulateScenario(B, cfg), [B, cfg]);

  // Δ Jaar 1
  const deltas = useMemo(() => {
    const dNet = simB.kpis.netY1 - simA.kpis.netY1;
    const dDisc = simB.kpis.discY1 - simA.kpis.discY1;
    const dGross = simB.kpis.grossY1 - simA.kpis.grossY1;
    const dPI = simB.kpis.piY1 - simA.kpis.piY1;
    return { dNet, dDisc, dGross, dPI };
  }, [simA.kpis, simB.kpis]);

  // Snelle acties
  function copyAtoB() {
    setB({ ...A });
    setBeMsg("");
  }
  function setB_toGapThreshold() {
    const neededNet = B.parallelRef + cfg.threshold;
    const discountNeeded = 1 - neededNet / Math.max(1, B.listNL || 1); // guard
    const d = clamp(discountNeeded, 0, 0.9);
    setB(s => ({ ...s, discount: d, manualPI: false }));
    setBeMsg("");
  }
  function setB_toBreakEven() {
    const r = findBreakEvenDiscount(B, cfg, simA.kpis.netY1);
    const d = clamp(r.discount, 0, 0.9);
    setB(s => ({ ...s, discount: d, manualPI: false }));
    if (r.atLowerBound) {
      setBeMsg("Break-even niet haalbaar binnen 0–90% korting. Dichtstbij is 0%.");
    } else if (r.atUpperBound) {
      setBeMsg("Break-even niet haalbaar binnen 0–90% korting. Dichtstbij is 90%.");
    } else {
      setBeMsg(`Break-even gevonden op ~${pctS(d, 1)} korting voor B.`);
    }
  }
  function swapAB() {
    setA(B);
    setB(A);
    setBeMsg("");
  }
  function resetAll() {
    setA({ ...DEFAULTS_A });
    setB({ ...DEFAULTS_B });
    setCfg({ ...DEFAULT_CFG });
    setBeMsg("");
  }

  return (
    <main className="max-w-screen-xl mx-auto px-3 sm:px-4 lg:px-6 py-4 space-y-6">
      {/* Intro + compacte compare bar */}
      <header className="rounded-2xl border bg-white p-4 sm:p-5">
        <h1 className="text-xl sm:text-2xl font-semibold">Parallelimport: één korting, netto terugvloei</h1>
        <p className="text-sm text-gray-700 mt-1">
          We rekenen met <b>Netto = Bruto − Korting</b>. Minder PI stroomt <b>1-op-1</b> terug naar originator. Stel korting in (en evt. een handmatige PI-share), vergelijk <b>A vs B</b> en bereken de <b>break-even korting</b> voor B.
        </p>

        {/* Compacte eindstatus A/B */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500 mb-1">Scenario A — Huidig</div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>Gap: <b>{eur(simA.kpis.endGap, 0)}</b></span>
              <span>PI: <b>{pctS(simA.kpis.endPIshare)}</b></span>
              <span>Net prijs: <b>{eur(simA.kpis.endNetPrice, 0)}</b></span>
            </div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500 mb-1">Scenario B — Voorstel</div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>Gap: <b>{eur(simB.kpis.endGap, 0)}</b></span>
              <span>PI: <b>{pctS(simB.kpis.endPIshare)}</b></span>
              <span>Net prijs: <b>{eur(simB.kpis.endNetPrice, 0)}</b></span>
              <span>Korting: <b>{pctS(B.discount, 1)}</b></span>
            </div>
          </div>
        </div>
      </header>

      {/* Modelinstellingen */}
      <section className="rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold">Modelinstellingen</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={resetAll} className="text-sm rounded border px-3 py-1.5 hover:bg-gray-50">Reset</button>
            <button onClick={swapAB} className="text-sm rounded border px-3 py-1.5 hover:bg-gray-50">Swap A ↔ B</button>
          </div>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FieldNumber label="Gap-drempel (€/unit)" value={cfg.threshold} step={0.5} min={0}
            onChange={(v) => setCfg(s => ({ ...s, threshold: Math.max(0, v) }))} />
          <FieldPct label="PI-gevoeligheid per € (slope)" value={cfg.slope} max={1}
            help="Bijv. 0,06 = ~6 pp PI per extra € gap."
            onChange={(v) => setCfg(s => ({ ...s, slope: clamp(v, 0, 1) }))} />
          <FieldPct label="Max PI-share (cap)" value={cfg.cap} max={1}
            help="Plafond voor PI-share."
            onChange={(v) => setCfg(s => ({ ...s, cap: clamp(v, 0, 1) }))} />
          <FieldNumber label="PI ramp-in (mnd)" value={cfg.rampMonths} step={1} min={0}
            onChange={(v) => setCfg(s => ({ ...s, rampMonths: Math.max(0, Math.round(v)) }))} />
        </div>
      </section>

      {/* Parameters A/B */}
      <section className="rounded-2xl border bg-white p-4 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold">Parameters per scenario</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={copyAtoB} className="text-sm rounded border px-3 py-1.5 hover:bg-gray-50">Kopieer A → B</button>
            <button onClick={setB_toGapThreshold} className="text-sm rounded border px-3 py-1.5 hover:bg-gray-50">B: gap ≈ drempel</button>
            <button onClick={setB_toBreakEven} className="text-sm rounded border px-3 py-1.5 hover:bg-gray-50">B: break-even (Net Y1)</button>
          </div>
        </div>

        {beMsg ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 text-sky-900 text-xs px-3 py-2">{beMsg}</div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {/* A */}
          <div className="rounded-xl border p-4">
            <div className="font-semibold mb-3">Scenario A — Huidig</div>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
              <FieldNumber label="List price NL (€/unit)" value={A.listNL} step={0.5} min={0}
                onChange={(v) => setA(s => ({ ...s, listNL: Math.max(0, v) }))} />
              <FieldPct label="Korting %" value={A.discount}
                onChange={(v) => setA(s => ({ ...s, discount: clamp(v, 0, 0.9) }))} />
              <FieldNumber label="Parallel referentie (€/unit)" value={A.parallelRef} step={0.5} min={0}
                onChange={(v) => setA(s => ({ ...s, parallelRef: Math.max(0, v) }))} />
              <FieldNumber label="Units/maand (NL)" value={A.units} step={100} min={0}
                onChange={(v) => setA(s => ({ ...s, units: Math.max(0, Math.round(v)) }))} />

              {/* Handmatige PI (optioneel) */}
              <label className="text-sm w-full inline-flex items-center gap-2 col-span-full">
                <input type="checkbox" checked={A.manualPI} onChange={(e) => setA(s => ({ ...s, manualPI: e.target.checked }))} />
                <span className="font-medium">PI-share handmatig</span>
              </label>
              <FieldPct label="PI-share (eind, handmatig)" value={A.manualPIEnd} max={1}
                onChange={(v) => setA(s => ({ ...s, manualPIEnd: clamp(v, 0, 1) }))} />
              <FieldNumber label="Ramp-in (mnd, handmatig)" value={A.manualPIRampM} step={1} min={0}
                onChange={(v) => setA(s => ({ ...s, manualPIRampM: Math.max(0, Math.round(v)) }))} />
            </div>
          </div>

          {/* B */}
          <div className="rounded-xl border p-4">
            <div className="font-semibold mb-3">Scenario B — Voorstel</div>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
              <FieldNumber label="List price NL (€/unit)" value={B.listNL} step={0.5} min={0}
                onChange={(v) => setB(s => ({ ...s, listNL: Math.max(0, v) }))} />
              <FieldPct label="Korting %" value={B.discount}
                onChange={(v) => setB(s => ({ ...s, discount: clamp(v, 0, 0.9) }))} />
              <FieldNumber label="Parallel referentie (€/unit)" value={B.parallelRef} step={0.5} min={0}
                onChange={(v) => setB(s => ({ ...s, parallelRef: Math.max(0, v) }))} />
              <FieldNumber label="Units/maand (NL)" value={B.units} step={100} min={0}
                onChange={(v) => setB(s => ({ ...s, units: Math.max(0, Math.round(v)) }))} />

              {/* Handmatige PI (optioneel) */}
              <label className="text-sm w-full inline-flex items-center gap-2 col-span-full">
                <input type="checkbox" checked={B.manualPI} onChange={(e) => setB(s => ({ ...s, manualPI: e.target.checked }))} />
                <span className="font-medium">PI-share handmatig</span>
              </label>
              <FieldPct label="PI-share (eind, handmatig)" value={B.manualPIEnd} max={1}
                onChange={(v) => setB(s => ({ ...s, manualPIEnd: clamp(v, 0, 1) }))} />
              <FieldNumber label="Ramp-in (mnd, handmatig)" value={B.manualPIRampM} step={1} min={0}
                onChange={(v) => setB(s => ({ ...s, manualPIRampM: Math.max(0, Math.round(v)) }))} />
            </div>
          </div>
        </div>
      </section>

      {/* KPI’s per scenario */}
      <section className="rounded-2xl border bg-white p-4">
        <h3 className="text-base font-semibold mb-3">KPI’s (Jaar 1)</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {/* A */}
          <div className="rounded-xl border p-4">
            <div className="font-semibold mb-2">Scenario A</div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
              <Kpi title="Gap (einde)" value={eur(simA.kpis.endGap, 0)}
                   help={`Net prijs: ${eur(simA.kpis.endNetPrice,0)} • Parallel: ${eur(A.parallelRef,0)}`}
                   tone={simA.kpis.endGap > cfg.threshold ? "bad" : simA.kpis.endGap > 0 ? "warn" : "good"}
                   titleTooltip="Koperprijs t.o.v. parallel" />
              <Kpi title="PI-share (einde)" value={pctS(simA.kpis.endPIshare)}
                   help={`Cap: ${pctS(cfg.cap,0)}${A.manualPI ? " • handmatig" : ""}`}
                   tone={simA.kpis.endPIshare > 0.25 ? "bad" : simA.kpis.endPIshare > 0.10 ? "warn" : "default"} />
              <Kpi title="Gross Sales (Y1)" value={eur(simA.kpis.grossY1)} />
              <Kpi title="Discount (Y1)" value={eur(simA.kpis.discY1)} />
              <Kpi title="Net Sales (Y1)" value={eur(simA.kpis.netY1)} />
            </div>
          </div>
          {/* B */}
          <div className="rounded-xl border p-4">
            <div className="font-semibold mb-2">Scenario B</div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
              <Kpi title="Gap (einde)" value={eur(simB.kpis.endGap, 0)}
                   help={`Net prijs: ${eur(simB.kpis.endNetPrice,0)} • Parallel: ${eur(B.parallelRef,0)}`}
                   tone={simB.kpis.endGap > cfg.threshold ? "bad" : simB.kpis.endGap > 0 ? "warn" : "good"} />
              <Kpi title="PI-share (einde)" value={pctS(simB.kpis.endPIshare)}
                   help={`Cap: ${pctS(cfg.cap,0)}${B.manualPI ? " • handmatig" : ""}`}
                   tone={simB.kpis.endPIshare > 0.25 ? "bad" : simB.kpis.endPIshare > 0.10 ? "warn" : "default"} />
              <Kpi title="Gross Sales (Y1)" value={eur(simB.kpis.grossY1)} />
              <Kpi title="Discount (Y1)" value={eur(simB.kpis.discY1)} />
              <Kpi title="Net Sales (Y1)" value={eur(simB.kpis.netY1)} />
            </div>
          </div>
        </div>
      </section>

      {/* Verschil A → B */}
      <section className="rounded-2xl border bg-white p-4">
        <h3 className="text-base font-semibold mb-3">Verschil B t.o.v. A — Jaar 1</h3>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <Kpi title="Δ Net Sales" value={eur(deltas.dNet)} tone={deltas.dNet >= 0 ? "good" : "bad"} />
          <Kpi title="Δ Gross Sales" value={eur(deltas.dGross)} tone={deltas.dGross >= 0 ? "good" : "warn"} />
          <Kpi title="Δ Discount" value={eur(deltas.dDisc)} tone={deltas.dDisc <= 0 ? "good" : "warn"} />
          <Kpi title="Δ Parallel omzet" value={eur(deltas.dPI)} tone={deltas.dPI <= 0 ? "good" : "warn"} />
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Aannames: <b>sOriginator = 1 − sPI</b> (minder PI vloeit 1-op-1 terug). Netto = Bruto − Korting.
        </p>
      </section>

      {/* Grafieken */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h4 className="text-sm font-semibold mb-2">Originator Net Sales per maand</h4>
          <LineChart name="Net Sales A" color="#0ea5e9" values={simA.points.map(p => p.netSalesOriginator)} yFmt={(v) => compact(v)} />
          <div className="mt-2" />
          <LineChart name="Net Sales B" color="#22c55e" values={simB.points.map(p => p.netSalesOriginator)} yFmt={(v) => compact(v)} />
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <h4 className="text-sm font-semibold mb-2">PI-share per maand</h4>
          <LineChart name="PI share A" color="#6366f1" values={simA.points.map(p => p.sPI * 100)} yFmt={(v) => `${v.toFixed(0)}%`} />
          <div className="mt-2" />
          <LineChart name="PI share B" color="#f59e0b" values={simB.points.map(p => p.sPI * 100)} yFmt={(v) => `${v.toFixed(0)}%`} />
        </div>
      </section>
    </main>
  );
}
