// app/contact/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Contact | PharmaGtN",
  description:
    "Neem contact op met PharmaGtN voor een demo, licenties en enterprise-opties. We reageren doorgaans binnen één werkdag.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact | PharmaGtN",
    description:
      "Plan een demo of stel je vraag over Gross-to-Net, scenario’s en governance. Reactie binnen één werkdag.",
    url: "/contact",
    type: "website",
  },
};

export default function ContactNL() {
  const faqs = [
    {
      q: "Hoe snel kunnen we live?",
      a: "Self-service: binnen 1–2 dagen met onze templates. Enterprise-integraties op aanvraag.",
    },
    {
      q: "Verwerken jullie PII/health data?",
      a: "Nee. We werken met dataminimalisatie: transactie- en prijsgegevens op product/klantsegmentniveau, geen PII/gezondheidsdata.",
    },
    {
      q: "Ondersteunen jullie EU-hosting?",
      a: "Ja, er is EU-hosting met encryptie ‘in transit’ en ‘at rest’.",
    },
    {
      q: "Kunnen we een NDA tekenen?",
      a: "Zeker. Stuur je standaard NDA mee; doorgaans tekenen we binnen 2 werkdagen.",
    },
  ];

  return (
    <main>
      {/* HERO (zonder badge) */}
      <section className="bg-gradient-to-b from-sky-50 to-white border-b">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16 text-center">
          <h1 className="text-3xl md:text-5xl font-bold">Contact</h1>
          <p className="mt-4 text-gray-700">
            Plan een demo of stel je vraag. We reageren doorgaans binnen <strong>één werkdag</strong>.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="mailto:sales@pharmagtn.com?subject=Plan%20demo%20PharmaGtN&body=Naam%3A%0ABedrijf%3A%0AUse%20case%3A%0AWens%20datum%2Ftijd%3A%0A"
              className="rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2 text-white hover:opacity-95"
            >
              Plan direct een demo
            </a>
            <Link href="/pricing" className="rounded-xl border px-4 py-2 hover:bg-white">
              Bekijk licentie & ROI
            </Link>
          </div>
          <p className="mt-3 text-xs text-gray-500">EU-hosting • Dataminimalisatie • Exports naar Excel/PDF</p>
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Highlight icon="clock" title="Snel antwoord" sub="binnen 1 werkdag" />
          <Highlight icon="shield" title="EU-hosting" sub="encryptie in transit/at rest" />
          <Highlight icon="eyeoff" title="Geen PII/health" sub="dataminimalisatie" />
          <Highlight icon="doc" title="NDA mogelijk" sub="op aanvraag" />
        </div>
      </section>

      {/* CARDS */}
      <section className="mx-auto max-w-6xl px-4 py-12 grid md:grid-cols-3 gap-6">
        {/* E-mail */}
        <div className="rounded-2xl border p-6 bg-white">
          <div className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50 ring-1 ring-sky-100/60 p-3">
            <MailIcon className="h-6 w-6 text-sky-700" />
          </div>
          <h2 className="mt-3 font-semibold">E-mail</h2>
          <p className="mt-2 text-sm text-gray-700">
            Voor sales & support:
            <br />
            <a
              className="text-sky-700 underline break-all"
              href="mailto:sales@pharmagtn.com?subject=Aanvraag%20PharmaGtN&body=Naam%3A%0ABedrijf%3A%0AUse%20case%3A%0A"
            >
              sales@pharmagtn.com
            </a>
          </p>
          <p className="mt-3 text-xs text-gray-500">Tip: beschrijf kort je casus voor gerichte voorbereiding.</p>
        </div>

        {/* Demo inplannen */}
        <div className="rounded-2xl border p-6 bg-white">
          <div className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50 ring-1 ring-sky-100/60 p-3">
            <CalendarIcon className="h-6 w-6 text-sky-700" />
          </div>
          <h2 className="mt-3 font-semibold">Demo inplannen</h2>
          <p className="mt-2 text-sm text-gray-700">Walkthrough van de GtN Portal op basis van je eigen casus.</p>
          <div className="mt-4 flex flex-col gap-2">
            <a
              href="mailto:sales@pharmagtn.com?subject=Plan%20demo%20PharmaGtN&body=Wens%20datum%2Ftijd%3A%0AAantal%20deelnemers%3A%0AUse%20case%3A%0A"
              className="inline-block rounded-lg bg-sky-600 text-white px-4 py-2 text-center hover:bg-sky-700"
            >
              Plan via e-mail
            </a>
            <Link href="/pricing" className="inline-block rounded-lg border px-4 py-2 text-center hover:bg-gray-50">
              Bekijk licentie & ROI
            </Link>
          </div>
          <p className="mt-3 text-xs text-gray-500">Liever eerst een NDA? Vermeld dit in het onderwerp.</p>
        </div>

        {/* Documentatie */}
        <div className="rounded-2xl border p-6 bg-white">
          <div className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50 ring-1 ring-sky-100/60 p-3">
            <DocIcon className="h-6 w-6 text-sky-700" />
          </div>
          <h2 className="mt-3 font-semibold">Documentatie</h2>
          <p className="mt-2 text-sm text-gray-700">Download de Excel-templates en onboarding-handleiding.</p>
          <div className="mt-4">
            <Link href="/templates" className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50">
              Naar templates
            </Link>
          </div>
          <p className="mt-3 text-xs text-gray-500">Start snel met dummy-data en schaal later op.</p>
        </div>
      </section>

      {/* FORMULIER */}
      <section aria-labelledby="contact-form" className="mx-auto max-w-6xl px-4 pb-12">
        <div className="rounded-2xl border bg-white p-6 md:p-8">
          <h2 id="contact-form" className="text-lg font-semibold">Stuur ons een bericht</h2>
          <p className="mt-1 text-sm text-gray-700">Vul je gegevens in — we mailen je terug.</p>

          <form className="mt-6 grid gap-4" action="/api/contact" method="post" aria-label="Contactformulier">
            {/* Honeypot */}
            <input type="text" name="company_website" className="hidden" tabIndex={-1} autoComplete="off" />
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Naam" id="name">
                <input id="name" name="name" required className="mt-1 w-full rounded-lg border px-3 py-2" />
              </Field>
              <Field label="E-mail" id="email">
                <input id="email" type="email" name="email" required className="mt-1 w-full rounded-lg border px-3 py-2" />
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Bedrijf" id="company">
                <input id="company" name="company" className="mt-1 w-full rounded-lg border px-3 py-2" />
              </Field>
              <Field label="Use case" id="usecase">
                <select id="usecase" name="usecase" className="mt-1 w-full rounded-lg border px-3 py-2">
                  <option>Gross-to-Net waterfall</option>
                  <option>Scenario-analyse</option>
                  <option>Governance / logging</option>
                  <option>Anders</option>
                </select>
              </Field>
            </div>
            <Field label="Bericht" id="message">
              <textarea id="message" name="message" rows={5} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </Field>

            <div className="flex items-center gap-2 text-xs text-gray-600">
              <input id="consent" name="consent" type="checkbox" required className="rounded" />
              <label htmlFor="consent">Ik geef toestemming om mijn gegevens te gebruiken om mijn aanvraag te behandelen.</label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2 text-white hover:opacity-95" type="submit">
                Verzenden
              </button>
              <a
                className="rounded-lg border px-4 py-2 hover:bg-gray-50"
                href="mailto:sales@pharmagtn.com?subject=Contact%20via%20formulier"
              >
                Of mail direct
              </a>
            </div>

            <p className="mt-2 text-xs text-gray-500">We bewaren informatie niet langer dan nodig. Geen marketing zonder opt-in.</p>
          </form>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 border-t">
        <div className="mx-auto max-w-6xl px-4 py-12 grid md:grid-cols-2 gap-6">
          {faqs.map((item) => (
            <div key={item.q} className="rounded-xl border bg-white p-5">
              <h3 className="font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm text-gray-700">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "ContactPage",
              "name": "Contact | PharmaGtN",
              "url": (process.env.SITE_URL || "https://www.pharmagtn.com") + "/contact",
              "description": "Plan een demo of stel je vraag. Reactie binnen één werkdag."
            },
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "PharmaGtN",
              "url": process.env.SITE_URL || "https://www.pharmagtn.com",
              "contactPoint": [
                {
                  "@type": "ContactPoint",
                  "contactType": "sales",
                  "email": "sales@pharmagtn.com",
                  "areaServed": "NL/EU",
                  "availableLanguage": ["nl", "en"]
                }
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": faqs.map((f) => ({
                "@type": "Question",
                "name": f.q,
                "acceptedAnswer": { "@type": "Answer", "text": f.a }
              }))
            }
          ]),
        }}
      />
    </main>
  );
}

