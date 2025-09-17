"use client";

import { useEffect, useRef, useState } from "react";

type Step = { label: string; amount: number; color?: string };

function toCurrency(n: number) {
  return n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

/** Responsive breedtemeting met SSR/TS-safe guards (globalThis i.p.v. window) */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const cw = el.clientWidth || el.getBoundingClientRect().width || 0;
      if (cw) setW(cw);
    };

    measure();

    // 1) Prefer ResizeObserver als beschikbaar (client-only)
    const RO = (globalThis as any)?.ResizeObserver;
    if (typeof RO === "function") {
      const ro = new RO(() => measure());
      ro.observe(el);
      return () => ro.disconnect();
    }

    // 2) Fallback: resize event op globalThis (alleen als API bestaat)
    const gt: any = globalThis as any;
    if (gt && typeof gt.addEventListener === "function") {
      const onResize = () => measure();
      gt.addEventListener("resize", onResize);
      return () => gt.removeEventListener("resize", onResize);
    }

    // 3) SSR/no-op fallback
    return;
  }, []);

  return { ref, width: w };
}

export default function WaterfallChart({ steps }: { steps: Step[] }) {
  // Cumulatief opbouwen
  const cumul: number[] = [0];
  for (const s of steps) cumul.push(cumul[cumul.length - 1] + s.amount);

  const all = [...cumul];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.1 || 1;
  const y0 = min - pad;
  const y1 = max + pad;

  // Responsive: meet containerbreedte
  const { ref, width } = useSize<HTMLDivElement>();
  const W = Math.max(280, width || 360);
  const rowH = W < 400 ? 28 : 34;
  const H = steps.length * rowH + 56;

  const leftPad = Math.max(56, Math.min(120, Math.round(W * 0.22)));
  const rightPad = 16;
  const fontMain = W < 380 ? 10 : 12;
  const fontTick = W < 380 ? 10 : 11;

  const scaleX = (v: number) => {
    const inner = W - leftPad - rightPad;
    return leftPad + ((v - y0) / (y1 - y0)) * inner;
  };

  const hideValues = W < 340;
  const short = (s: string) =>
    s.length <= 18 ? s : s.replace("Other/Value", "Other").replace("Mandatory", "Mand.").slice(0, 16) + "…";

  return (
    <div ref={ref} className="w-full max-w-full overflow-hidden">
      <svg
        className="block w-full h-auto"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Waterfall Gross → Net"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* 0-lijn */}
        <line x1={scaleX(0)} y1={20} x2={scaleX(0)} y2={H - 20} stroke="#e5e7eb" strokeWidth="1" />

        {/* Linker labels */}
        {steps.map((s, i) => (
          <text
            key={`lbl-${i}`}
            x={8}
            y={28 + i * rowH + rowH / 2}
            dominantBaseline="middle"
            fontSize={fontMain}
            fill="#374151"
          >
            {short(s.label)}
          </text>
        ))}

        {/* Bars + eindwaarden (nooit buiten beeld) */}
        {steps.map((s, i) => {
          const start = cumul[i];
          const end = cumul[i + 1];
          const x1 = scaleX(Math.min(start, end));
          const x2 = scaleX(Math.max(start, end));
          const w = Math.max(2, x2 - x1);
          const y = 28 + i * rowH + (rowH - 20) / 2;
          const fill = s.color || (s.amount >= 0 ? "#16a34a" : "#dc2626");

          const labelRightRoom = W - rightPad - (x2 + 6);
          const placeLeft = labelRightRoom < 60;

          return (
            <g key={`bar-${i}`}>
              <rect x={x1} y={y} width={w} height={20} fill={fill} opacity="0.9" rx="4" />
              {!hideValues && (
                <text
                  x={placeLeft ? x1 - 6 : x2 + 6}
                  y={y + 10}
                  dominantBaseline="middle"
                  fontSize={fontMain - 1}
                  fill="#374151"
                  textAnchor={placeLeft ? "end" : "start"}
                >
                  {toCurrency(end)}
                </text>
              )}
            </g>
          );
        })}

        {/* As-waarden */}
        {[min, 0, max].map((tick, i) => (
          <g key={`tick-${i}`}>
            <line x1={scaleX(tick)} y1={20} x2={scaleX(tick)} y2={H - 20} stroke="#f3f4f6" />
            <text x={scaleX(tick)} y={H - 6} fontSize={fontTick} textAnchor="middle" fill="#6b7280">
              {toCurrency(tick)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
