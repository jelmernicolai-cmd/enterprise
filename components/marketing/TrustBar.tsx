export default function TrustBar() {
  return (
    <section className="w-full bg-slate-50 border-y">
      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          Vertrouwd door farma-teams in NL & EU • EU-hosting • ISO-compliant werkwijze • Dataminimalisatie
        </p>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <span className="rounded-full border px-3 py-1 bg-white">Audit trail</span>
          <span className="rounded-full border px-3 py-1 bg-white">RBAC</span>
          <span className="rounded-full border px-3 py-1 bg-white">Exports</span>
        </div>
      </div>
    </section>
  );
}
