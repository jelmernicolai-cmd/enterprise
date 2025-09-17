// components/contracts/ContractCharts.tsx
"use client";
import type { TotalRow } from "../../lib/contract-analysis";

/* ---------- kleine helpers ---------- */
function num(v: unknown, def = 0) {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : def;
}
function sortByPeriodKey(rows: TotalRow[]) {
  // Verwacht YYYY-MM of MM-YYYY in periodKey; we proberen beide
  return [...rows].sort((a, b) => {
    const A = (a as any).periodKey as string;
    const B = (b as any).periodKey as string;
    const pa =
      /^\d{4}-\d{2}$/.test(A) ? new Date(A + "-01") :
      /^\d{2}-\d{4}$/.test(A) ? new Date(A.slice(3) + "-" + A.slice(0,2) + "-01") :
      new Date(NaN);
    const pb =
      /^\d{4}-\d{2}$/.test(B) ? new Date(B + "-01") :
      /^\d{2}-\d{4}$/.test(B) ? new Date(B.slice(3) + "-" + B.slice(0,2) + "-01") :
      new Date(NaN);
    return pa.getTime() - pb.getTime();
  });
}

/* ---------- simpele lijnchart (responsive) ---------- */
function LineChart({
  x,
  y,
  height = 160,
}: {
  x: string[];
  y: number[];
  height?: number;
}) {
  const width = 700;
  const pad = 24;

  const xs = x.map((_, i) => pad + (i * (width - 2 * pad)) / Math.max(1, x.length - 1));
  const minY = Math.min(...y);
  const maxY = Math.max(...y);
  const sy = (v: number) =>
    maxY === minY ? height / 2 : (height - pad) - ((v - minY) * (height - 2 * pad)) / (maxY - minY);
  const d = y.map((v, i) => `${i ? "L" : "M"} ${xs[i]} ${sy(v)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-lg border bg-white">
      <path d={d} fill="none" stroke="currentColor" className="text-gray-800" strokeWidth={2} />
      {x.map((lbl, i) =>
        i % Math.ceil(Math.max(1, x.length) / 6) === 0 ? (
          <text
            key={i}
            x={xs[i]}
            y={height - 4}
            fontSize="10"
            textAnchor="middle"
            className="fill-gray-500"
          >
            {lbl}
          </text>
        ) : null
      )}
    </svg>
  );
}

export default function ContractCharts({
  totals,
  topContracts,
  seriesByContract,
}: {
  totals: TotalRow[];
  topContracts: string[];
  seriesByContract: Record<string, { x: string[]; y: number[] }>;
}) {
  // Zorg voor chronologische x-as en lees totalen defensief
  const sortedTotals = sortByPeriodKey(totals);
  const x = sortedTotals.map((t: any) => t.periodKey as string);
  const y = sortedTotals.map((t: any) =>
    num(
      t.totalNetto ?? t.totaal_netto ?? t.total ?? t.netto ?? 0
    )
  );

  // Toon alleen bestaande series & align veilig
  const safeTop = topContracts.filter((c) => seriesByContract[c]?.x?.length);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="mb-2 text-sm font-medium text-gray-700">Totaal netto-omzet per maand</div>
        <LineChart x={x} y={y} />
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-gray-700">
          Top contracten – netto-omzet (tijdreeks)
        </div>
        <div className="space-y-4">
          {safeTop.map((c) => {
            const s = seriesByContract[c];
            return (
              <div key={c}>
                <div className="mb-1 text-xs text-gray-500">{c}</div>
                <LineChart x={s.x} y={s.y.map((v) => num(v))} height={120} />
              </div>
            );
          })}
          {safeTop.length === 0 && (
            <div className="text-xs text-gray-500">Geen tijdreeksen beschikbaar voor de geselecteerde contracten.</div>
          )}
        </div>
      </div>
    </div>
  );
}
