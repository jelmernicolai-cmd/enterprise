// components/ui/States.tsx
export const Empty = ({title,desc,action}:{title:string;desc?:string;action?:React.ReactNode})=>(
  <div className="card p-6 text-center">
    <div className="text-sm font-medium">{title}</div>
    {desc && <div className="text-sm text-[rgb(var(--muted))] mt-1">{desc}</div>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);
export const Loading = () => <div className="card p-6 animate-pulse text-sm text-[rgb(var(--muted))]">Laden…</div>;
export const ErrorNote = ({msg}:{msg:string}) => (
  <div className="border border-[rgb(var(--err))]/20 bg-[color-mix(in_srgb,rgb(var(--err))_6%,white)] text-[rgb(var(--err))]
              px-3 py-2 rounded-md text-sm">{msg}</div>
);
