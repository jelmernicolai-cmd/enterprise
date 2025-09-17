"use client";

import { useMemo, useState } from "react";

/** ================= helpers ================= */
const eur = (n: number, d = 0) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: d, minimumFractionDigits: d })
    .format(Number.isFinite(n) ? n : 0);
const pctS = (p: number, d = 1) =>
  `${((Number.isFinite(p) ? p : 0) * 100).toFixed(d)}%`;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const compact = (n: number) =>
  new Intl.NumberFormat("nl-NL", { notation: "compact", maximumFractionDigits: 1 }).format(Number.isFinite(n) ? n : 0);

/** ================= types ================= */
type Inputs = {
  // Kern (zichtbaar)
  preNet: number;          // €/unit pre-LOE net
  units: number;           // units/maand (markt)
  prefIntensity: "geen" | "middel" | "hoog";
  freeExtraDisc: number;   // 0..0.15 extra korting vrij volume
  tenderLoss: number;      // 0..0.50 aandeelverlies ziekenhuis
  tenderMonth: number;     // 0..12 start tenderverlies

  // Geavanceerd (ingeklapt)
  horizon: number;         // 12..36 mnd
  mnShare: number;         // 0..0.10 originator binnen preferentie (MN)
};

type Point = {
  t: number;
  // total share & netsales originator
  shareOriTotal: number;
  nsOri: number;
  // voor visuals
  netOriFree: number; netGenFree: number;
  mixPref: number; mixFree: number; mixHosp: number;
};

type Sim = {
  points: Point[];
  kpis: {
    oriNetY1: number;
    ebitdaY1: number;
    endShare: number;
    openGapEUR: number;   // vrije markt net-gap (ori − gen) op einde
    mixPref: number; mixFree: number; mixHosp: number; // startmix
  };
};

/** ================= aannames ================= */
// Segmentmix obv preferentie-intensiteit
const prefMix = (i: Inputs) => {
  const pref = i.prefIntensity === "geen" ? 0 : i.prefIntensity === "middel" ? 0.5 : 0.75;
  const rest = 1 - pref;
  return { pref, free: rest * 0.7, hosp: rest * 0.3 };
};
// Generieke netprijs als % van pre-LOE net (NL-typisch)
const GEN_PREF = 0.20; // preferentie
const GEN_FREE = 0.50; // vrij
const GEN_HOSP = 0.45; // ziekenhuis
// Originator: net-floor & vaste ziekenhuiskorting
const NET_FLOOR = 0.42;  // ori zakt niet onder 42% van pre-LOE net
const EXTRA_HOSP = 0.06; // extra korting in ziekenhuis
// Vrij volume: marktaandeel gevoelig voor net-gap
const BASE_FREE_SHARE = 0.55;
const ELASTICITY_FREE = 0.35;
// EBITDA benadering
const COGS = 0.20;

