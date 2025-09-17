// components/charts/Waterfall.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Step = { label: string; delta: number }; // delta < 0 = omlaag, > 0 = omhoog
type Props = {
  start: number;
  steps: Step[];
  /** Vast hoogte; breedte schaalt automatisch tot containerbreedte */
  height?: number; // default 280
  /** Eigen formatter (EUR) */
  currencyFmt?: (v: number) => string;
};

export default function Waterfall({
  start,
  steps,
  height = 280,
  currencyFmt = (v) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(v),
}: Props) {
  // Meet containerbreedte -> responsive chart
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(680);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setWidth(Math.max(280, Math.floor(w))); // minimale bruikbare breedte
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Dynamische paddings voor smalle schermen
  const padding = useMemo(() => {
    if (width < 380) return { top: 10, right: 10, bottom: 28, left: 44 };
    if (width < 520) return { top: 12, right: 12, bottom: 32, left: 52 };
    return { top: 16, right: 16, bottom: 40, left: 60 };
  }, [width]);

  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  // Cumulatief
  const cum: number[] = [start];
  for (const s of steps) cum.push(cum[cum.length - 1] + s.delta);
  const end = cum[cum.length - 1];

  const maxY = Math.max(start, end, ...cum);
  const minY = Math.min(0, ...cum);
  const yRange = Math.max(1, maxY - minY);
  const y = (v: number) => padding.top + innerH - ((v - minY) / yRange) * innerH;

  const n = steps.length + 2; // start + steps + end
  const colW = innerW / n;
  const barW = colW * 0.7;
  const x = (i: number) => padding.left + i * colW + (colW - barW) / 2;

  type Bar = {
    x: number; y: number; w: number; h: number;
    color: string; label: string; value: number; isTotal?: boolean;
  };
  const bars: Bar[] = [];

  // Start (Gross)
  {
    const y0 = y(0), y1 = y(start);
    bars.push({
      x: x(0),
      y: Math.min(y0, y1),
      w: barW,
      h: Math.max(1, Math.abs(y1 - y0)),
      color: "#16a34a",
      label: "Gross",
      value: start,
      isTotal: true,
    });
  }

  // Steps
  steps.forEach((s, i) => {
    const from = cum[i];
    const to = from + s.delta;
    const y1 = y(from);
    const y2 = y(to);
    bars.push({
      x: x(i + 1),
      y: Math.min(y1, y2),
      w: barW,
      h: Math.max(1, Math.abs(y2 - y1)),
      color: s.delta < 0 ? "#dc2626" : "#2563eb",
      label: s.label,
      value: s.delta,
    });
  });

  // End (Net)
  {
    const y0 = y(0), y1 = y(end);
    bars.push({
      x: x(n - 1),
      y: Math.min(y0, y1),
      w: barW,
      h: Math.max(1, Math.abs(y1 - y0)),
      color: "#16a34a",
      label: "Net",
      value: end,
      isTotal: true,
    });
  }

  // Kleiner lettertype op small screens
  const valueFont = width < 380 ? 9 : width < 520 ? 10 : 11;
  const xFont = width < 380 ? 9 : 11;

  return (
    <div ref={wrapRef} className="w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Waterfall chart"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Nul-lijn */}
        <line
          x1={8}
          x2={width - 8}
          y1={y(0)}
          y2={y(0)}
          stroke="#e5e7eb"
          strokeWidth={1}
        />

        {/* Bars + labels */}
        {bars.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill={b.color} />
            {/* Value label boven bar (met lichte marge, maar niet buiten canvas) */}
            <text
              x={b.x + b.w / 2}
              y={Math.max(12, b.y - 6)}
              textAnchor="middle"
              fontSize={valueFont}
              fill="#374151"
            >
              {b.isTotal
                ? currencyFmt(b.value)
                : (b.value < 0 ? "-" : "+") + currencyFmt(Math.abs(b.value))}
            </text>
            {/* X-label (ellipsize bij smal) */}
            <text
              x={b.x + b.w / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize={xFont}
              fill="#6b7280"
            >
              {width < 360 && b.label.length > 10 ? b.label.slice(0, 9) + "…" : b.label}
            </text>
          </g>
        ))}

        {/* Y-as ticks: min / 0 / max */}
        {[minY, 0, maxY].map((v, i) => (
          <g key={`tick-${i}`}>
            <text x={8} y={y(v) + 4} fontSize={10} fill="#6b7280">
              {currencyFmt(v)}
            </text>
            <line x1={padding.left - 6} x2={padding.left} y1={y(v)} y2={y(v)} stroke="#9ca3af" />
          </g>
        ))}
      </svg>
    </div>
  );
}
