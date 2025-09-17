'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { loadWaterfallRows, eur0 } from '@/lib/waterfall-storage';
import type { Row } from '@/lib/waterfall-types';
import Sparkline from '@/components/charts/Sparkline';
import MiniBar from '@/components/charts/MiniBar';
import Donut from '@/components/charts/Donut';
import OnboardingTips from "@/components/app/OnboardingTips";

export default function PortalDashboard() {
  const rows: Row[] = loadWaterfallRows();

  // Als er nog geen data is -> focus op upload hero
  if (!rows.length) {
    return (
      <main className="space-y-6">
        <header className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <span
            className="ml-2 text-xs px-2 py-1 rounded-full border bg-amber-50 text-amber-800 border-amber-200"
            role="status"
            aria-live="polite"
          >
            Geen dataset gevonden
          </span>
        </header>

        <OnboardingTips />

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Start met je data</h2>
          <p className="text-gray-600 mt-1">
            Upload een Excel (template) om Waterfall en Consistency te activeren. Daarna zie je hier KPIs, trend en aanbevolen acties.
          </p>

          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4">
              <h3 className="font-medium">Upload / Replace dataset</h3>
              <p className="text-sm text-gray-600 mt-1">Vervang of voeg je laatste periode toe (Excel).</p>
              <div className="mt-3">
                <Link
                  href="/app/waterfall#upload"
                  className="inline-flex items-center rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-sm px-4 py-2 hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                >
                  Naar upload
                </Link>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="font-medium">Templates &amp; Datamapping</h3>
              <p className="text-sm text-gray-600 mt-1">
                Download het Excel-template en bekijk de kolomdefinities.
              </p>
              <div className="mt-3">
                <Link
                  href="/app/waterfall#templates"
                  className="inline-flex items-center rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                >
                  Bekijk templates
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="text-sm text-gray-600">
          Tip: je kunt ook onze <Link className="underline" href="/app/waterfall#templates">dummy dataset</Link> gebruiken om het snel te proberen.
        </section>
      </main>
    );
  }

  // ---- Helpers
  const discOf = (r: Row) =>
    (r.d_channel || 0) +
    (r.d_customer || 0) +
    (r.d_product || 0) +
    (r.d_volume || 0) +
    (r.d_other_sales || 0) +
    (r.d_mandatory || 0) +
    (r.d_local || 0);

  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  // ---- Aggregaties
  const {
    grossTotal,
    avgDiscountPct,
    periodPctSeries,
    topDeviation,
    totalPotential,
    lastPct,
    minPct,
    maxPct,
  } = useMemo(() => {
    let grossTotal = 0, discTotal = 0;

    const byCustomer = new Map<string, { gross: number; disc: number }>();
    const byPeriod = new Map<string, { gross: number; disc: number }>();

    for (const r of rows) {
      const g = r.gross || 0;
      const d = discOf(r);
      grossTotal += g;
      discTotal += d;

      const c = byCustomer.get(r.cust) || { gross: 0, disc: 0 };
      c.gross += g;
      c.disc += d;
      byCustomer.set(r.cust, c);

      const p = r.period || '—';
      const pp = byPeriod.get(p) || { gross: 0, disc: 0 };
      pp.gross += g;
      pp.disc += d;
      byPeriod.set(p, pp);
    }

    const avgDiscountPct = grossTotal ? (discTotal / grossTotal) * 100 : 0;

    // Periode % serie (voor sparkline)
    const periods = [...byPeriod.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const periodPctSeries = periods.map(([_, v]) => (v.gross ? (v.disc / v.gross) * 100 : 0));

    // Range + last voor korte uitleg
    const lastPct = periodPctSeries.length ? periodPctSeries[periodPctSeries.length - 1] : 0;
    const minPct = periodPctSeries.length ? Math.min(...periodPctSeries) : 0;
    const maxPct = periodPctSeries.length ? Math.max(...periodPctSeries) : 0;

    // Consistency-afwijking t.o.v. overall benchmark (simpel & snel voor dashboard)
    const deviations = [...byCustomer.entries()].map(([cust, v]) => {
      const pct = v.gross ? (v.disc / v.gross) * 100 : 0;
      const deviation = pct - avgDiscountPct; // pp
      const potential = deviation > 0 ? (deviation / 100) * v.gross : 0;
      return { cust, gross: v.gross, discPct: pct, deviation, potential };
    });

    const topDeviation = deviations
      .sort((a, b) => b.potential - a.potential)
      .slice(0, 10);

    const totalPotential = topDeviation.reduce((s, c) => s + c.potential, 0);

    return { grossTotal, avgDiscountPct, periodPctSeries, topDeviation, totalPotential, lastPct, minPct, maxPct };
  }, [rows]);

  // Voor stabiele props naar de charts
  const deviationValues = useMemo(() => topDeviation.map(x => x.deviation), [topDeviation]);
  const deviationLabels = useMemo(() => topDeviation.map(x => x.cust), [topDeviation]);
  const topAbove = useMemo(() => topDeviation.filter(x => x.deviation > 0).length, [topDeviation]);

  // ---- Acties (Top 3) — concreet en bedraggedreven
  const actions = useMemo(() => {
    const majorPP = 5; // zelfde signaal als op Consistency
    const minorPP = 2;

    const items = topDeviation.map((c) => {
      if (c.deviation > majorPP) {
        return {
          key: 'act-major-' + c.cust,
          title: `Heronderhandel ${c.cust}`,
          desc: `${c.cust} zit ${c.deviation.toFixed(1)}pp boven benchmark bij omzet ${eur0(c.gross)}.`,
          amount: c.potential,
          type: 'major',
        };
      }
      if (c.deviation > minorPP) {
        return {
          key: 'act-minor-' + c.cust,
          title: `Harmoniseer korting ${c.cust}`,
          desc: `${c.cust} zit ${c.deviation.toFixed(1)}pp boven benchmark; converteer directe korting naar bonus/staffel.`,
          amount: c.potential,
          type: 'minor',
        };
      }
      if (c.deviation < -minorPP) {
        return {
          key: 'act-ret-' + c.cust,
          title: `Retentieactie ${c.cust}`,
          desc: `${c.cust} zit ${Math.abs(c.deviation).toFixed(1)}pp onder benchmark; voorkom churn met waarde i.p.v. korting.`,
          amount: 0,
          type: 'retention',
        };
      }
      return null;
    }).filter(Boolean) as { key: string; title: string; desc: string; amount: number; type: string }[];

    return items.sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 3);
  }, [topDeviation]);

  return (
    <main className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-gray-600">
            Overzicht van marges, kortingstrend, besparingspotentieel en aanbevolen acties.
          </p>
        </div>

        {/* Snelkoppelingen */}
        <nav aria-label="Snelkoppelingen" className="flex items-center gap-2">
          <Link href="/app/waterfall" className="text-sm rounded border px-3 py-2 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
            Naar Waterfall
          </Link>
          <Link href="/app/consistency" className="text-sm rounded border px-3 py-2 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
            Naar Consistency
          </Link>
        </nav>
      </header>

      {/* KPIs + charts */}
      <section className="grid md:grid-cols-3 gap-4" aria-label="Kern-KPI's en grafieken">
        {/* Donut-kaart: sky */}
        <article
          className="rounded-2xl border bg-white p-4 flex flex-col gap-3 text-sky-700 dark:text-sky-400"
          aria-label="Totaal Gross en gemiddelde korting"
          title={`Gemiddelde korting: ${fmtPct(avgDiscountPct)} • Totaal gross: ${eur0(grossTotal)}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Totaal Gross</div>
              <div className="text-lg font-semibold mt-1">{eur0(grossTotal)}</div>
            </div>
            <Donut value={avgDiscountPct} label="Gem. korting (overall)" />
          </div>
          <p className="text-xs text-gray-600">
            <span className="font-medium">{fmtPct(avgDiscountPct)}</span> gem. korting over alle rijen.
          </p>
        </article>

        {/* Sparkline-kaart: indigo */}
        <article
          className="rounded-2xl border bg-white p-4 text-indigo-700 dark:text-indigo-400"
          aria-label="Kortingpercentage over tijd"
          title={`Korting% over tijd • Laatste: ${fmtPct(lastPct)} • Range: ${fmtPct(minPct)}–${fmtPct(maxPct)}`}
        >
          <div className="text-sm text-gray-500">Korting% over tijd</div>
          <Sparkline data={periodPctSeries} />
          <div className="mt-2 text-xs text-gray-600">
            Laatste: <b>{fmtPct(lastPct)}</b> • Range: {fmtPct(minPct)}–{fmtPct(maxPct)}. Benchmark op detail zie Consistency.
          </div>
        </article>

        {/* MiniBar-kaart: sky */}
        <article
          className="rounded-2xl border bg-white p-4 text-sky-700 dark:text-sky-400"
          aria-label="Besparingspotentieel top 10 klanten"
          title={`Top 10 afwijkingen tov. benchmark • Potentieel: ${eur0(totalPotential)}`}
        >
          <div className="text-sm text-gray-500">Besparingspotentieel (Top 10 klanten)</div>
          <div className="text-lg font-semibold mt-1">{eur0(totalPotential)}</div>
          <div className="mt-2">
            <MiniBar
              values={deviationValues}
              labels={deviationLabels}
              valueFmt={(v) => v.toFixed(1) + 'pp'}
              tooltip={(_, v, l) => `${l}: ${v.toFixed(1)} pp tov. benchmark`}
            />
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {topAbove} van de top 10 liggen <b>boven</b> benchmark (positief = hogere korting).
          </div>
        </article>
      </section>

      {/* Top 3 acties */}
      <section className="rounded-2xl border bg-white p-4" aria-label="Aanbevolen acties">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Top 3 acties om marge te optimaliseren</h2>
          <span className="ml-auto text-xs px-2 py-1 rounded-full border bg-sky-50 text-sky-700 border-sky-200">
            Automatisch gegenereerd
          </span>
        </div>
        <ul className="mt-3 grid md:grid-cols-3 gap-3">
          {actions.length ? (
            actions.map((a) => (
              <li key={a.key} className="rounded-xl border p-3" title={a.desc}>
                <div className="font-medium">{a.title}</div>
                <p className="text-sm text-gray-700 mt-1">{a.desc}</p>
                {a.amount > 0 ? (
                  <div className="mt-2 text-sm">
                    Potentiële margeverbetering: <b>{eur0(a.amount)}</b>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-gray-600">Retentie / risicobeperking</div>
                )}
                <div className="mt-3">
                  <Link
                    href="/app/consistency"
                    className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                  >
                    Bekijk details →
                  </Link>
                </div>
              </li>
            ))
          ) : (
            <li className="text-sm text-gray-600">Geen urgente acties gedetecteerd.</li>
          )}
        </ul>
      </section>

      {/* Data & Upload */}
      <section className="rounded-2xl border bg-white p-4" aria-label="Data en upload">
        <h2 className="text-lg font-semibold">Data & Upload</h2>
        <p className="text-gray-600 text-sm mt-1">
          Werk je dataset bij om analyses up-to-date te houden.
        </p>

        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border p-4" title="Vervang de huidige dataset of voeg een periode toe (Excel)">
            <div className="text-sm font-medium">Upload / Replace</div>
            <p className="text-sm text-gray-600 mt-1">
              Vervang de huidige dataset of voeg een nieuwe periode toe (Excel).
            </p>
            <div className="mt-2">
              <Link
                href="/app/waterfall#upload"
                className="inline-flex items-center rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-sm px-4 py-2 hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
              >
                Naar upload
              </Link>
            </div>
          </div>

          <div className="rounded-xl border p-4" title="Download template en bekijk kolomdefinities">
            <div className="text-sm font-medium">Templates &amp; Datamapping</div>
            <p className="text-sm text-gray-600 mt-1">
              Download het Excel-template en bekijk kolomdefinities.
            </p>
            <div className="mt-2">
              <Link
                href="/app/waterfall#templates"
                className="inline-flex items-center rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
              >
                Bekijk templates
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Snelle links */}
      <section className="grid sm:grid-cols-2 gap-3" aria-label="Snelle links">
        <Link
          href="/app/waterfall"
          className="rounded-xl border bg-white p-4 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
          title="Uitsplitsing van korting-componenten en margebrug"
        >
          <div className="text-sm font-medium">Waterfall</div>
          <p className="text-sm text-gray-600">Uitsplitsing van korting-componenten en margebrug.</p>
        </Link>
        <Link
          href="/app/consistency"
          className="rounded-xl border bg-white p-4 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
          title="Benchmark per klant en direct besparingspotentieel"
        >
          <div className="text-sm font-medium">Consistency</div>
          <p className="text-sm text-gray-600">Benchmark per klant en direct besparingspotentieel.</p>
        </Link>
      </section>
    </main>
  );
}