/** ================= simulatie ================= */
function simulate(i: Inputs): Sim {
  const { pref, free, hosp } = prefMix(i);
  const pts: Point[] = [];
  const horizon = clamp(Math.round(i.horizon), 12, 36);

  for (let t = 0; t < horizon; t++) {
    const unitsPref = i.units * pref;
    const unitsFree = i.units * free;
    const unitsHosp = i.units * hosp;

    // Preferentie: carve-out MN
    const shareOriPref = clamp(i.mnShare, 0, 0.10);
    const netGenPref = i.preNet * GEN_PREF;
    const netOriPref = Math.max(i.preNet * (1 - i.freeExtraDisc), i.preNet * NET_FLOOR);

    // Vrij: prijzen + aandeel o.b.v. net-gap
    const netGenFree = i.preNet * GEN_FREE;
    const netOriFree = Math.max(i.preNet * (1 - i.freeExtraDisc), i.preNet * NET_FLOOR);
    const gapFree = netOriFree - netGenFree;
    const shareAdj = clamp(1 - ELASTICITY_FREE * (gapFree / Math.max(i.preNet, 1)), 0.05, 0.95);
    const shareOriFree = clamp(BASE_FREE_SHARE * shareAdj, 0.05, 0.95);

    // Ziekenhuis: tenderverlies vanaf tenderMonth (ramp 2 mnd)
    const beforeShareHosp = 0.70;
    const afterShareHosp = beforeShareHosp * (1 - clamp(i.tenderLoss, 0, 0.5));
    const ramp =
      t < i.tenderMonth ? 0 :
      t >= i.tenderMonth + 2 ? 1 :
      (t - i.tenderMonth) / 2;
    const shareOriHosp = clamp(beforeShareHosp + (afterShareHosp - beforeShareHosp) * ramp, 0.05, 0.95);
    const netGenHosp = i.preNet * GEN_HOSP;
    const netOriHosp = Math.max(i.preNet * (1 - EXTRA_HOSP), i.preNet * NET_FLOOR);

    const nsOri =
      unitsPref * shareOriPref * netOriPref +
      unitsFree * shareOriFree * netOriFree +
      unitsHosp * shareOriHosp * netOriHosp;

    const shareOriTotal =
      (unitsPref * shareOriPref + unitsFree * shareOriFree + unitsHosp * shareOriHosp) /
      Math.max(1, i.units);

    pts.push({
      t,
      shareOriTotal,
      nsOri,
      netOriFree, netGenFree,
      mixPref: pref, mixFree: free, mixHosp: hosp,
    });
  }

  const y1 = pts.slice(0, Math.min(12, pts.length));
  const end = pts.at(-1)!;

  return {
    points: pts,
    kpis: {
      oriNetY1: y1.reduce((a, p) => a + p.nsOri, 0),
      ebitdaY1: y1.reduce((a, p) => a + p.nsOri, 0) * (1 - COGS),
      endShare: end.shareOriTotal,
      openGapEUR: (end.netOriFree ?? 0) - (end.netGenFree ?? 0),
      mixPref: pts[0]?.mixPref ?? 0,
      mixFree: pts[0]?.mixFree ?? 0,
      mixHosp: pts[0]?.mixHosp ?? 0,
    },
  };
}

/** ================= kleine UI bouwstenen ================= */
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
          type="number" inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          step={step} min={min} max={max}
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
      <div className="mt-1 grid grid-cols-[1fr_auto_auto] items-center gap-2">
        <input type="range" min={0} max={max} step={0.005} value={val}
               onChange={(e) => onChange(clamp(parseFloat(e.target.value), 0, max))}
               className="w-full" />
        <input type="number" inputMode="decimal" min={0} max={max} step={0.01} value={val}
               onChange={(e) => onChange(clamp(parseFloat(e.target.value), 0, max))}
               className="w-24 rounded-lg border px-3 py-2" />
        <span className="text-gray-500">{pctS(val)}</span>
      </div>
    </label>
  );
}

function SelectPref({
  value, onChange,
}: { value: Inputs["prefIntensity"]; onChange: (v: Inputs["prefIntensity"]) => void }) {
  return (
    <label className="text-sm w-full">
      <div className="font-medium">Preferentie-intensiteit</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Inputs["prefIntensity"])}
        className="mt-1 w-full rounded-lg border px-3 py-2"
      >
        <option value="geen">Geen</option>
        <option value="middel">Middel (±50%)</option>
        <option value="hoog">Hoog (±75%)</option>
      </select>
    </label>
  );
}

/** ================= visuals (SVG, geen libs) ================= */
function Donut({
  value, // 0..1
  size = 120,
  stroke = 14,
  label = "",
  color = "#0ea5e9",
}: { value: number; size?: number; stroke?: number; label?: string; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = clamp(value, 0, 1);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={label} role="img">
      <circle cx={size/2} cy={size/2} r={r} stroke="#eef2f7" strokeWidth={stroke} fill="none" />
      <circle
        cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${c} ${c}`} strokeDashoffset={`${c * (1 - v)}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-gray-900" fontSize="16" fontWeight={600}>
        {pctS(v, 0)}
      </text>
      {label ? (
        <text x="50%" y={size - 10} textAnchor="middle" className="fill-gray-600" fontSize="10">{label}</text>
      ) : null}
    </svg>
  );
}

