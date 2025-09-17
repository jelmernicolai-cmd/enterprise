'use client';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Point = { x: number; y: number; label?: string };

export default function ConsistencyScatter({ data }: { data: Point[] }) {
  return (
    <div className="rounded border p-4">
      <h3 className="font-semibold mb-2">Korting% vs. inkoopwaarde</h3>
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" name="Inkoopwaarde" />
            <YAxis dataKey="y" name="Korting%" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
