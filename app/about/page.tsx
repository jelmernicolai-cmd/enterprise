import Image from "next/image";

export const metadata = {
  title: "Over PharmGtN | Missie, Founders & Werkwijze",
  description:
    "PharmGtN helpt farma-teams in Nederland om netto-prijzen en contracten te beheersen. Ontdek onze missie, het team en hoe we werken: pragmatisch, veilig en herleidbaar.",
};

export default function AboutNL() {
  return (
    <main className="min-h-screen">
      {/* HERO */}
      <section className="bg-gradient-to-b from-sky-50 to-white border-b">
        <div className="mx-auto max-w-7xl px-4 py-12 md:py-16 grid md:grid-cols-2 gap-10 items-center">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 backdrop-blur px-2.5 py-1 text-[11px] text-slate-600 shadow-sm">
              <span>NL/EU-hosting</span> <span className="opacity-50">•</span> <span>Dataminimalisatie</span>
            </div>
            <h1 className="mt-3 text-3xl md:text-5xl font-semibold leading-tight tracking-tight">
              Over PharmGtN
            </h1>
            <p className="mt-4 text-slate-700 leading-relaxed">
              Wij helpen farmafabrikanten in Nederland met <strong>pricing</strong>, <strong>contracting</strong> en
              <strong> post-deal governance</strong>. Geen zware IT-trajecten, wél heldere scenario’s, KPI’s en een
              herleidbare werkwijze — met <strong>EU-hosting</strong> en <strong>dataminimalisatie</strong>.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[12px]">
              {[
                "Geen modeltraining op klantdata",
                "Rol-gebaseerde toegang (4-ogen)",
                "Audit trail & export",
              ].map((t) => (
                <span
                  key={t}
                  className="px-2 py-1 rounded-full border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div>
            <Image
              src="/images/about-hero.png"
              alt="Dashboard- en scenario-overzicht (dummy-data)"
              width={1200}
              height={800}
              className="w-full rounded-xl border border-slate-200/70 bg-white shadow-sm"
              priority
            />
          </div>
        </div>
      </section>

      {/* MISSIE */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60 p-6 md:p-10 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Onze missie</h2>
            <p className="mt-4 text-slate-700 leading-relaxed">
              Besluitvorming in farma verdient <strong>transparantie</strong> en <strong>controle</strong>. Met PharmGtN
              willen we teams in pricing & contracting in staat stellen om binnen minuten — in plaats van weken — te zien
              wat een keuze betekent voor <strong>netto-prijzen, marges en tenderresultaat</strong>. Altijd herleidbaar, altijd
              veilig, en zonder afhankelijk te zijn van kwetsbare spreadsheets.
            </p>
            <ul className="mt-5 text-slate-700 space-y-2">
              <li>• <strong>Simpel waar het kan</strong>: duidelijke KPI’s en scenario’s (A/B).</li>
              <li>• <strong>Strak waar het moet</strong>: governance, 4-ogen, audit trail.</li>
              <li>• <strong>Veilig als uitgangspunt</strong>: EU-hosting, dataminimalisatie, geen modeltraining op klantdata.</li>
            </ul>
          </div>
          <div className="space-y-4">
            <InfoCard eyebrow="Belofte" text="Binnen één sessie helderheid — met een export die Finance & Legal begrijpen." />
            <InfoCard eyebrow="Focus" text="Nederlandse farma-praktijk: LOE, tenders, GTN en consistentie." />
          </div>
        </div>
      </section>

      {/* FOUNDERS */}
      <section className="mx-auto max-w-7xl px-4 pb-8">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Founders</h2>
        <p className="mt-3 text-slate-700">
          Een complementair team met ervaring in <strong>pricing & contracting</strong>, <strong>data</strong> en
          <strong> productontwikkeling</strong>. Zakelijk, nuchter en met oog voor governance.
        </p>

        <div className="mt-8 grid md:grid-cols-3 gap-6">
          {[
            {
              name: "Sanne van Dijk",
              role: "Co-founder · Pricing & Contracting",
              bio: "12+ jaar ervaring bij internationale farma. Leidde tender- en LOE-trajecten in NL. Gelooft in pragmatische scenario’s die Finance en Sales verbinden.",
              img: "/images/founder-sanne.jpg",
            },
            {
              name: "Ruben Meijer",
              role: "Co-founder · Data & Product",
              bio: "Data lead met achtergrond in analytics en product. Maakte GTN-workflows schaalbaar en audit-proof voor meerdere portfolio’s.",
              img: "/images/founder-ruben.jpg",
            },
            {
              name: "Mira de Groot",
              role: "Co-founder · Customer Success",
              bio: "Werkte met commerciële teams aan implementatie en adoptie. Zorgt dat teams snel waarde halen — zonder ruis en gedoe.",
              img: "/images/founder-mira.jpg",
            },
          ].map((f) => (
            <div
              key={f.name}
              className="rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm overflow-hidden"
            >
              <Image
                src={f.img}
                alt={f.name}
                width={900}
                height={600}
                className="w-full h-56 object-cover"
              />
              <div className="p-5">
                <h3 className="font-semibold">{f.name}</h3>
                <div className="text-sm text-slate-600">{f.role}</div>
                <p className="mt-2 text-sm text-slate-700">{f.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WAAROM TEAMS VOOR ONS KIEZEN */}
      <section className="mx-auto max-w-7xl px-4 pb-14">
        <div className="rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60 p-6 md:p-10">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Waarom teams voor PharmGtN kiezen</h2>
          <div className="mt-6 grid md:grid-cols-3 gap-6">
            {[
              {
                h: "Realistische scenario’s",
                p: "LOE- en tendercurves met blijvende share-effecten en ramp-down. Direct naast elkaar te vergelijken.",
                img: "/images/why-scenarios.png",
              },
              {
                h: "Marge onder controle",
                p: "GTN-waterfalls en consistentie-checks brengen lekken in beeld. Duidelijke onderbouwing richting Finance.",
                img: "/images/why-margin.png",
              },
              {
                h: "Veilig & herleidbaar",
                p: "EU-hosting, dataminimalisatie en audit trail. 4-ogen-principe en rationale-vastlegging als standaard.",
                img: "/images/why-trust.png",
              },
            ].map((c) => (
              <div
                key={c.h}
                className="rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm p-5 hover:shadow-md transition"
              >
                <Image
                  src={c.img}
                  alt={c.h}
                  width={800}
                  height={500}
                  className="w-full rounded-lg border border-slate-200/70 bg-white"
                />
                <h3 className="mt-4 font-medium">{c.h}</h3>
                <p className="mt-2 text-sm text-slate-700">{c.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WERKWIJZE */}
      <section className="bg-slate-50/60 border-y">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Werkwijze</h2>
          <div className="mt-8 grid md:grid-cols-4 gap-6">
            {[
              { n: "1", h: "Intake", p: "Focus op portfolio en vraagstukken. Geen PII/PHI nodig." },
              { n: "2", h: "Data-in", p: "Eenvoudige Excel-template. Automatische basisvalidaties." },
              { n: "3", h: "Analyse", p: "Scenario’s, KPI’s en export. Eén bron van waarheid." },
              { n: "4", h: "Borging", p: "4-ogen-principe, rationale en audit trail — standaard." },
            ].map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm p-6"
              >
                <div className="text-[11px] text-slate-600">Stap {s.n}</div>
                <h3 className="mt-2 font-medium">{s.h}</h3>
                <p className="mt-2 text-slate-700">{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRINCIPES / WAARDEN */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { h: "Zakelijk & nuchter", p: "Geen buzzwords — wél onderbouwde keuzes die teams overnemen." },
            { h: "Snel naar waarde", p: "In uren live, niet in maanden. Export die direct te delen is." },
            { h: "Conservatief met data", p: "Minimalistische databehoefte, EU-hosting en geen modeltraining op klantdata." },
          ].map((b) => (
            <div
              key={b.h}
              className="rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm p-6"
            >
              <h3 className="font-semibold">{b.h}</h3>
              <p className="mt-2 text-sm text-slate-700">{b.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm p-8 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Kennismaken?</h2>
          <p className="mt-3 text-slate-700">
            Plan een korte demo of start met een licentie. We laten u zien hoe u sneller tot een onderbouwd besluit komt.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <a
              href="/contact"
              className="px-5 py-3 rounded-lg text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:opacity-95 shadow-sm"
            >
              Plan demo
            </a>
            <a
              href="/pricing"
              className="px-5 py-3 rounded-lg border border-slate-200/70 bg-white hover:bg-gray-50"
            >
              Licentie & tarieven
            </a>
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Geen patiëntgegevens nodig • EU-hosting • Herleidbare export
          </div>
        </div>
      </section>
    </main>
  );
}

/* ——— kleine subcomponent voor nette info-kaarten ——— */
function InfoCard({ eyebrow, text }: { eyebrow: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/70 shadow-sm p-4">
      <div className="text-sm text-slate-500">{eyebrow}</div>
      <p className="mt-1 font-medium text-slate-900">{text}</p>
    </div>
  );
}
