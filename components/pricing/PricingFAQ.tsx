"use client";
const faqs = [
  {
    q: "Hoe veilig zijn mijn data?",
    a: "Data worden in de EU gehost. We werken met dataminimalisatie, RBAC en volledige audit logging. Exports zijn versleuteld tijdens transport."
  },
  {
    q: "Kan ik meerdere entiteiten/landen koppelen?",
    a: "Ja. Meerdere entiteiten zijn mogelijk; segmentatie en rechten per entiteit zijn ondersteund."
  },
  {
    q: "Welke ondersteuning krijg ik?",
    a: "Onboarding met dummy-data, documentatie en support via e-mail. Optioneel: implementatie-assistance en training."
  },
  {
    q: "Wat is het alternatief vs. Excel of maatwerk IT?",
    a: "PharmaGtN voorkomt foutgevoelige spreadsheets, versnelt scenario’s en biedt governance. Maatwerk IT is duur/traag; wij leveren direct waarde."
  }
];

export default function PricingFAQ() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h2 className="text-2xl md:text-3xl font-semibold mb-6">Veelgestelde vragen</h2>
      <div className="divide-y rounded-2xl border bg-white/70 backdrop-blur">
        {faqs.map((f, i) => (
          <details key={f.q} className="group open:bg-slate-50">
            <summary className="cursor-pointer list-none px-6 py-4 font-medium">
              {f.q}
            </summary>
            <div className="px-6 pb-6 text-slate-700">{f.a}</div>
          </details>
        ))}
      </div>
      {/* SEO: FAQPage JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqs.map((f) => ({
              "@type": "Question",
              "name": f.q,
              "acceptedAnswer": { "@type": "Answer", "text": f.a }
            }))
          }),
        }}
      />
    </section>
  );
}
