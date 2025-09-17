// app/features/page.tsx
import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Features",
  description:
    "Scenario’s, Gross-to-Net waterfall, KPI’s en exports. Veilig, snel en gemaakt voor farma-teams.",
};

/* ========== Types ========== */
type IconName =
  | "sparkles"
  | "chart"
  | "template"
  | "kpi"
  | "shield"
  | "cloud"
  | "rocket"
  | "euro"
  | "clock"
  | "check"
  | "zap"
  | "timer"
  | "layers"
  | "file-text";

type FeatureCard = {
  icon: IconName;
  title: string;
  bullets: string[];
  cta: { href: string; label: string };
};

type Highlight = { icon: IconName; k: string; v: string; sub: string };

export default function FeaturesPage() {
  const cards: FeatureCard[] = [
    {
      icon: "rocket",
      title: "Scenario-analyse",
      bullets: [
        "Vergelijk meerdere scenario’s met elkaar",
        "Impact direct zichtbaar",
        "Export voor rapportage in PDF/Excel/CSV",
      ],
      cta: { href: "/pricing", label: "Bekijk licentie" },
    },
    {
      icon: "chart",
      title: "Gross-to-Net waterfall",
      bullets: [
        "Maak je kortingsmix inzichtelijk (kortingen/bonus)",
        "Directe data validatie bij upload",
        "Export voor rapportage en audit",
      ],
      cta: { href: "/app", label: "Bekijk in Portal" },
    },
    {
      icon: "template",
      title: "Templates & validatie",
      bullets: [
        "Excel-templates voor discounts",
        "Automatische checks bij upload",
        "Snelle onboarding met uitgebreide instructies",
      ],
      cta: { href: "/templates", label: "Download templates" },
    },
    {
      icon: "kpi",
      title: "KPI’s & dashboards",
      bullets: [
        "KPI’s per product/kanaal/segment",
        "Trendgrafieken & directe marge verbeteringsopties",
        "Exports naar Excel/PDF",
      ],
      cta: { href: "/contact", label: "Plan een demo" },
    },
    {
      icon: "shield",
      title: "Privacy & veilig",
      bullets: [
        "Role-based access (RBAC)",
        "Data wordt niet op server opgeslagen (SessionStorage only)",
        "Client-side upload + alleen tijdelijke opslag",
      ],
      cta: { href: "/about#security", label: "Lees security" },
    },
    {
      icon: "cloud",
      title: "EU-hosting & minimalisatie",
      bullets: [
        "EU-hosting, versleuteld in transit/at rest",
        "Dataminimalisatie (geen PII/health data)",
        "In lijn met compliance/SOP richtlijnen",
      ],
      cta: { href: "/about#security", label: "Meer over privacy" },
    },
  ];

  const highlights: Highlight[] = [
    { icon: "zap", k: "Snelle start", v: "in dagen", sub: "met kant-en-klare templates" },
    { icon: "timer", k: "Besparing", v: "uren", sub: "per analysecyclus" },
    { icon: "layers", k: "Inzicht", v: "per stap", sub: "gross → net volledig verklaard" },
    { icon: "file-text", k: "Exports", v: "klik & klaar", sub: "voor rapportage en interne review" },
  ];

  return (
    <main>
      {/* HERO */}
      <section className="border-b bg-gradient-to-b from-white to-sky-50">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 px-3 py-1 text-xs font-medium text-white">
            <Dot /> Gemaakt voor farma-teams
          </span>
          <div className="max-w-4xl mx-auto">
            <h1 className="mt-4 text-3xl md:text-5xl font-bold leading-tight">
              Alles wat je nodig hebt voor{" "}
              <span className="underline decoration-sky-300/60">betrouwbare GtN-analyses</span>
            </h1>
            <p className="mt-4 text-slate-700">
              Zie direct waar marge weg lekt, optimaliseer je commerciële beleid, check consistentie en exporteer resultaten.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/pricing"
              className="rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-5 py-3 text-white hover:opacity-95"
            >
              Bekijk pricing
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border px-5 py-3 hover:bg-white"
            >
              Plan een demo
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            EU-hosting • Dataminimalisatie • Exports naar Excel/PDF
          </p>
        </div>
      </section>

      {/* HIGHLIGHTS STRIP */}
      <section className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {highlights.map((h) => (
            <div key={h.k} className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3">
              <Icon name={h.icon} className="h-5 w-5 text-sky-700" />
              <div>
                <div className="text-sm font-semibold">{h.k}</div>
                <div className="text-xs text-slate-600">
                  {h.v} <span className="text-slate-500">{h.sub}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURE GRID */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 md:grid-cols-3">
          {cards.map((c) => (
            <article key={c.title} className="group rounded-2xl border bg-white p-6 hover:shadow-md transition">
              <div className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50 ring-1 ring-sky-100/60 p-3">
                <Icon name={c.icon} className="h-6 w-6 text-sky-700" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">{c.title}</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {c.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <Link
                  href={c.cta.href}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                >
                  {c.cta.label} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* SPLIT SECTION */}
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="grid items-center gap-6 md:grid-cols-2">
          <div className="order-2 md:order-1">
            <h3 className="text-xl font-semibold">Van upload tot besluit, in één flow</h3>
            <p className="mt-2 text-sm text-slate-700">
              Upload je data met de templates, controleer consistentie en zie direct de impact in de waterfall of scenario-vergelijking.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-600" /> Validatie bij upload</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-600" /> Waterfall & KPI-overzicht</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-600" /> Exporteer naar PDF/CSV</li>
            </ul>
            <div className="mt-5 flex gap-3">
              <Link href="/templates" className="rounded-xl border px-4 py-2 hover:bg-slate-50">
                Download templates
              </Link>
              <Link
                href="/contact"
                className="rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2 text-white hover:opacity-95"
              >
                Vraag demo
              </Link>
            </div>
          </div>

          {/* Visual rechts */}
          <div className="order-1 md:order-2">
            <Image
              src="/images/analytics-dashboard.png"
              alt="Voorbeeld van het analytics dashboard"
              width={800}
              height={450}
              className="rounded-2xl border shadow-md"
              priority
            />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t bg-gradient-to-r from-sky-600 to-indigo-600">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center text-white">
          <h4 className="text-2xl font-semibold">Klaar voor duidelijke GtN-analyses?</h4>
          <p className="mt-2 text-white/90">Start met de templates of plan een demo met je eigen casus.</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link href="/pricing" className="rounded-xl bg-white px-4 py-2 text-slate-900 hover:bg-slate-100">
              Bekijk pricing
            </Link>
            <Link href="/contact" className="rounded-xl border border-white/30 px-4 py-2 hover:bg-white/10">
              Plan demo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ========== Icons (inline, geen dependency) ========== */
function Icon({ name, className }: { name: IconName | string; className?: string }) {
  switch (name) {
    case "sparkles":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M12 2l1.7 3.8L18 7.5l-3.8 1.7L12 13l-2.2-3.8L6 7.5l4.3-1.7L12 2zM4 13l.9 2.1L7 16l-2.1.9L4 19l-.9-2.1L1 16l2.1-.9L4 13zm14 2l1.3 2.8L22 19l-2.7 1.2L18 23l-1.3-2.8L14 19l2.7-1.2L18 15z"/>
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M3 3h2v18H3V3zm16 10h2v8h-2v-8zM11 9h2v12h-2V9zM7 13h2v8H7v-8zm8-10h2v22h-2V3z"/>
        </svg>
      );
    case "template":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M4 4h16v4H4V4zm0 6h10v10H4V10zm12 0h4v10h-4V10z"/>
        </svg>
      );
    case "kpi":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M3 20h18v1H3v-1zM6 11h3v7H6v-7zm5-4h3v11h-3V7zm5 2h3v9h-3V9z"/>
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M12 2l8 4v6c0 5-3.4 9.7-8 10-4.6-.3-8-5-8-10V6l8-4z"/>
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M6 18h11a4 4 0 0 0 0-8 6 6 0 0 0-11.7 1.5A3.5 3.5 0 0 0 6 18z"/>
        </svg>
      );
    case "rocket":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M12 2c3 0 6 2 7 5l-5 5-2-2-5 5 2 2-5 5 5-5 2 2 5-5 2 2 5-5c-1-3-4-7-11-7z"/>
        </svg>
      );
    case "euro":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M17 7a6 6 0 0 0-10.7 3H4v2h2.1A6 6 0 0 0 17 17l.9-2.1A4 4 0 0 1 8.7 12H14v-2H8.7A4 4 0 0 1 17 7z"/>
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm1 11h5v-2h-4V6h-2v7z"/>
        </svg>
      );
    case "zap":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
      );
    case "timer":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M9 2h6v2H9V2zm3 4a9 9 0 1 0 0.001 18.001A9 9 0 0 0 12 6zm1 5v5h4v-2h-2v-3h-2z" />
        </svg>
      );
    case "layers":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M12 3l9 5-9 5-9-5 9-5zm0 8l9 5-9 5-9-5 9-5z" />
        </svg>
      );
    case "file-text":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM8 9h8v2H8V9zm0 4h8v2H8v-2zm6-9.5L19.5 8H14V3.5z"/>
        </svg>
      );
    case "check":
      return <Check className={className} />;
    default:
      return <span className={className}>★</span>;
  }
}

function Check(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 010 1.4l-7.2 7.2a1 1 0 01-1.4 0L3.3 9.1a1 1 0 011.4-1.4l3 3 6.5-6.5a1 1 0 011.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ArrowRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden {...props}>
      <path d="M10.293 3.293a1 1 0 011.414 0L17 8.586a2 2 0 010 2.828l-5.293 5.293a1 1 0 01-1.414-1.414L13.586 12H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 010-1.414z"/>
    </svg>
  );
}

function Dot(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 8 8" aria-hidden {...props} className={"h-2 w-2 fill-white " + (props.className || "")}>
      <circle cx="4" cy="4" r="4" />
    </svg>
  );
}
