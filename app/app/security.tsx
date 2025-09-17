// app/security/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Security",
  description:
    "Veiligheid, privacy en dataminimalisatie in de PharmGtN-portal: client-side verwerking, geen serveropslag en strikte sessiebeveiliging.",
};

/* ========== Icons (inline) ========== */
function Dot(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 8 8" aria-hidden {...props} className={"h-2 w-2 fill-white " + (props.className || "")}>
      <circle cx="4" cy="4" r="4" />
    </svg>
  );
}
function Shield(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={"h-5 w-5 " + (props.className || "")} fill="currentColor">
      <path d="M12 2l8 4v6c0 5-3.4 9.7-8 10-4.6-.3-8-5-8-10V6l8-4z"/>
    </svg>
  );
}
function Lock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={"h-5 w-5 " + (props.className || "")} fill="currentColor">
      <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 016 0v3H9z"/>
    </svg>
  );
}
function Layers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={"h-5 w-5 " + (props.className || "")} fill="currentColor">
      <path d="M12 3l9 5-9 5-9-5 9-5zm0 8l9 5-9 5-9-5 9-5z"/>
    </svg>
  );
}
function FileOk(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={"h-5 w-5 " + (props.className || "")} fill="currentColor">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM8 14l2.5 2.5L16 11l1.5 1.5-7 7-4-4 1.5-1.5zM14 3.5L19.5 9H14V3.5z"/>
    </svg>
  );
}
function Check(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden {...props}>
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.2 7.2a1 1 0 01-1.4 0L3.3 9.1a1 1 0 011.4-1.4l3 3 6.5-6.5a1 1 0 011.4 0z" clipRule="evenodd" />
    </svg>
  );
}

/* ========== Page ========== */
export default function SecurityPage() {
  return (
    <main>
      {/* HERO */}
      <section className="border-b bg-gradient-to-b from-white to-sky-50">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 px-3 py-1 text-xs font-medium text-white">
            <Dot /> Veiligheid & Privacy
          </span>
          <div className="max-w-4xl mx-auto">
            <h1 className="mt-4 text-3xl md:text-5xl font-bold leading-tight">
              Veilig analyseren zonder data-opslag
            </h1>
            <p className="mt-4 text-slate-700">
              PharmGtN verwerkt je gegevens <b>client-side</b>, slaat niets op de server op en gebruikt sessies voor toegang.
              Zo behoud je volledige regie over je data – van upload tot export.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/contact" className="rounded-xl border px-5 py-3 hover:bg-white">
              Security-vragen? Neem contact op
            </Link>
            <Link href="/templates" className="rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-5 py-3 text-white hover:opacity-95">
              Probeer met templates
            </Link>
          </div>
          <p className="mt-3 text-xs text-gray-500">Dataminimalisatie • EU-hosting mogelijk • Transport versleuteld</p>
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3">
            <Layers className="text-sky-700" />
            <div>
              <div className="text-sm font-semibold">Client-side</div>
              <div className="text-xs text-slate-600">Parsing & analyse in de browser</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3">
            <FileOk className="text-sky-700" />
            <div>
              <div className="text-sm font-semibold">Geen serveropslag</div>
              <div className="text-xs text-slate-600">SessionStorage i.p.v. database</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3">
            <Lock className="text-sky-700" />
            <div>
              <div className="text-sm font-semibold">Beveiligde sessies</div>
              <div className="text-xs text-slate-600">Inloggen via NextAuth</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3">
            <Shield className="text-sky-700" />
            <div>
              <div className="text-sm font-semibold">Dataminimalisatie</div>
              <div className="text-xs text-slate-600">Geen PII/gezondheidsdata nodig</div>
            </div>
          </div>
        </div>
      </section>

      {/* DATA LIFECYCLE */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="text-lg font-semibold">Hoe je data wordt verwerkt</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-600" /> <b>Upload</b>: je Excel/CSV wordt in de browser ingelezen (SheetJS) en direct geparseerd.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-600" /> <b>Analyse</b>: berekeningen (waterfall, KPI’s, scenario’s, contract performance) draaien <b>client-side</b>.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-600" /> <b>Opslag</b>: tussentijdse resultaten worden in <b>SessionStorage</b> bewaard voor je sessie; er is <b>geen server-database</b>.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-600" /> <b>Export</b>: downloads worden on-the-fly gegenereerd en als bestand teruggestreamd — <b>zonder persistente opslag</b>.</li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Opmerking: API-routes voor export sturen alleen het bestand terug; er wordt niets gelogd of bewaard van je dataset.
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <h2 className="text-lg font-semibold">Inloggen & sessiebeveiliging</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-600" /> <b>NextAuth</b> voor authenticatie en sessiebeheer.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-600" /> Sessies via <b>secure cookies</b> (alleen via HTTPS) of JWT-based afhankelijk van configuratie.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-600" /> <b>RBAC mogelijk</b> (rollen & rechten) op applicatieniveau voor toegang tot onderdelen.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-600" /> <b>Geen PII</b> vereist voor gebruik van analyses; werk met geaggregeerde, niet-herleidbare velden.</li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              In je project staat <code>next-auth</code> al geconfigureerd via de eigen <code>AuthProvider</code> wrapper.
            </p>
          </div>
        </div>
      </section>

      {/* MODEL: WAT WE WÉL / NIET DOEN */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Wat we wél / niet doen met data</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
            <div className="rounded-xl border p-4">
              <div className="font-medium text-emerald-700">Wél</div>
              <ul className="mt-2 space-y-1 text-slate-700">
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-600" /> Verwerken in je eigen browser (client-side).</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-600" /> Tijdelijke sessie-opslag (SessionStorage) voor gebruikersgemak.</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-600" /> Versleutelde verbindingen (HTTPS/TLS).</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-600" /> Optie voor EU-hosting/configuratie.</li>
              </ul>
            </div>
            <div className="rounded-xl border p-4">
              <div className="font-medium text-rose-700">Niet</div>
              <ul className="mt-2 space-y-1 text-slate-700">
                <li>❌ Geen server-side opslag of database met jouw brondata.</li>
                <li>❌ Geen gebruik van data voor training of third-party sharing.</li>
                <li>❌ Geen noodzaak voor PII/gezondheidsdata in de analyses.</li>
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Als je organisatie aanvullende eisen heeft (SOP’s, DPA’s, key management, region pinning), bespreken we graag de passende inrichting.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-gradient-to-r from-sky-600 to-indigo-600">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center text-white">
          <h4 className="text-2xl font-semibold">Vragen over security of privacy?</h4>
          <p className="mt-2 text-white/90">We leggen onze architectuur en keuzes graag toe op jullie standaarden.</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link href="/contact" className="rounded-xl bg-white px-4 py-2 text-slate-900 hover:bg-slate-100">
              Plan een security-call
            </Link>
            <Link href="/templates" className="rounded-xl border border-white/30 px-4 py-2 hover:bg-white/10">
              Probeer met sample data
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
