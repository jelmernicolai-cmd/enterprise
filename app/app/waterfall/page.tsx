"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { loadWaterfallRows, eur0 } from "@/lib/waterfall-storage";
import type { Row } from "@/lib/waterfall-types";

/* ========= Helpers ========= */
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function sumDiscounts(r: Row) {
  return (
    (r.d_channel || 0) +
    (r.d_customer || 0) +
    (r.d_product || 0) +
    (r.d_volume || 0) +
    (r.d_other_sales || 0) +
    (r.d_mandatory || 0) +
    (r.d_local || 0)
  );
}
function sumRebates(r: Row) {
  return (
    (r.r_direct || 0) +
    (r.r_prompt || 0) +
    (r.r_indirect || 0) +
    (r.r_mandatory || 0) +
    (r.r_local || 0)
  );
}
function pct(num: number, den: number) {
  const v = den ? (num / den) * 100 : 0;
  return `${v.toFixed(1)}%`;
}
function compact(n: number) {
  return Intl.NumberFormat("nl-NL", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
}

/* ========= Waterfall Chart ========= */
type Step =
  | { label: string; value: number; kind: "pos-start"; share?: number }
  | { label: string; value: number; kind: "neg"; share?: number }
  | { label: string; value: 0; kind: "subtotal"; share?: number };

type Tooltip = { x: number; y: number; title: string; value: number; share: number; color: string } | null;

function WaterfallChart({
  steps,
  grossTotal,
  width = 980,
  height = 360,
}: {
  steps: Step[];
  grossTotal: number;
  width?: number;
  height?: number;
}) {
  const padX = 48;
  const padY = 40;
  const w = width;
  const h = height;

  // schaal o.b.v. running total
  let running = 0;
  let maxVal = 0;
  steps.forEach((s, i) => {
    if (i === 0 && s.kind === "pos-start") {
      running = s.value;
      maxVal = Math.max(maxVal, running);
      return;
    }
    if (s.kind === "neg") {
      const next = running + s.value;
      maxVal = Math.max(maxVal, running, next);
      running = next;
      return;
    }
    if (s.kind === "subtotal") maxVal = Math.max(maxVal, running);
  });
  if (maxVal <= 0) maxVal = 1;

  const colW = (w - 2 * padX) / Math.max(steps.length, 1);
  const barW = Math.min(48, Math.max(18, colW * 0.55));
  const toY = (val: number) => h - padY - (val / maxVal) * (h - 2 * padY);

  type Bar = {
    label: string;
    x: number;
    y: number;
    barW: number;
    barH: number;
    fill: string;
    value: number;
    share: number;
    isSubtotal: boolean;
  };
  running = 0;
  const bars: Bar[] = [];

  steps.forEach((s, i) => {
    const cx = padX + i * colW + (colW - barW) / 2;

    if (i === 0 && s.kind === "pos-start") {
      const top = toY(s.value), bot = toY(0);
      bars.push({
        label: s.label, x: cx, y: top, barW, barH: Math.max(0, bot - top),
        fill: "url(#wf-start)", value: s.value, share: (s.value / (grossTotal || 1)) * 100, isSubtotal: false,
      });
      running = s.value;
      return;
    }

    if (s.kind === "neg") {
      const from = running, to = running + s.value;
      const top = toY(Math.max(from, to)), bot = toY(Math.min(from, to));
      bars.push({
        label: s.label, x: cx, y: top, barW, barH: Math.max(0, bot - top),
        fill: "url(#wf-neg)", value: Math.abs(s.value), share: (Math.abs(s.value) / (grossTotal || 1)) * 100, isSubtotal: false,
      });
      running = to;
      return;
    }

    if (s.kind === "subtotal") {
      const top = toY(running), bot = toY(0);
      bars.push({
        label: s.label, x: cx, y: top, barW, barH: Math.max(0, bot - top),
        fill: s.label === "Net" ? "url(#wf-net)" : "url(#wf-sub)",
        value: running, share: (running / (grossTotal || 1)) * 100, isSubtotal: true,
      });
    }
  });

  const ticks = Array.from({ length: 5 }, (_, i) => (maxVal / 4) * i);

  const [tip, setTip] = useState<Tooltip>(null);
  const onMove = (e: React.MouseEvent<SVGRectElement>, b: Bar) => {
    const pt = (e.target as SVGRectElement).ownerSVGElement?.createSVGPoint();
    if (!pt) return;
    pt.x = e.clientX; pt.y = e.clientY;
    const m = (e.target as SVGRectElement).ownerSVGElement!.getScreenCTM();
    if (!m) return;
    const p = pt.matrixTransform(m.inverse());
    setTip({
      x: p.x + 8, y: p.y - 8, title: b.label, value: b.value, share: b.share,
      color: b.fill.includes("neg") ? "#ef4444" : b.fill.includes("sub") ? "#0ea5e9" : b.fill.includes("net") ? "#16a34a" : "#4b5563",
    });
  };

  return (
    <svg className="w-full" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Waterfall Gross → Net" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="wf-start" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#6b7280" /><stop offset="1" stopColor="#4b5563" />
        </linearGradient>
        <linearGradient id="wf-neg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f87171" /><stop offset="1" stopColor="#ef4444" />
        </linearGradient>
        <linearGradient id="wf-sub" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
        <linearGradient id="wf-net" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#16a34a" />
        </linearGradient>
        <filter id="wf-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Panel */}
      <rect x={12} y={12} width={w - 24} height={h - 24} rx={16} fill="#fff" stroke="#e5e7eb" />

      {/* As-lijnen */}
      <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="#e5e7eb" />
      <line x1={padX} y1={padY} x2={padX} y2={h - padY} stroke="#e5e7eb" />

      {/* Grid + ticks */}
      {ticks.map((tv, i) => {
        const y = toY(tv);
        return (
          <g key={i}>
            <line x1={padX - 4} y1={y} x2={w - padX} y2={y} stroke="#f3f4f6" />
            <text x={padX - 10} y={y + 3} fontSize="10" textAnchor="end" fill="#6b7280">{compact(tv)}</text>
          </g>
        );
      })}

      {/* Bars */}
      {bars.map((b, i) => (
        <g key={i} transform={`translate(${b.x},${b.y})`} filter="url(#wf-shadow)">
          <rect width={b.barW} height={b.barH} rx="6" fill={b.fill}
            onMouseMove={(e) => onMove(e, b)} onMouseLeave={() => setTip(null)} />
          <text x={b.barW / 2} y={-8} fontSize="10" textAnchor="middle" fill="#111827">
            {compact(Math.abs(b.value))}
          </text>
          <text x={b.barW / 2} y={b.barH + 16} fontSize="10" textAnchor="middle" fill="#6b7280">
            {b.label}
          </text>
        </g>
      ))}

      {/* Tooltip */}
      {tip && (
        <g transform={`translate(${tip.x},${tip.y})`}>
          <rect x={0} y={-30} rx={6} width={160} height={30} fill="#111827" opacity="0.92" />
          <text x={8} y={-19} fontSize="10" fill="#e5e7eb">{tip.title}</text>
          <text x={8} y={-7} fontSize="11" fill="#ffffff">
            {compact(Math.abs(tip.value))} • {tip.share.toFixed(1)}% van Gross
          </text>
        </g>
      )}

      {/* Legenda (blijft in SVG → geen page-overflow) */}
      <g transform={`translate(${w - padX - 240}, ${padY - 14})`}>
        <LegendItem color="url(#wf-start)" label="Gross (start)" x={0} />
        <LegendItem color="url(#wf-sub)" label="Invoiced (subtotal)" x={90} />
        <LegendItem color="url(#wf-neg)" label="Discounts / Rebates" x={230} />
        <LegendItem color="url(#wf-net)" label="Net (eind)" x={420} />
      </g>
    </svg>
  );
}
function LegendItem({ color, label, x }: { color: string; label: string; x: number }) {
  return (
    <g transform={`translate(${x},0)`}>
      <rect x={0} y={0} width={12} height={8} rx={2} fill={color} />
      <text x={18} y={7} fontSize="10" fill="#6b7280">{label}</text>
    </g>
  );
}

/* ========= Buckets (grid + interactiviteit per card) ========= */
type BucketKey = "Customer" | "Volume" | "Channel" | "Product" | "Other/Value" | "Mandatory" | "Local";

/* ========= Pagina ========= */
export default function WaterfallPage() {
  const rows = loadWaterfallRows();

  if (!rows.length) {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Waterfall</h1>
          <Link href="/app/upload" className="text-sm rounded-lg border px-3 py-2 hover:bg-gray-50">
            Upload dataset →
          </Link>
        </header>
        <div className="rounded-2xl border bg-white p-6 text-gray-600">
          Geen data gevonden. Ga naar <Link className="underline" href="/app/upload">Upload</Link>, sla op en kom terug.
        </div>
      </div>
    );
  }

  const base = useMemo(() => {
    // Totals + buckets
    let gross = 0, totalDisc = 0, totalReb = 0;
    const d = { channel: 0, customer: 0, product: 0, volume: 0, other_sales: 0, mandatory: 0, local: 0 };
    const r = { direct: 0, prompt: 0, indirect: 0, mandatory: 0, local: 0 };

    rows.forEach((row) => {
      const g = row.gross || 0;
      const disc = sumDiscounts(row);
      const reb = sumRebates(row);
      gross += g; totalDisc += disc; totalReb += reb;

      d.channel += row.d_channel || 0;
      d.customer += row.d_customer || 0;
      d.product += row.d_product || 0;
      d.volume += row.d_volume || 0;
      d.other_sales += row.d_other_sales || 0;
      d.mandatory += row.d_mandatory || 0;
      d.local += row.d_local || 0;

      r.direct += row.r_direct || 0;
      r.prompt += row.r_prompt || 0;
      r.indirect += row.r_indirect || 0;
      r.mandatory += row.r_mandatory || 0;
      r.local += row.r_local || 0;
    });

    const invoiced = Math.max(0, gross - totalDisc);
    const net = Math.max(0, invoiced - totalReb);

    const steps: Step[] = [
      { label: "Gross", value: gross, kind: "pos-start" },
      { label: "Channel", value: -d.channel, kind: "neg" },
      { label: "Customer", value: -d.customer, kind: "neg" },
      { label: "Product", value: -d.product, kind: "neg" },
      { label: "Volume", value: -d.volume, kind: "neg" },
      { label: "Other/Value", value: -d.other_sales, kind: "neg" },
      { label: "Mandatory", value: -d.mandatory, kind: "neg" },
      { label: "Local", value: -d.local, kind: "neg" },
      { label: "Invoiced", value: 0, kind: "subtotal" },
      { label: "Reb. Direct", value: -r.direct, kind: "neg" },
      { label: "Reb. Prompt", value: -r.prompt, kind: "neg" },
      { label: "Reb. Indirect", value: -r.indirect, kind: "neg" },
      { label: "Reb. Mandatory", value: -r.mandatory, kind: "neg" },
      { label: "Reb. Local", value: -r.local, kind: "neg" },
      { label: "Net", value: 0, kind: "subtotal" },
    ];

    // top customers/skus (overall)
    const overallDiscPct = gross ? (totalDisc / gross) * 100 : 0;

    const discByCustomer = new Map<string, { disc: number; gross: number }>();
    rows.forEach((row) => {
      const key = row.cust || "(onbekend)";
      const cur = discByCustomer.get(key) || { disc: 0, gross: 0 };
      cur.disc += sumDiscounts(row);
      cur.gross += row.gross || 0;
      discByCustomer.set(key, cur);
    });
    const topCustomers = [...discByCustomer.entries()]
      .map(([cust, v]) => ({
        cust,
        disc: v.disc,
        gross: v.gross,
        pct: v.gross ? (v.disc / v.gross) * 100 : 0,
        delta: v.gross ? (v.disc / v.gross) * 100 - overallDiscPct : 0,
      }))
      .sort((a, b) => b.disc - a.disc)
      .slice(0, 3);

    const discBySku = new Map<string, { disc: number; gross: number }>();
    rows.forEach((row) => {
      const key = row.sku || "(onbekend)";
      const cur = discBySku.get(key) || { disc: 0, gross: 0 };
      cur.disc += sumDiscounts(row);
      cur.gross += row.gross || 0;
      discBySku.set(key, cur);
    });
    const topSkus = [...discBySku.entries()]
      .map(([sku, v]) => ({
        sku,
        disc: v.disc,
        gross: v.gross,
        pct: v.gross ? (v.disc / v.gross) * 100 : 0,
        flag: v.gross ? (v.disc / v.gross) * 100 >= overallDiscPct + 5 : false,
      }))
      .sort((a, b) => b.disc - a.disc)
      .slice(0, 3);

    const buckets = [
      { key: "Customer", value: d.customer },
      { key: "Volume", value: d.volume },
      { key: "Channel", value: d.channel },
      { key: "Product", value: d.product },
      { key: "Other/Value", value: d.other_sales },
      { key: "Mandatory", value: d.mandatory },
      { key: "Local", value: d.local },
    ]
      .map((b) => ({ ...b, share: gross ? (b.value / gross) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

    return { gross, invoiced, net, totalDisc, totalReb, steps, buckets, d, r, topCustomers, topSkus };
  }, [rows]);

  /* ===== scenario tweaks (per bucket) ===== */
  type Tweaks = Partial<Record<BucketKey, number>>;
  const [tweaks, setTweaks] = useState<Tweaks>({});

  const adj = useMemo(() => {
    const t = {
      Channel: clamp(tweaks.Channel ?? 0, 0, 0.2),
      Customer: clamp(tweaks.Customer ?? 0, 0, 0.2),
      Product: clamp(tweaks.Product ?? 0, 0, 0.2),
      Volume: clamp(tweaks.Volume ?? 0, 0, 0.2),
      "Other/Value": clamp(tweaks["Other/Value"] ?? 0, 0, 0.2),
      Mandatory: clamp(tweaks.Mandatory ?? 0, 0, 0.2),
      Local: clamp(tweaks.Local ?? 0, 0, 0.2),
    } as Record<BucketKey, number>;

    const dAdj = {
      channel: base.d.channel * (1 - t.Channel),
      customer: base.d.customer * (1 - t.Customer),
      product: base.d.product * (1 - t.Product),
      volume: base.d.volume * (1 - t.Volume),
      other_sales: base.d.other_sales * (1 - t["Other/Value"]),
      mandatory: base.d.mandatory * (1 - t.Mandatory),
      local: base.d.local * (1 - t.Local),
    };
    const totalDiscAdj =
      dAdj.channel + dAdj.customer + dAdj.product + dAdj.volume + dAdj.other_sales + dAdj.mandatory + dAdj.local;

    const invoicedAdj = Math.max(0, base.gross - totalDiscAdj);
    const netAdj = Math.max(0, invoicedAdj - base.totalReb);
    const netUplift = netAdj - base.net;

    const stepsAdj: Step[] = [
      { label: "Gross", value: base.gross, kind: "pos-start" },
      { label: "Channel", value: -dAdj.channel, kind: "neg" },
      { label: "Customer", value: -dAdj.customer, kind: "neg" },
      { label: "Product", value: -dAdj.product, kind: "neg" },
      { label: "Volume", value: -dAdj.volume, kind: "neg" },
      { label: "Other/Value", value: -dAdj.other_sales, kind: "neg" },
      { label: "Mandatory", value: -dAdj.mandatory, kind: "neg" },
      { label: "Local", value: -dAdj.local, kind: "neg" },
      { label: "Invoiced", value: 0, kind: "subtotal" },
      { label: "Reb. Direct", value: -base.r.direct, kind: "neg" },
      { label: "Reb. Prompt", value: -base.r.prompt, kind: "neg" },
      { label: "Reb. Indirect", value: -base.r.indirect, kind: "neg" },
      { label: "Reb. Mandatory", value: -base.r.mandatory, kind: "neg" },
      { label: "Reb. Local", value: -base.r.local, kind: "neg" },
      { label: "Net", value: 0, kind: "subtotal" },
    ];

    return { netUplift, stepsAdj, t, dAdj };
  }, [tweaks, base]);

  const resetTweaks = () => setTweaks({});

  /* ===== UI ===== */
  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Waterfall – Gross → Net</h1>
          <p className="text-sm text-gray-600">
            Invoiced = <b>Gross − Discounts</b> · Net = <b>Invoiced − Rebates</b>.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/consistency" className="text-sm rounded-lg border px-3 py-2 hover:bg-gray-50">Consistency</Link>
          <Link href="/app/upload" className="text-sm rounded-lg border px-3 py-2 hover:bg-gray-50">Upload</Link>
        </div>
      </header>

      {/* KPI’s + scenario uplift */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Gross Sales" value={eur0(base.gross)} />
        <KpiCard title="Total Discounts" value={`${eur0(base.totalDisc)}  (${pct(base.totalDisc, base.gross)})`} />
        <KpiCard title="Invoiced Sales" value={eur0(base.invoiced)} />
        <KpiCard title="Total Rebates" value={`${eur0(base.totalReb)}  (${pct(base.totalReb, base.gross)})`} />
      </section>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Scenario uplift (Net)" value={`${adj.netUplift >= 0 ? "+" : ""}${eur0(adj.netUplift)}`} />
        <div className="rounded-2xl border bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">Tweaks actief</div>
            <div className="text-lg font-semibold mt-1">
              {Object.values(adj.t).some((v) => v > 0) ? "Ja" : "Nee"}
            </div>
          </div>
          <button onClick={resetTweaks} className="btn text-sm rounded-lg border px-3 py-2 hover:bg-gray-50">
            Scenario reset
          </button>
        </div>
      </section>

      {/* Chart: alleen intern horizontaal scrollen op mobiel */}
      <section className="rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Margebrug {Object.values(adj.t).some((v) => v > 0) ? "(scenario)" : "(baseline)"}
          </h2>
        </div>
        <div className="mt-2 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}>
          <div className="min-w-[760px]">
            <WaterfallChart steps={Object.values(adj.t).some((v) => v > 0) ? adj.stepsAdj : base.steps} grossTotal={base.gross} />
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">Swipe/scroll horizontaal op mobiel; labels blijven zichtbaar.</p>
      </section>

      {/* Buckets GRID (interactief in de cards) */}
      <section className="rounded-2xl border bg-white p-4">
        <h3 className="text-base font-semibold">Kortings-buckets — gerichte reductie</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {base.buckets.map((b) => {
            const current = clamp((tweaks as any)[b.key] ?? 0, 0, 0.2);
            const after = b.value * (1 - current);
            const uplift = b.value - after;
            return (
              <article key={b.key} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{b.key}</div>
                  <div className="text-gray-600">{pct(b.value, base.gross)}</div>
                </div>
                <div className="mt-1 text-gray-800">{eur0(b.value)}</div>

                <div className="mt-3">
                  <label className="text-xs text-gray-700 flex items-center justify-between">
                    <span>Verlaag {b.key}</span>
                    <span className="font-medium">{(current * 100).toFixed(0)}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={0.2}
                    step={0.01}
                    value={current}
                    onChange={(e) => setTweaks((s) => ({ ...s, [b.key]: clamp(Number(e.target.value), 0, 0.2) }))}
                    className="w-full"
                  />
                  <div className="mt-1 text-xs text-gray-600">
                    +{eur0(uplift)} Net • Nieuwe bucket: {eur0(after)} ({pct(after, base.gross)})
                  </div>
                </div>

                <ul className="mt-3 text-sm text-gray-700 space-y-1">
                  {b.key === "Customer" && (
                    <>
                      <li>• Heronderhandel: deel front-end → bonus</li>
                      <li>• Floor/cap per segment, kwartaalreview</li>
                    </>
                  )}
                  {b.key === "Volume" && (
                    <>
                      <li>• Front-end → bonus achteraf</li>
                      <li>• Strakke staffels per account</li>
                    </>
                  )}
                  {b.key === "Channel" && (
                    <>
                      <li>• Uniformeer kanaalcondities</li>
                      <li>• Beperk uitzonderingen via deal-desk</li>
                    </>
                  )}
                  {b.key === "Product" && (
                    <>
                      <li>• Herijk listprijs/positionering</li>
                      <li>• Differentieer per kanaal/segment</li>
                    </>
                  )}
                  {b.key === "Other/Value" && (
                    <>
                      <li>• Consolideer overige korting</li>
                      <li>• Stop ad-hoc deals, maak eigenaar</li>
                    </>
                  )}
                  {b.key === "Mandatory" && (
                    <>
                      <li>• Juridisch gedreven: optimaliseer elders</li>
                    </>
                  )}
                  {b.key === "Local" && (
                    <>
                      <li>• Standaardiseer lokale uitzonderingen</li>
                      <li>• Centrale goedkeuring & kwartaalreview</li>
                    </>
                  )}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      {/* Top 3 klanten & SKU’s */}
      <section className="grid md:grid-cols-2 gap-4">
        <CardList
          title="Top 3 klanten – hoogste discount spend"
          items={base.topCustomers.map((c) => ({
            title: c.cust,
            right: eur0(c.disc),
            lines: [
              `Korting: ${pct(c.disc, c.gross)} (${c.delta >= 0 ? "+" : ""}${c.delta.toFixed(1)} pp vs benchmark)`,
              `Omzet: ${eur0(c.gross)}`,
            ],
            action:
              c.delta > 5
                ? "Heronderhandel: verlaag front-end, verschuif naar bonus."
                : c.delta > 2
                ? "Normaliseer condities; beperk uitzonderingen."
                : "Monitor: binnen bandbreedte.",
          }))}
        />
        <CardList
          title="Top 3 SKU’s – hoogste discount spend"
          items={base.topSkus.map((s) => ({
            title: s.sku,
            right: eur0(s.disc),
            lines: [`Korting: ${pct(s.disc, s.gross)}`, `Omzet: ${eur0(s.gross)}`],
            action: s.flag
              ? "Herijk listprijs/positionering; verminder structurele kortingen."
              : "Maak korting variabeler: bonus i.p.v. standaardkorting.",
          }))}
        />
      </section>

      {/* Samenvatting */}
      <section className="rounded-2xl border bg-white p-4">
        <h3 className="text-base font-semibold">Aanbevolen acties</h3>
        <ul className="list-disc pl-5 mt-2 text-sm text-gray-700 space-y-1">
          <li><b>Customer</b>: floor/cap per segment; deel front-end → bonus op realisatie.</li>
          <li><b>Volume</b>: vervang deel front-end door performance-bonussen met staffels.</li>
          <li><b>Product</b>: herijk listprijs/positionering; differentieer per kanaal/segment.</li>
          <li><b>Local/Other</b>: consolideer uitzonderingen; centrale governance.</li>
        </ul>
      </section>
    </div>
  );
}

/* ========= UI subcomponenten ========= */
function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-lg font-semibold mt-1 break-words">{value}</div>
    </div>
  );
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
            <div className="mt-1 text-gray-600 break-words">{it.lines.join(" • ")}</div>
            <div className="mt-2 text-gray-700">
              <span className="font-medium">Actie:</span> {it.action}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
