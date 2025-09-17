"use client";

import { useBenchmarks } from "./BenchmarksContext";

export default function BenchmarkControls() {
  const { method, majorPP, minorPP, setMethod, setMajorPP, setMinorPP } = useBenchmarks();

  return (
    <div className="rounded-xl border bg-white p-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm font-medium">Benchmark</div>
        <label className="inline-flex items-center gap-1 text-sm">
          <input
            type="radio"
            name="bm"
            className="accent-sky-600"
            checked={method === "median"}
            onChange={() => setMethod("median")}
          />
          Median (robuust)
        </label>
        <label className="inline-flex items-center gap-1 text-sm">
          <input
            type="radio"
            name="bm"
            className="accent-sky-600"
            checked={method === "overall"}
            onChange={() => setMethod("overall")}
          />
          Overall (gewogen)
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between text-sm">
            <span>Grote afwijking drempel</span>
            <span className="font-medium">{majorPP.toFixed(1)} pp</span>
          </div>
          <input
            type="range"
            min={0}
            max={15}
            step={0.5}
            value={majorPP}
            onChange={(e) => setMajorPP(Number(e.target.value))}
            className="w-full accent-sky-600"
          />
          <div className="text-xs text-gray-500 mt-1">
            Boven deze drempel markeren we klanten/perioden als “hoog risico”.
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm">
            <span>Lichte afwijking drempel</span>
            <span className="font-medium">{minorPP.toFixed(1)} pp</span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={minorPP}
            onChange={(e) => setMinorPP(Number(e.target.value))}
            className="w-full accent-sky-600"
          />
          <div className="text-xs text-gray-500 mt-1">
            Tussen {minorPP.toFixed(1)} en {majorPP.toFixed(1)} pp = “normaliseren”.
          </div>
        </div>
      </div>
    </div>
  );
}