function MixBar({
  pref, free, hosp,
}: { pref: number; free: number; hosp: number }) {
  const P = clamp(pref, 0, 1), F = clamp(free, 0, 1), H = clamp(hosp, 0, 1);
  const pW = `${P * 100}%`, fW = `${F * 100}%`, hW = `${H * 100}%`;
  return (
    <div className="w-full">
      <div className="rounded-lg overflow-hidden border">
        <div className="flex h-3">
          <span style={{ width: pW, background: "#38bdf8" }} />
          <span style={{ width: fW, background: "#86efac" }} />
          <span style={{ width: hW, background: "#fcd34d" }} />
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-600">
        <span>Preferentie {pctS(P,0)}</span>
        <span>Vrij {pctS(F,0)}</span>
        <span>Zkh {pctS(H,0)}</span>
      </div>
    </div>
  );
}

function OverlayChart({
  title, series, yFmt = (v: number) => v.toFixed(0), height = 220,
}: {
  title: string;
  series: { name: string; color: string; values: number[] }[];
  yFmt?: (v: number) => string;
  height?: number;
}) {
  const w = 960, h = height, padX = 46, padY = 28;
  const maxLen = Math.max(1, ...series.map(s => s.values.length));
  const all = series.flatMap(s => s.values);
  const maxY = Math.max(1, ...all);
  const minY = 0;
  const x = (i: number) => padX + (i / Math.max(1, maxLen - 1)) * (w - 2 * padX);
  const y = (v: number) => h - padY - ((v - minY) / (maxY - minY)) * (h - 2 * padY);
  const ticks = Array.from({ length: 5 }, (_, i) => (maxY / 4) * i);

  return (
    <svg className="w-full h-auto" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title} preserveAspectRatio="xMidYMid meet">
      <rect x={12} y={12} width={w - 24} height={h - 24} rx={16} fill="#fff" stroke="#e5e7eb" />
      {ticks.map((tv, i) => (
        <g key={i}>
          <line x1={padX} y1={y(tv)} x2={w - padX} y2={y(tv)} stroke="#f3f4f6" />
          <text x={padX - 8} y={y(tv) + 4} fontSize="10" textAnchor="end" fill="#6b7280">{yFmt(tv)}</text>
        </g>
      ))}
      {series.map((s, si) => {
        const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
        return (
          <g key={si}>
            <path d={d} fill="none" stroke={s.color} strokeWidth={2} />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={2} fill={s.color}>
                <title>{`${s.name} • m${i + 1}: ${yFmt(v)}`}</title>
              </circle>
            ))}
            <text x={w - padX} y={y(s.values.at(-1) || 0) - 6} fontSize="10" textAnchor="end" fill={s.color}>
              {s.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** ================= pagina ================= */
export default function LOECompareVisual() {
  const [showAdv, setShowAdv] = useState(false);

  const [A, setA] = useState<Inputs>({
    preNet: 25, units: 10000, prefIntensity: "middel",
    freeExtraDisc: 0.06, tenderLoss: 0.20, tenderMonth: 6,
    horizon: 24, mnShare: 0.04,
  });
  const [B, setB] = useState<Inputs>({
    preNet: 25, units: 10000, prefIntensity: "hoog",
    freeExtraDisc: 0.10, tenderLoss: 0.30, tenderMonth: 6,
    horizon: 24, mnShare: 0.05,
  });

  const simA = useMemo(() => simulate(A), [A]);
  const simB = useMemo(() => simulate(B), [B]);

  // Deltas (B - A)
  const dNetY1 = simB.kpis.oriNetY1 - simA.kpis.oriNetY1;
  const dEbY1  = simB.kpis.ebitdaY1 - simA.kpis.ebitdaY1;
  const dShare = simB.kpis.endShare - simA.kpis.endShare;
  const dGap   = simB.kpis.openGapEUR - simA.kpis.openGapEUR;

  const copyAtoB = () => setB({ ...A });
  const swapAB = () => { const a = A; setA(B); setB(a); };
  const reset = () => {
    setA({ preNet: 25, units: 10000, prefIntensity: "middel", freeExtraDisc: 0.06, tenderLoss: 0.20, tenderMonth: 6, horizon: 24, mnShare: 0.04 });
    setB({ preNet: 25, units: 10000, prefIntensity: "hoog",   freeExtraDisc: 0.10, tenderLoss: 0.30, tenderMonth: 6, horizon: 24, mnShare: 0.05 });
  };

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-4 lg:px-6 py-4 space-y-6">
      {/* Header + Δ-balk */}
      <header className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">LOE – Scenariovergelijker</h1>
            <p className="text-sm text-gray-700 mt-1">
              Vergelijk <b>A</b> en <b>B</b> op Net Sales, EBITDA, marktaandeel en open-gap. Pas 5 stuurknoppen aan; geavanceerd staat netjes ingeklapt.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={copyAtoB} className="text-sm rounded border px-3 py-2 hover:bg-gray-50">Kopieer A → B</button>
            <button onClick={swapAB}  className="text-sm rounded border px-3 py-2 hover:bg-gray-50">Swap A ↔ B</button>
            <button onClick={reset}   className="text-sm rounded border px-3 py-2 hover:bg-gray-50">Reset</button>
          </div>
        </div>

        {/* Δ-KPI’s (B − A) */}
        <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
          <DeltaCard title="Δ Net Sales Y1" value={eur(dNetY1)} tone={dNetY1 >= 0 ? "up" : "down"} />
          <DeltaCard title="Δ EBITDA Y1" value={eur(dEbY1)} tone={dEbY1 >= 0 ? "up" : "down"} />
          <DeltaCard title="Δ Eind-share" value={pctS(dShare, 1)} tone={dShare >= 0 ? "up" : "down"} />
          <DeltaCard title="Δ Open-gap (vrij)" value={eur(dGap, 0)} tone={dGap <= 0 ? "up" : "warn"} />
        </div>
      </header>

      {/* Scenario-kaarten */}
      <section className="grid gap-4 md:grid-cols-2">
        <ScenarioCard
          title="Scenario A"
          color="#0ea5e9"
          state={A}
          setState={setA}
          sim={simA}
          showAdv={showAdv}
        />
        <ScenarioCard
          title="Scenario B"
          color="#f59e0b"
          state={B}
          setState={setB}
          sim={simB}
          showAdv={showAdv}
        />
      </section>

      {/* Visuals: donuts + mix + overlay lijnen */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h3 className="text-sm font-semibold mb-3">Net Sales per maand</h3>
          <OverlayChart
            title="Net Sales"
            series={[
              { name: "A — Net Sales", color: "#0ea5e9", values: simA.points.map(p => p.nsOri) },
              { name: "B — Net Sales", color: "#f59e0b", values: simB.points.map(p => p.nsOri) },
            ]}
            yFmt={(v) => compact(v)}
          />
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <h3 className="text-sm font-semibold mb-3">Marktaandeel originator (%)</h3>
          <OverlayChart
            title="Share %"
            series={[
              { name: "A — Share", color: "#0ea5e9", values: simA.points.map(p => p.shareOriTotal * 100) },
              { name: "B — Share", color: "#f59e0b", values: simB.points.map(p => p.shareOriTotal * 100) },
            ]}
            yFmt={(v) => `${v.toFixed(0)}%`}
          />
        </div>
      </section>

      {/* Donuts + mixbalken */}
      <section className="rounded-2xl border bg-white p-4">
        <div className="grid gap-6 md:grid-cols-2">
          {/* A */}
          <div className="grid gap-3 sm:grid-cols-[140px_1fr] items-center">
            <Donut value={simA.kpis.endShare} label="Eind-share A" color="#0ea5e9" />
            <div>
              <div className="text-sm font-medium mb-1">Marktmix A</div>
              <MixBar pref={simA.kpis.mixPref} free={simA.kpis.mixFree} hosp={simA.kpis.mixHosp} />
              <div className="text-xs text-gray-600 mt-2">
                Open-gap vrij: <b>{eur(simA.kpis.openGapEUR, 0)}</b>
              </div>
            </div>
          </div>
          {/* B */}
          <div className="grid gap-3 sm:grid-cols-[140px_1fr] items-center">
            <Donut value={simB.kpis.endShare} label="Eind-share B" color="#f59e0b" />
            <div>
              <div className="text-sm font-medium mb-1">Marktmix B</div>
              <MixBar pref={simB.kpis.mixPref} free={simB.kpis.mixFree} hosp={simB.kpis.mixHosp} />
              <div className="text-xs text-gray-600 mt-2">
                Open-gap vrij: <b>{eur(simB.kpis.openGapEUR, 0)}</b>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Geavanceerd toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowAdv(s => !s)}
          className="text-sm rounded border px-3 py-2 hover:bg-gray-50"
        >
          {showAdv ? "Verberg geavanceerd" : "Toon geavanceerd"}
        </button>
        <span className="text-xs text-gray-500">Aannames: generiek-net (pref 20% / vrij 50% / zkh 45%), originator floor ~42%, COGS 20%.</span>
      </div>
    </div>
  );
}

/** ================= subcomponenten ================= */
function DeltaCard({ title, value, tone }: { title: string; value: string; tone: "up" | "down" | "warn" }) {
  const cls =
    tone === "up"   ? "border-emerald-200 bg-emerald-50" :
    tone === "down" ? "border-rose-200 bg-rose-50" :
                      "border-amber-200 bg-amber-50";
  const Icon = tone === "up" ? UpIcon : tone === "down" ? DownIcon : WarnIcon;
  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 ${cls}`}>
      <Icon />
      <div>
        <div className="text-xs text-gray-600">{title}</div>
        <div className="text-lg font-semibold mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function ScenarioCard({
  title, color, state, setState, sim, showAdv,
}: {
  title: string;
  color: string;
  state: Inputs;
  setState: (v: Inputs | ((s: Inputs) => Inputs)) => void;
  sim: Sim;
  showAdv: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-3 h-3 rounded-full" style={{ background: color }} />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldNumber label="Pre-LOE net €/unit" value={state.preNet} min={1} step={1}
          onChange={(v) => setState(s => ({ ...s, preNet: Math.max(0, v) }))} />
        <FieldNumber label="Units/maand (markt)" value={state.units} min={100} step={500}
          onChange={(v) => setState(s => ({ ...s, units: Math.max(0, Math.round(v)) }))} />
        <SelectPref value={state.prefIntensity} onChange={(v) => setState(s => ({ ...s, prefIntensity: v }))} />
        <FieldPct label="Extra korting (vrij volume)" value={state.freeExtraDisc} max={0.15}
          onChange={(v) => setState(s => ({ ...s, freeExtraDisc: clamp(v, 0, 0.15) }))} />
        <FieldPct label="Tenderverlies (ziekenhuis)" value={state.tenderLoss} max={0.5}
          onChange={(v) => setState(s => ({ ...s, tenderLoss: clamp(v, 0, 0.5) }))} />
        <FieldNumber label="Tender — maand" value={state.tenderMonth} min={0} max={12} step={1}
          onChange={(v) => setState(s => ({ ...s, tenderMonth: clamp(Math.round(v), 0, 12) }))} />
      </div>

      {showAdv && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FieldNumber label="Horizon (mnd)" value={state.horizon} min={12} max={36} step={6}
            onChange={(v) => setState(s => ({ ...s, horizon: clamp(Math.round(v), 12, 36) }))} />
          <FieldPct label="MN-volume (preferentie)" value={state.mnShare} max={0.10}
            help="Aandeel originator binnen preferentie (MN/uitzonderingen)."
            onChange={(v) => setState(s => ({ ...s, mnShare: clamp(v, 0, 0.10) }))} />
        </div>
      )}

      {/* KPI’s */}
      <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))] text-sm">
        <KPI label="Net Sales — Jaar 1" value={eur(sim.kpis.oriNetY1)} />
        <KPI label="EBITDA — Jaar 1" value={eur(sim.kpis.ebitdaY1)} />
        <KPI label="Eind-share" value={pctS(sim.kpis.endShare, 1)} />
        <KPI label="Open-gap (vrij) m" value={`${eur(sim.kpis.openGapEUR, 0)}`} suffix={`${""}`} />
      </div>
    </div>
  );
}

function KPI({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}{suffix ? <span className="text-gray-500 text-sm ml-1">{suffix}</span> : null}</div>
    </div>
  );
}

/** ================= icons ================= */
function UpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-emerald-600" aria-hidden>
      <path d="M12 3l6 6h-4v9h-4V9H6l6-6z" fill="currentColor" />
    </svg>
  );
}
function DownIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-rose-600" aria-hidden>
      <path d="M12 21l-6-6h4V6h4v9h4l-6 6z" fill="currentColor" />
    </svg>
  );
}
function WarnIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-amber-600" aria-hidden>
      <path d="M1 21h22L12 2 1 21zm12-3h-2v2h2v-2zm0-8h-2v6h2V10z" fill="currentColor" />
    </svg>
  );
}
