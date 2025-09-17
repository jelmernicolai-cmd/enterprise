"use client";

import { useMemo } from "react";
import { loadWaterfallRows } from "@/lib/waterfall-storage";
import type { Row } from "@/lib/waterfall-types";
import { useBenchmarks } from "@/components/consistency/BenchmarksContext";

export default function ConsistencyTrendPage() {
  const rows: Row[] = loadWaterfallRows();
  const { method } = useBenchmarks();

  const discOf = (r: Row) =>
    (r.d_channel || 0) +
    (r.d_customer || 0) +
    (r.d_product || 0) +
    (r.d_volume || 0) +
    (r.d_other_sales || 0) +
    (r.d_mandatory || 0) +
    (r.d_local || 0);

  const { periods, seriesPct, benchPct } = useMemo(() => {
    const byPeriod = new Map<string, { gross: number; disc: number }>();
    const byCustomerPeriod = new Map<string, Map<string, { gross: number; disc: number }>>();

    for (const r of rows) {
      const g = r.gross || 0;
      const d = discOf(r);
      const p = r.period || "—";
      const cust = r.cust || "—";

      const agg = byPeriod.get(p) || { gross: 0, disc: 0 };
      agg.gross += g;
      agg.disc += d;
      byPeriod.set(p, agg);

      const cm = byCustomerPeriod.get(p) || new Map();
      const cc = cm.get(cust) || { gross: 0, disc: 0 };
      cc.gross += g;
      cc.disc += d;
      cm.set(cust, cc);
      byCustomerPeriod.set(p, cm);
    }

    const periods = [...byPeriod.keys()].sort();

    const overallPctPerPeriod = periods.map((p) => {
      const v = byPeriod.get(p)!;
      return v.gross ? (v.disc / v.gross) * 100 : 0;
    });

    const medianPctPerPeriod = periods.map((p) => {
      const cm = byCustomerPeriod.get(p)!;
      const arr = [...cm.values()]
        .map((v) => (v.gross ? (v.disc / v.gross) * 100 : 0))
        .sort((a, b) => a - b);
      if (!arr.length) return 0;
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    });

    const seriesPct = method === "median" ? medianPctPerPeriod : overallPctPerPeriod;

    const benchPct =
      seriesPct.reduce((a, b) => a + b, 0) / (seriesPct.length || 1);

    return { periods, seriesPct, benchPct };
  }, [rows, method]);

  if (!rows.length) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        Geen data gevonden. Ga naar Upload om data toe te voegen.
      </div>
    );
  }

  const Spark = ({
    data,
    w = 640,
    h = 120,
  }: {
    data: number[];
    w?: number;
    h?: number;
  }) => {
    const pad = 8;
    const xs = data.map(
      (_, i) => pad + (i * (w - 2 * pad)) / Math.max(1, data.length - 1)
    );
    const min = Math.min(...data, 0);
    const max = Math.max(...data, 1);
    const ys = data.map(
      (v) => h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad)
    );
    const d =
      data.length > 0
        ? data.map((_, i) => `${i ? "L" : "M"} ${xs[i]} ${ys[i]}`).join(" ")
        : "";

    return (
      <svg className="w-full" viewBox={`0 0 ${w} ${h}`} height={h} role="img" aria-label="Sparkline">
        <polyline
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="1"
          points={`${pad},${h - pad} ${w - pad},${h - pad}`}
        />
        {d && <path d={d} fill="none" stroke="#0ea5e9" strokeWidth="2" />}
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Consistency – Trend</h1>
        <p className="text-gray-600 text-sm">
          Methode: <b>{method === "median" ? "Median" : "Overall"}</b> • Gemiddelde benchmark:{" "}
          {benchPct.toFixed(1)}%
        </p>
      </header>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-semibold mb-2">Korting% per periode</h2>
        <Spark data={seriesPct} />
        <div className="mt-2 text-xs text-gray-600">{periods.join(" · ")}</div>
      </section>
    </div>
  );
}
