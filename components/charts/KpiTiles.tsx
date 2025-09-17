'use client';

type KPI = { label: string; value: string; hint?: string };

export default function KpiTiles({ data }: { data: KPI[] }) {
  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
      {data.map((k, i) => (
        <div key={i} className="rounded border p-4">
          <div className="text-sm text-gray-500">{k.label}</div>
          <div className="text-2xl font-semibold mt-1">{k.value}</div>
          {k.hint && <div className="text-xs text-gray-500 mt-1">{k.hint}</div>}
        </div>
      ))}
    </div>
  );
}
