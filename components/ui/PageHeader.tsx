// components/ui/PageHeader.tsx
export default function PageHeader({title, subtitle, actions}:{
  title:string; subtitle?:string; actions?:React.ReactNode;
}){
  return (
    <div className="card px-5 py-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="ml-auto">{actions}</div>
      </div>
      {subtitle && <p className="mt-1 text-sm text-[rgb(var(--muted))]">{subtitle}</p>}
    </div>
  );
}
