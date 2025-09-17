"use client";
import { Check } from "lucide-react";
import Link from "next/link";

type Item = { title: string; bullets: string[]; ctaHref: string; ctaLabel: string };
const personas: Item[] = [
  {
    title: "Pricing & Market Access",
    bullets: [
      "Scenario’s in minuten, niet weken",
      "Volledige audittrail per deal",
      "Governance zonder zware IT"
    ],
    ctaHref: "/features",
    ctaLabel: "Bekijk scenario-tool",
  },
  {
    title: "Finance & Controlling",
    bullets: [
      "Transparante Gross-to-Net waterfall",
      "KPI’s per kanaal & product",
      "Exports naar Excel/PDF"
    ],
    ctaHref: "/pricing",
    ctaLabel: "Zie licentie & ROI",
  },
  {
    title: "Compliance & IT",
    bullets: [
      "EU-hosting & dataminimalisatie",
      "Role-based access & logging",
      "Snelle implementatie"
    ],
    ctaHref: "/about#security",
    ctaLabel: "Lees security uitleg",
  },
];

export default function PersonaBlocks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="text-2xl md:text-3xl font-semibold mb-6">Gemaakt voor farma-teams die resultaat willen</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {personas.map((p) => (
          <div key={p.title} className="rounded-2xl border bg-white/70 backdrop-blur p-6 shadow-sm hover:shadow-md transition">
            <h3 className="text-xl font-semibold mb-4">{p.title}</h3>
            <ul className="space-y-2 mb-6">
              {p.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <Check className="size-5 shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <Link href={p.ctaHref} className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50">
              {p.ctaLabel}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
