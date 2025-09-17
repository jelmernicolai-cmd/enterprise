"use client";

import { useMemo, useState } from "react";
import { loadWaterfallRows, eur0 } from "@/lib/waterfall-storage";
import type { Row } from "@/lib/waterfall-types";
import { useBenchmarks } from "@/components/consistency/BenchmarksContext";

export default function ConsistencyCustomersPage() {
  const rows: Row[] = loadWaterfallRows();
  const { method, majorPP, minorPP } = useBenchmarks();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"potential" | "deviation" | "name">("potential");

  const discOf = (r: Row) =>
    (r.d_channel || 0) +
    (r.d_customer || 0) +
    (r.d_product || 0) +
    (r.d_volume || 0) +
    (r.d_other_sales || 0) +
    (r.d_mandatory || 0) +
    (r.d_local || 0);

  const { bench, list } = useMemo(() => {
    let grossTotal = 0, discTotal = 0;
    const byCustomer = new Map<string, { gross: number; disc: number }>();

    for (const r of rows) {
      const g = r.gross || 0;
      const d = discOf(r);
      grossTotal += g; discTotal += d;

      const c = byCustomer.get(r.cust) || { gross: 0, disc: 0 };
      c.gross += g; c.disc += d; byCustomer.set(r.cust, c);
    }

    const overallPct = grossTotal ? (discTotal / grossTotal) * 100 : 0;
    const custPcts = [...byCustomer.values()].map(v => (v.gross ? (v.disc / v.gross) * 100 : 0)).sort((a,b)=>a-b);
    const mid = Math.floor(custPcts.length / 2);
    const medianPct = custPcts.length ? (custPcts.length % 2 ? custPcts[mid] : (custPcts[mid-1]+custPcts[mid])/2) : 0;
    const bench = method === "median" ? medianPct : overallPct;

    const list = [...byCustomer.entries()].map(([cust, v]) => {
      const pct = v.gross ? (v.disc / v.gross) * 100 : 0;
      const deviation = pct - bench;
      const potential = deviation > 0 ? (deviation / 100) * v.gross : 0;
      let tag: "major" | "minor" | "retention" | "ok" = "ok";
      if (deviation > majorPP) tag = "major"; else if (deviation > minorPP) tag = "minor";
      else if (deviation < -minorPP) tag = "retention";
      return { cust, gross: v.gross, discPct: pct, deviation, potential, tag };
    });

    return { bench, list };
  }, [rows, method, majorPP, minorPP]);

  const filtered = list.filter(c =>
    !q || c.cust.toLowerCase().includes(q.toLowerCase())
  ).sort((a, b) => {
    if (sort === "potential") return (b.potential - a.potential);
    if (sort === "deviation") return (b.deviation - a.deviation);
    return a.cust.localeCompare(b.cust);
  });

  if (!rows.length) {
    return <div className="rounded-2xl border bg-white p-6">Geen data gevonden. Ga naar Waterfall → Upload.</div>;
  }

  const Badge = ({ tag }: { tag: string }) => {
    const map: any = {
      major: "bg-red-50 text-red-700 border-red-200",
      minor: "bg-amber-50 text-amber-800 border-amber-200",
      retention: "bg-indigo-50 text-indigo-700 border-indigo-200",
      ok: "bg-gray-50 text-gray-700 border-gray-200",
    };
    return <span className={`text-xs px-2 py-1 rounded-full border ${map[tag] || map.ok}`}>{tag}</span>;
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Consistency – Customers</h1>
          <p className="text-gray-600 text-sm">
            Benchmark {bench.toFixed(1)}% • sorteer op <b>{sort}</b>
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek klant…"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="potential">Sort: Potentieel</option>
            <option value="deviation">Sort: Afwijking</option>
            <option value="name">Sort: Naam</option>
          </select>
        </div>
      </header>

      {/* Tabel op desktop, cards op mobiel */}
      <div className="hidden md:block rounded-2xl border bg-white overflow-x-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead>
            <tr className="text-gray-500">
              <th className="text-left p-2">Klant</th>
              <th className="text-right p-2">Omzet</th>
              <th className="text-right p-2">Korting%</th>
              <th className="text-right p-2">Afwijking (pp)</th>
              <th className="text-right p-2">Potentieel</th>
              <th className="text-right p-2">Label</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.cust} className="border-t">
                <td className="p-2">{c.cust}</td>
                <td className="p-2 text-right">{eur0(c.gross)}</td>
                <td className="p-2 text-right">{c.discPct.toFixed(1)}%</td>
                <td className="p-2 text-right">{c.deviation.toFixed(1)}</td>
                <td className="p-2 text-right">{eur0(c.potential)}</td>
                <td className="p-2 text-right"><Badge tag={c.tag} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden grid gap-3">
        {filtered.map((c) => (
          <div key={c.cust} className="rounded-xl border bg-white p-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="font-medium">{c.cust}</div>
              <div className="ml-auto"><Badge tag={c.tag} /></div>
            </div>
            <div className="mt-1 text-gray-600">Omzet: {eur0(c.gross)}</div>
            <div className="flex justify-between mt-1">
              <div>Korting</div><div>{c.discPct.toFixed(1)}%</div>
            </div>
            <div className="flex justify-between">
              <div>Afwijking</div><div>{c.deviation.toFixed(1)} pp</div>
            </div>
            <div className="flex justify-between">
              <div>Potentieel</div><div>{eur0(c.potential)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
