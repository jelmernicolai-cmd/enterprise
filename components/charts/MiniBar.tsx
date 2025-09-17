// components/charts/MiniBar.tsx
"use client";
import React from "react";

type Props = {
  values: number[];
  labels?: string[];
  width?: number;
  height?: number;
  padding?: number;
  gap?: number;
  valueFmt?: (v: number) => string;
  tooltip?: (i: number, v: number, l?: string) => string;
  className?: string; // kleur/style via parent
  showBaseline?: boolean; // baseline op 0
};

export default function MiniBar({
  values,
  labels,
  width = 280,
  height = 90,
  padding = 8,
  gap = 2,
  valueFmt = (v) => v.toFixed(1),
  tooltip,
  className,
  showBaseline = true,
}: Props) {
  if (!values || !values.length) return null;

  const w = width, h = height, pad = padding;
  const innerW = w - pad * 2;
  const n = values.length;

  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(0, ...values);
  const span = maxVal - minVal || 1;

  const scaleY = (v: number) => pad + ((maxVal - v) / span) * (h - pad * 2);
  const zeroY = scaleY(0);

  const barW = Math.max(1, (innerW - gap * (n - 1)) / n);

  return (
    <svg
      width={w}
      height={h}
      role="img"
      aria-label="Mini bar chart"
      className={className}
    >
      {/* Baseline/grid in subtiele tint */}
      {showBaseline && (
        <line
          x1={pad}
          x2={w - pad}
          y1={zeroY}
          y2={zeroY}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1}
        />
      )}

      {/* Bars volgen parent text color */}
      {values.map((v, i) => {
        const x = pad + i * (barW + gap);
        const y = v >= 0 ? scaleY(v) : zeroY;
        const bh = Math.max(1, Math.abs(scaleY(v) - zeroY));

        const tt = tooltip
          ? tooltip(i, v, labels?.[i])
          : `${labels?.[i] ?? `#${i + 1}`}: ${valueFmt(v)}`;

        return (
          <g key={i}>
            <title>{tt}</title>
            <rect x={x} y={y} width={barW} height={bh} fill="currentColor" rx={2} />
          </g>
        );
      })}
    </svg>
  );
}
