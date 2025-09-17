// components/charts/Donut.tsx
"use client";
import React from "react";

type Props = {
  value: number;            // 0..100
  label?: string;
  size?: number;            // totale svg size (px)
  stroke?: number;          // donut dikte
  className?: string;       // kleur via parent
  showCenterText?: boolean; // optioneel percentage in center
};

export default function Donut({
  value,
  label = "Donut chart",
  size = 72,
  stroke = 8,
  className,
  showCenterText = false,
}: Props) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${label}: ${pct.toFixed(0)}%`}
      className={className}
    >
      {/* Track in neutrale kleur */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="text-slate-200 dark:text-slate-700"
        stroke="currentColor"
        strokeWidth={stroke}
        fill="none"
      />
      {/* Progress volgt parent text color */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="currentColor"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${dash} ${c - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />

      {showCenterText && (
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="text-[10px] fill-slate-700 dark:fill-slate-200"
        >
          {pct.toFixed(0)}%
        </text>
      )}
    </svg>
  );
}
