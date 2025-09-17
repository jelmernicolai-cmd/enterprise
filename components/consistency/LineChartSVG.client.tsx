'use client';

import React from 'react';

type Pt = { x: string; y: number };

export default function LineChartSVG({
  points,
  height = 180,
  padding = 24,
  ySuffix = '%',
  decimals = 1,
}: {
  points: Pt[];
  height?: number;
  padding?: number;
  ySuffix?: string;
  decimals?: number;
}) {
  if (!points.length) return null;

  const width = Math.max(320, points.length * 56);
  const ys = points.map(p => p.y);
  const yMinRaw = Math.min(...ys);
  const yMaxRaw = Math.max(...ys);
  const yPad = (yMaxRaw - yMinRaw) * 0.1 || 1;
  const yMin = Math.floor((yMinRaw - yPad) * 10) / 10;
  const yMax = Math.ceil((yMaxRaw + yPad) * 10) / 10;

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;

  const mapX = (i: number) => padding + i * xStep;
  const mapY = (y: number) => padding + (1 - (y - yMin) / (yMax - yMin)) * innerH;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(i)} ${mapY(p.y)}`).join(' ');

  // grid (4 horizontale lijnen)
  const gridYs = Array.from({ length: 5 }, (_, i) => yMin + (i * (yMax - yMin)) / 4);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Trend chart">
        {/* Grid */}
        {gridYs.map((gy, i) => (
          <g key={i}>
            <line
              x1={padding}
              x2={width - padding}
              y1={mapY(gy)}
              y2={mapY(gy)}
              stroke="#e5e7eb"
              strokeDasharray="4 4"
            />
            <text x={4} y={mapY(gy) + 4} fontSize="10" fill="#6b7280">
              {gy.toFixed(decimals).replace('.', ',')}{ySuffix}
            </text>
          </g>
        ))}

        {/* Line */}
        <path d={path} fill="none" stroke="#0ea5e9" strokeWidth={2} />
        {/* Points */}
        {points.map((p, i) => (
          <circle key={i} cx={mapX(i)} cy={mapY(p.y)} r={3} fill="#0ea5e9" />
        ))}

        {/* X labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={mapX(i)}
            y={height - 2}
            textAnchor="middle"
            fontSize="10"
            fill="#6b7280"
          >
            {p.x}
          </text>
        ))}
      </svg>
    </div>
  );
}
