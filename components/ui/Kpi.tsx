// components/ui/Kpi.tsx
export function Kpi({label, value, hint}:{label:string; value:string; hint?:string}){
  return (
    <div className="card p-4">
      <div className="text-[12px] text-[rgb(var(--muted))]">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      {hint && <div className="text-[11px] text-[rgb(var(--muted))] mt-1">{hint}</div>}
    </div>
  );
}
