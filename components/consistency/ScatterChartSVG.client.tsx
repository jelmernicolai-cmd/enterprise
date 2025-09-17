'use client';

import React, { useMemo } from 'react';

type Pt = { x: number; y: number; label: string; size?: number };

function lr(points: Pt[]) {
  // Least squares: y = a + b x
  const n = Math.max(1, points.length);
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of points) { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; }
  const denom = n * sxx - sx * sx || 1;
  const b = (n * sxy - sx * sy) / denom;
  const a = (sy - b * sx) / n;
  return { a, b };
}

export default function ScatterChartSVG({
  points,
  width = 720,
  height = 260,
  padding = 36,
  xLabel = 'Omzet-aandeel (%)',
  yLabel = 'Discount / Gross (%)',
  decimals = 1,
}: {
  points: Pt[];
  width?: number;
  height?: number;
  padding?: number;
  xLabel?: string;
  yLabel?: string;
  decimals?: number;
}) {
  if (!points.length) return null;

  const xMaxData = Math.max(...points.map(p => p.x), 0);
  const yMaxData = Math.max(...points.map(p => p.y), 0);
  const xMax = Math.ceil(Math.max(10, xMaxData) / 5) * 5;
  const yMax = Math.ceil(Math.max(5, yMaxData) / 5) * 5;

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const mapX = (x: number) => padding + (x / Math.max(1e-9, xMax)) * innerW;
  const mapY = (y: number) => padding + (1 - y / Math.max(1e-9, yMax)) * innerH;

  const { a, b } = useMemo(() => lr(points), [points]);
  const tl = { x: 0, y: a };
  const tr = { x: xMax, y: a + b * xMax };

  const xTicks = Array.from({ length: 6 }, (_, i) => (i * xMax) / 5);
  const yTicks = Array.from({ length: 6 }, (_, i) => (i * yMax) / 5);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Discount vs Omzet scatter">
        {/* grid + ticks */}
        {yTicks.map((t, i) => (
          <g key={'gy'+i}>
            <line x1={padding} x2={width - padding} y1={mapY(t)} y2={mapY(t)} stroke="#e5e7eb" />
            <text x={4} y={mapY(t) + 3} fontSize="10" fill="#6b7280">{t.toFixed(decimals).replace('.', ',')}%</text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <g key={'gx'+i}>
            <line x1={mapX(t)} x2={mapX(t)} y1={padding} y2={height - padding} stroke="#f1f5f9" />
            <text x={mapX(t)} y={height - padding + 12} fontSize="10" fill="#6b7280" textAnchor="middle">
              {t.toFixed(0)}%
            </text>
          </g>
        ))}

        {/* axes */}
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="#9ca3af" />
        <line x1={padding} x2={padding} y1={padding} y2={height - padding} stroke="#9ca3af" />
        <text x={width/2} y={height - 4} fontSize="11" fill="#374151" textAnchor="middle">{xLabel}</text>
        <text x={12} y={padding - 10} fontSize="11" fill="#374151">{yLabel}</text>

        {/* trendline */}
        <line
          x1={mapX(tl.x)} y1={mapY(Math.max(0, tl.y))}
          x2={mapX(tr.x)} y2={mapY(Math.max(0, tr.y))}
          stroke="#0ea5e9" strokeWidth={2}
        />

        {/* points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={mapX(p.x)}
              cy={mapY(Math.max(0, p.y))}
              r={Math.max(3, Math.min(10, (p.size || 1) * 6))}
              fill="#10b981"
              opacity={0.85}
            />
            <title>{`${p.label}\nOmzet-aandeel: ${p.x.toFixed(1)}%\nDiscount: ${p.y.toFixed(decimals)}%`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}
