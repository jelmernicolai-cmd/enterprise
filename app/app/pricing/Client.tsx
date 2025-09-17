"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ApiProduct = {
  sku?: string;
  productName?: string;
  name?: string;
  packSize?: string;
  pack_size?: string;
  registration?: string;
  registration_no?: string;
  zi?: string;
  zi_number?: string;
  aip?: number | string;
  aip_eur?: number | string;
  minOrder?: number | string;
  min_order_qty?: number | string;
  casePack?: number | string;
  case_pack?: number | string;
  custom?: Record<string, any>;
};

function num(v: unknown, def = NaN) {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : def;
}
const eur = (n: number) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
const pct = (p: number) => `${Number.isFinite(p) ? Math.round(p * 100) : 0}%`;

function median(xs: number[]) {
  const arr = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!arr.length) return 0;
  const i = Math.floor((arr.length - 1) / 2);
  return arr[i];
}

export default function PricingAdminClient() {
  const [rows, setRows] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  async function loadSnapshot() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch("/api/pricing/products", { method: "GET" });
      const j = await res.json();
      if (!res.ok || !Array.isArray(j?.rows)) throw new Error(j?.error || "Kon data niet laden");
      setRows(j.rows as ApiProduct[]);
      setLoadedAt(new Date());
    } catch (e: any) {
      setErr(e?.message || "Onbekende fout");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSnapshot();
  }, []);

  const kpi = useMemo(() => {
    const n = rows.length;

    const aipVals = rows
      .map((r) => num(r.aip ?? r.aip_eur))
      .filter((x) => Number.isFinite(x) && x >= 0) as number[];

    const withAip = aipVals.length;
    const avgAip = withAip ? aipVals.reduce((s, x) => s + x, 0) / withAip : 0;
    const medAip = median(aipVals);
    const minAip = aipVals.length ? Math.min(...aipVals) : 0;
    const maxAip = aipVals.length ? Math.max(...aipVals) : 0;

    const ziOk = rows.filter((r) => {
      const z = (r.zi ?? r.zi_number ?? "").toString().trim();
      return /^\d{6,8}$/.test(z);
    }).length;

    const regOk = rows.filter((r) => {
      const reg = (r.registration ?? r.registration_no ?? "").toString().trim();
      return reg.length > 0;
    }).length;

    const invalid = rows.filter((r) => {
      const sku = (r.sku ?? "").toString().trim();
      const name = (r.productName ?? r.name ?? "").toString().trim();
      const aip = num(r.aip ?? r.aip_eur);
      const zi = (r.zi ?? r.zi_number ?? "").toString().trim();
      const bad =
        !sku ||
        !name ||
        !Number.isFinite(aip) ||
        aip < 0 ||
        (zi && !/^\d{6,8}$/.test(zi));
      return bad;
    }).length;

    const caseFilled = rows.filter((r) => {
      const c = r.casePack ?? r.case_pack;
      const q = num(c, NaN);
      return (Number.isFinite(q) && q > 0) || (!!c && String(c).trim().length > 0);
    }).length;

    return {
      n,
      withAip,
      avgAip,
      medAip,
      minAip,
      maxAip,
      ziCov: n ? ziOk / n : 0,
      regCov: n ? regOk / n : 0,
      invalid,
      caseCov: n ? caseFilled / n : 0,
    };
  }, [rows]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prijsbeheer</h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload/bewerk je AIP-lijst (SKU’s), genereer GIP-lijsten per klant en verwerk Wgp-wijzigingen.
          </p>
          <div className="mt-2 text-xs text-gray-500">
            {loading && <span className="mr-2">Momentje… snapshot laden</span>}
            {err && <span className="text-rose-600">Fout: {err}</span>}
            {!loading && !err && loadedAt && (
              <span>Snapshot geladen: {loadedAt.toLocaleString("nl-NL")}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadSnapshot}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            disabled={loading}
          >
            {loading ? "Vernieuwen…" : "Vernieuwen"}
          </button>
          <Link href="/templates#pricing" className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            Templates
          </Link>
          <Link href="/contact" className="rounded-lg bg-sky-600 px-3 py-2 text-sm text-white hover:bg-sky-700">
            Hulp nodig?
          </Link>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <KpiCard title="Totaal SKUs" value={String(kpi.n)} hint={kpi.n ? "Actieve items in snapshot" : "Geen data"} />
        <KpiCard title="Met geldige AIP" value={String(kpi.withAip)} hint={pct(kpi.n ? kpi.withAip / (kpi.n || 1) : 0)} />
        <KpiCard title="Gemiddelde AIP" value={eur(kpi.avgAip)} hint={`Mediaan: ${eur(kpi.medAip)}`} />
        <KpiCard title="Bandbreedte AIP" value={`${eur(kpi.minAip)} – ${eur(kpi.maxAip)}`} hint="Min – Max" />
        <KpiCard title="Registratie-dekking" value={pct(kpi.regCov)} hint="Met registratienummer" />
        <KpiCard title="ZI-dekking" value={pct(kpi.ziCov)} hint="Geldige ZI (6–8 cijfers)" />
        <KpiCard title="Case/Doos ingevuld" value={pct(kpi.caseCov)} hint="Deel met ingevulde doosverpakking" />
        <KpiCard title="Openstaande validaties" value={String(kpi.invalid)} hint={kpi.invalid ? "Los de rode velden op in AIP" : "OK"} tone={kpi.invalid ? "warn" : "ok"} />
      </section>

      {/* Actiekaarten */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card
          eyebrow="AIP-master"
          title="Lijstprijzen"
          desc="Beheer SKU, productnaam, verpakkingsgrootte, ZI-nummer, registratienummer en AIP. Import/Export Excel en opslaan in de portal."
          ctaLabel="Openen"
          href="/app/pricing/aip"
          footer={<div className="text-xs text-gray-500">Snapshot: {kpi.withAip}/{kpi.n} met geldige AIP</div>}
        />

        <Card
          eyebrow="GIP per klant"
          title="Prijslijsten"
          desc="Genereer GIP op basis van AIP minus groothandelskorting. Ondersteunt meerdere groothandels per SKU en export per groothandel."
          ctaLabel="Openen"
          href="/app/pricing/gip"
          footer={<div className="text-xs text-gray-500">Laadt AIP automatisch uit de portal</div>}
        />

        <Card
          eyebrow="Automatische updates"
          title="Wgp-builder"
          desc="Parseer Staatscourant-PDFs en update AIP’s via registratienummer-mapping. Handig voor periodieke wijzigingen."
          ctaLabel="Openen"
          href="/app/wgp-compare-targeted"
          tone="info"
          footer={<div className="text-xs text-gray-500">Bèta – PDF → regels → AIP update</div>}
        />
      </section>
    </div>
  );
}

/* ---------- Kleine UI building blocks ---------- */
function KpiCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "info";
}) {
  const toneClass =
    tone === "warn"
      ? "border-rose-200 bg-rose-50"
      : tone === "ok"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "info"
      ? "border-sky-200 bg-sky-50"
      : "bg-white";
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-[12px] text-gray-600">{title}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-gray-500">{hint}</div> : null}
    </div>
  );
}

function Card({
  eyebrow,
  title,
  desc,
  ctaLabel,
  href,
  tone,
  footer,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  ctaLabel: string;
  href: string;
  tone?: "info";
  footer?: React.ReactNode;
}) {
  const info = tone === "info";
  return (
    <div className={`rounded-2xl border p-4 ${info ? "border-sky-200 bg-white" : "bg-white"}`}>
      <div className={`text-sm ${info ? "text-sky-700" : "text-gray-500"}`}>{eyebrow}</div>
      <div className="mt-1 text-lg font-semibold">{title}</div>
      <p className="mt-2 text-sm text-gray-600">{desc}</p>
      <div className="mt-3 flex items-center justify-between">
        <Link
          href={href}
          className={`inline-flex items-center rounded-lg ${
            info ? "bg-sky-600 text-white hover:bg-sky-700" : "border hover:bg-gray-50"
          } px-3 py-2 text-sm`}
        >
          {ctaLabel}
        </Link>
        {footer}
      </div>
    </div>
  );
}
