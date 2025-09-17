'use client';

type Heat = { rows: string[]; cols: string[]; values: number[][] };

export default function ParallelPressureHeatmap({ data }: { data: Heat }) {
  const max = Math.max(...data.values.flat().map((v) => Math.abs(v) || 0), 1);
  return (
    <div className="rounded border p-4 overflow-x-auto">
      <h3 className="font-semibold mb-2">Parallel Pressure Heatmap</h3>
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="border px-2 py-1 text-left"> </th>
            {data.cols.map((c) => (
              <th key={c} className="border px-2 py-1 text-sm">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, ri) => (
            <tr key={r}>
              <th className="border px-2 py-1 text-sm text-left">{r}</th>
              {data.values[ri].map((v, ci) => {
                const intensity = Math.min(100, Math.round((Math.abs(v) / max) * 100));
                const bg = `hsl(210 80% ${100 - intensity/1.5}%)`;
                return (
                  <td key={ci} className="border px-2 py-1 text-xs" style={{ backgroundColor: bg }}>
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