/* ===== Kleine helpers & iconen (inline; geen deps) ===== */
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function Highlight({ icon, title, sub }: { icon: IconName; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3">
      <Icon name={icon} className="h-5 w-5 text-sky-700" />
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-slate-600">{sub}</div>
      </div>
    </div>
  );
}

type IconName = "clock" | "shield" | "eyeoff" | "doc";
function Icon({ name, className }: { name: IconName; className?: string }) {
  switch (name) {
    case "clock":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm1 11h5v-2h-4V6h-2v7z"/>
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M12 2l8 4v6c0 5-3.4 9.7-8 10-4.6-.3-8-5-8-10V6l8-4z"/>
        </svg>
      );
    case "eyeoff":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M12 5c5 0 9 4 10 7-1 3-5 7-10 7-5 0-9-4-10-7 1-3 5-7 10-7zm0 3a4 4 0 100 8 4 4 0 000-8zM3 3l18 18-1.4 1.4L1.6 4.4 3 3z"/>
        </svg>
      );
    case "doc":
      return <DocIcon className={className} />;
  }
}

function MailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path fill="currentColor" d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}
function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path fill="currentColor" d="M7 2h2v2h6V2h2v2h3a2 2 0 012 2v3H2V6a2 2 0 012-2h3V2zm15 8v10a2 2 0 01-2 2H4a2 2 0 01-2-2V10h20z" />
    </svg>
  );
}
function DocIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path fill="currentColor" d="M6 2h8l6 6v14a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm8 1.5V8h4.5L14 3.5z" />
    </svg>
  );
}
