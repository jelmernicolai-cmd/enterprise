"use client";
import React from "react";

export default function Sparkline({
  data,
  width = 280,
  height = 60,
  strokeWidth = 2,
  padding = 6,
  format = (v: number) => v.toFixed(1) + "%",
  className,                 // ✨ nieuw: kleur/style zet je buitenaf
  showBaseline = true,       // optioneel
  showDot = true,            // optioneel
}: {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  padding?: number;
  format?: (v: number) => string;
  className?: string;
  showBaseline?: boolean;
  showDot?: boolean;
}) {
  if (!data.length) return null;

  const w = width, h = height, pad = padding;
  const xs = data.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1));
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const ys = data.map(v => h - pad - ((v - min) / span) * (h - pad * 2));
  const d = xs.map((x, i) => `${i ? "L" : "M"} ${x.toFixed(2)} ${ys[i].toFixed(2)}`).join(" ");
  const last = data[data.length - 1];

  return (
    <svg
      width={w}
      height={h}
      role="img"
      aria-label={`Sparkline, laatste: ${format(last)}`}
      className={className}  // ← kleur via parent (currentColor)
    >
      {/* Lijn volgt parent text color */}
      <path d={d} fill="none" stroke="currentColor" strokeWidth={strokeWidth} />

      {/* Baseline in een subtiele tint van dezelfde kleur */}
      {showBaseline && (
        <line
          x1={pad}
          x2={w - pad}
          y1={h - pad}
          y2={h - pad}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1}
        />
      )}

      {/* Punt op de laatste waarde */}
      {showDot && (
        <circle
          cx={xs[xs.length - 1]}
          cy={ys[ys.length - 1]}
          r={3}
          fill="currentColor"
        />
      )}
    </svg>
  );
}
