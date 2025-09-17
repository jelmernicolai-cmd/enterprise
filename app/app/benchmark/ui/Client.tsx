"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/** ===================== Helpers ===================== */
const fmtEUR = (n: number, d = 2) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: d, minimumFractionDigits: d })
    .format(isFinite(n) ? n : 0);
const fmtPct = (n: number, d = 0) =>
  `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n)}%`;

const parseNL = (s: any): number => {
  if (typeof s === "number") return s;
  const t = String(s ?? "").trim();
  if (!t) return NaN;
  const norm = t.replace(/\./g, "").replace(",", ".").replace(/[^\d\.\-]/g, "");
  const n = parseFloat(norm);
  return isFinite(n) ? n : NaN;
};

type PublicRow = { name: string; atc4?: string; withoutArr: number; realized: number; year: number };
type AddOnRow = { zi: string; name: string; indication: string; maxTariff?: number; status: string };

type PortfolioRow = {
  id: string;
  product: string;
  atc4?: string;
  refPrice?: number;
  netPrice?: number;
  volume?: number;
  spendWithout?: number;
  spendRealized?: number;
  currentDisc?: number;
  targetDisc?: number;
};

function simpleCsvParse(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let val = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { val += '"'; i++; } else inQ = false; }
      else val += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(val); val = ""; }
      else if (c === "\n" || c === "\r") {
        if (val || cur.length) { cur.push(val); rows.push(cur); cur = []; val = ""; }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else val += c;
    }
  }
  if (val || cur.length) { cur.push(val); rows.push(cur); }
  return rows.filter(r => r.some(x => String(x).trim() !== ""));
}

function percentile(arr: number[], p: number) {
  if (!arr.length) return NaN;
  const a = [...arr].sort((x, y) => x - y);
  const idx = (a.length - 1) * p;
  const low = Math.floor(idx), high = Math.ceil(idx);
  if (low === high) return a[low];
  return a[low] + (a[high] - a[low]) * (idx - low);
}

/** Advies-logic */
type AdviceKey = "Defensief" | "Conform" | "Agressief";
function getAdvice(cur?: number, p10?: number, p90?: number): AdviceKey | undefined {
  if (!isFinite(cur!)) return undefined;
  if (isFinite(p10!) && cur! < p10!) return "Defensief";
  if (isFinite(p90!) && cur! > p90!) return "Agressief";
  return "Conform";
}
function adviceText(cur?: number, tgt?: number): string {
  if (!isFinite(cur!) || !isFinite(tgt!)) return "";
  const deltaPts = Math.round((tgt! - cur!) * 100);
  if (deltaPts > 1) return `Overweeg ~${deltaPts}%-punt méér korting naar target.`;
  if (deltaPts < -1) return `Overweeg ~${Math.abs(deltaPts)}%-punt mínder korting naar target.`;
  return "Je zit al rond het doelniveau.";
}

/** CSV export helper */
function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [ headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(",")) ];
  return lines.join("\n");
}

/** ===================== Component ===================== */
export default function Client() {
  /** ----------- Add-on context (NZa-max) ----------- */
  const [addons, setAddons] = useState<AddOnRow[]>([]);
  const [addonLoading, setAddonLoading] = useState(true);
  const [addonError, setAddonError] = useState<string | null>(null);
  const [qAddOn, setQAddOn] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/farmatec/addons", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        setAddons(await res.json());
      } catch (e: any) {
        setAddonError(e?.message ?? "Onbekende fout");
      } finally {
        setAddonLoading(false);
      }
    })();
  }, []);

  /** ----------- Benchmark bron + ATC4 filter ----------- */
  type Source = "dataset" | "manual" | "vws";
  const [source, setSource] = useState<Source>("dataset");

  // ATC4 filter (afhankelijk van bron)
  const [atcFilter, setAtcFilter] = useState<string>(""); // "" = geen filter

  // Handmatige percentielen
  const [mP10, setMP10] = useState<number | undefined>(undefined);
  const [mP50, setMP50] = useState<number | undefined>(undefined);
  const [mP90, setMP90] = useState<number | undefined>(undefined);

  // VWS (optioneel) – nu met ATC4 uit parser
  const [vwsUrl, setVwsUrl] = useState("");
  const [vwsLoading, setVwsLoading] = useState(false);
  const [vwsError, setVwsError] = useState<string | null>(null);
  const [publicRows, setPublicRows] = useState<PublicRow[]>([]);
  async function runVwsParse() {
    setVwsError(null);
    setVwsLoading(true);
    try {
      const body = vwsUrl ? { url: vwsUrl } : {};
      const res = await fetch("/api/discounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json();
      const rows = (payload.rows || []).map((r: any) => ({
        name: r.name, atc4: r.atc4, withoutArr: r.withoutArr, realized: r.realized, year: payload.year
      })) as PublicRow[];
      setPublicRows(rows);
      // stel ATC filter voor met meest voorkomende ATC4
      const counts = new Map<string, number>();
      rows.forEach(r => { if (r.atc4) counts.set(r.atc4, (counts.get(r.atc4) || 0) + 1); });
      const top = [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
      if (top) setAtcFilter(top);
    } catch (e: any) {
      setVwsError(e?.message ?? "Parserfout");
    } finally {
      setVwsLoading(false);
    }
  }

  /** ----------- Portfolio (GIP/CSV) ----------- */
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>([]);
  const [mapping, setMapping] = useState<{[k: string]: string}>({});
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [showMapper, setShowMapper] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onCsvFile(file: File) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const text = String(fr.result ?? "");
        const rows = simpleCsvParse(text);
        if (!rows.length) throw new Error("Leeg CSV-bestand");
        const headers = rows[0].map(h => h.trim());
        setRawHeaders(headers);
        setShowMapper(true);
        (fileRef.current as any).__rows = rows;
      } catch {
        alert("CSV kon niet verwerkt worden.");
      }
    };
    fr.readAsText(file);
  }

  function applyMapping() {
    const rows = (fileRef.current as any).__rows as string[][];
    const headers = rows[0];
    const idx = (name: string) => headers.findIndex(h => h.trim() === name);
    const get = (r: string[], key: string) => {
      const src = mapping[key];
      if (!src) return undefined;
      const i = idx(src);
      if (i < 0) return undefined;
      return r[i];
    };
    const out: PortfolioRow[] = rows.slice(1).map((r, i) => {
      const product = String(get(r, "product") ?? "").trim();
      const atc4 = String(get(r, "atc4") ?? "").trim() || undefined;
      const refPrice = parseNL(get(r, "ref_price"));
      const netPrice = parseNL(get(r, "net_price"));
      const volume = parseNL(get(r, "volume"));
      const spendWithout = parseNL(get(r, "spend_without"));
      const spendRealized = parseNL(get(r, "spend_realized"));
      return {
        id: `row-${i}-${Date.now()}`,
        product,
        atc4,
        refPrice: isFinite(refPrice) ? refPrice : undefined,
        netPrice: isFinite(netPrice) ? netPrice : undefined,
        volume: isFinite(volume) ? volume : undefined,
        spendWithout: isFinite(spendWithout) ? spendWithout : undefined,
        spendRealized: isFinite(spendRealized) ? spendRealized : undefined,
      };
    }).filter(r => r.product);

    out.forEach(r => {
      if (isFinite(r.refPrice!) && isFinite(r.netPrice!)) {
        r.currentDisc = (r.refPrice! - r.netPrice!) / r.refPrice!;
      } else if (isFinite(r.spendWithout!) && isFinite(r.spendRealized!) && r.spendWithout! > 0) {
        r.currentDisc = (r.spendWithout! - r.spendRealized!) / r.spendWithout!;
      } else if (isFinite(r.refPrice!) && isFinite(r.volume!) && isFinite(r.spendRealized!)) {
        const impliedNet = r.spendRealized! / r.volume!;
        r.currentDisc = (r.refPrice! - impliedNet) / r.refPrice!;
      } else {
        r.currentDisc = undefined;
      }
      r.targetDisc = r.currentDisc ?? 0.25;
    });

    setPortfolio(out);
    setShowMapper(false);

    // Stel ATC-filter voor op basis van dataset (meest voorkomend)
    const counts = new Map<string, number>();
    out.forEach(r => { if (r.atc4) counts.set(r.atc4, (counts.get(r.atc4) || 0) + 1); });
    const top = [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
    if (top) setAtcFilter(top);
  }

  function changeRow(rid: string, patch: Partial<PortfolioRow>) {
    setPortfolio(p => p.map(r => r.id === rid ? ({ ...r, ...patch }) : r));
  }

  /** ----------- Percentielen per bron + ATC4 ----------- */
  const distFromDataset = useMemo(() => {
    const subset = atcFilter
      ? portfolio.filter(r => (r.atc4 || "").toUpperCase() === atcFilter.toUpperCase())
      : portfolio;
    const xs = subset.map(r => r.currentDisc!).filter(v => isFinite(v) && v >= 0 && v < 2);
    if (!xs.length) return { p10: NaN, p50: NaN, p90: NaN, n: 0 };
    return { p10: percentile(xs, 0.10), p50: percentile(xs, 0.50), p90: percentile(xs, 0.90), n: xs.length };
  }, [portfolio, atcFilter]);

  const distFromVws = useMemo(() => {
    const subset = atcFilter
      ? publicRows.filter(r => (r.atc4 || "").toUpperCase() === atcFilter.toUpperCase())
      : publicRows;
    const xs = subset
      .map(r => (r.withoutArr - r.realized) / (r.withoutArr || NaN))
      .filter(v => isFinite(v) && v >= 0 && v < 2);
    if (!xs.length) return { p10: NaN, p50: NaN, p90: NaN, n: 0 };
    return { p10: percentile(xs, 0.10), p50: percentile(xs, 0.50), p90: percentile(xs, 0.90), n: xs.length };
  }, [publicRows, atcFilter]);

  const distFromManual = useMemo(() => {
    return { p10: mP10, p50: mP50, p90: mP90, n: NaN };
  }, [mP10, mP50, mP90]);

  const dist = useMemo(() => {
    if (source === "dataset") return distFromDataset;
    if (source === "vws") return distFromVws;
    return distFromManual;
  }, [source, distFromDataset, distFromVws, distFromManual]);

  /** ----------- Individuele benchmark (vrije invoer) ----------- */
  const [benchInputRef, setBenchInputRef] = useState("");
  const [benchInputNet, setBenchInputNet] = useState("");
  const refN = parseNL(benchInputRef);
  const netN = parseNL(benchInputNet);
  const benchDisc = isFinite(refN) && refN>0 && isFinite(netN) ? (refN - netN)/refN : NaN;

  /** ----------- Per-rij computed + totals ----------- */
  const perRowComputed = useMemo(() => {
    return portfolio.map(r => {
      const cur = r.currentDisc;
      const tgt = r.targetDisc ?? cur ?? 0;
      const adv = getAdvice(cur, dist.p10, dist.p90);
      let spendNow = 0, spendTarget = 0;
      if (isFinite(r.volume!) && isFinite(r.netPrice!) && isFinite(r.refPrice!)) {
        const targetPrice = (1 - tgt) * r.refPrice!;
        spendNow = r.volume! * r.netPrice!;
        spendTarget = r.volume! * targetPrice;
      } else if (isFinite(r.spendRealized!) && isFinite(r.spendWithout!)) {
        spendNow = r.spendRealized!;
        spendTarget = (1 - tgt) * r.spendWithout!;
      }
      const delta = spendNow - spendTarget;
      return { r, adv, delta, adviceText: adviceText(cur, tgt) };
    });
  }, [portfolio, dist]);

  const totals = useMemo(() => {
    let spendNow = 0, spendTarget = 0;
    portfolio.forEach(r => {
      const tgt = r.targetDisc ?? r.currentDisc ?? 0;
      if (isFinite(r.volume!) && isFinite(r.netPrice!) && isFinite(r.refPrice!)) {
        spendNow += r.netPrice! * r.volume!;
        spendTarget += (1 - tgt) * r.refPrice! * r.volume!;
      } else if (isFinite(r.spendRealized!) && isFinite(r.spendWithout!)) {
        spendNow += r.spendRealized!;
        spendTarget += (1 - tgt) * r.spendWithout!;
      } else if (isFinite(r.spendRealized!)) {
        spendNow += r.spendRealized!;
        spendTarget += r.spendRealized!;
      }
    });
    const cat = perRowComputed.reduce((acc, x) => {
      const k = x.adv ?? "—";
      (acc as any)[k] = ((acc as any)[k] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { spendNow, spendTarget, delta: spendNow - spendTarget, cat };
  }, [portfolio, perRowComputed]);

  /** ----------- CSV Export ----------- */
  function exportCsv() {
    const rows = perRowComputed.map(({ r, adv, delta }) => ({
      product: r.product,
      atc4: r.atc4 || "",
      ref_price: isFinite(r.refPrice!) ? r.refPrice : "",
      net_price: isFinite(r.netPrice!) ? r.netPrice : "",
      volume: isFinite(r.volume!) ? r.volume : "",
      spend_without: isFinite(r.spendWithout!) ? r.spendWithout : "",
      spend_realized: isFinite(r.spendRealized!) ? r.spendRealized : "",
      current_discount_pct: isFinite(r.currentDisc!) ? Math.round(r.currentDisc!*100) : "",
      target_discount_pct: isFinite(r.targetDisc!) ? Math.round(r.targetDisc!*100) : "",
      advice: adv ?? "",
      annual_delta_eur: Math.round(delta),
      benchmark_source: source,
      atc_filter: atcFilter || "",
    }));
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pricing-benchmark-portfolio-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  /** ===================== UI ===================== */
  const addOnOptions = useMemo(() => {
    const v = qAddOn.trim().toLowerCase();
    if (!v) return addons.slice(0, 50);
    return addons.filter((r) =>
      r.zi.toLowerCase().includes(v) || r.name.toLowerCase().includes(v) || r.indication.toLowerCase().includes(v)
    ).slice(0, 50);
  }, [addons, qAddOn]);

  // ATC4 keuzelijst afhankelijk van bron
  const atcOptions = useMemo(() => {
    if (source === "dataset") {
      const s = new Set<string>();
      portfolio.forEach(r => { if (r.atc4) s.add(r.atc4.toUpperCase()); });
      return Array.from(s).sort();
    }
    if (source === "vws") {
      const s = new Set<string>();
      publicRows.forEach(r => { if (r.atc4) s.add(r.atc4.toUpperCase()); });
      return Array.from(s).sort();
    }
    return [];
  }, [source, portfolio, publicRows]);

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Pricing Benchmark Tool (ATC4-aware)</h1>
          <p className="text-sm text-slate-600">
            Benchmark per <b>ATC4</b> op basis van je <b>eigen dataset</b> of (optioneel) de <b>VWS-sluisbijlage</b>. Handmatige range kan altijd.
          </p>
        </div>
      </header>

      {/* Brontransparantie */}
      {source==="vws" && (
        <div className="mt-3 rounded-xl border p-3 bg-amber-50 text-amber-900 text-sm">
          ⚠ De VWS-benchmark is gebaseerd op <b>sluisproducten met arrangement</b>. Dit dekt <i>niet</i> alle geneesmiddelen(sets). Gebruik ATC4-filter voor betere vergelijkbaarheid.
        </div>
      )}

      {/* ===== Benchmark bron & gauge ===== */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Benchmark & ATC4-filter">
          <div className="grid gap-3 md:grid-cols-2">
            {/* Bron + ATC-filter */}
            <div className="rounded-xl border p-3">
              <div className="text-sm font-medium mb-2">Benchmark bron</div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="src" checked={source==="dataset"} onChange={()=>setSource("dataset")} />
                  Uit eigen dataset (GIP/CSV)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="src" checked={source==="manual"} onChange={()=>setSource("manual")} />
                  Handmatige p10/p50/p90
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="src" checked={source==="vws"} onChange={()=>setSource("vws")} />
                  VWS-bijlage (sluis; optioneel)
                </label>
              </div>

              {/* Handmatig */}
              {source==="manual" && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <PctInput label="p10" value={mP10} onChange={setMP10}/>
                  <PctInput label="p50" value={mP50} onChange={setMP50}/>
                  <PctInput label="p90" value={mP90} onChange={setMP90}/>
                </div>
              )}

              {/* VWS loader */}
              {source==="vws" && (
                <div className="mt-3 flex flex-col gap-2">
                  <input className="border rounded-xl px-3 py-2" placeholder="https://…/Uitgaven_per_geneesmiddel_2023.pdf"
                    value={vwsUrl} onChange={(e)=>setVwsUrl(e.target.value)} />
                  <button onClick={runVwsParse} className="rounded-xl bg-slate-900 text-white px-4 py-2">Parse</button>
                  {vwsError && <p className="text-sm text-red-600">{vwsError}</p>}
                </div>
              )}

              {/* ATC4 keuzelijst */}
              {(source==="dataset" || source==="vws") && (
                <div className="mt-3">
                  <label className="text-xs text-slate-500">ATC4-filter (optioneel)</label>
                  <select className="mt-1 border rounded-xl px-3 py-2 w-full"
                          value={atcFilter}
                          onChange={(e)=>setAtcFilter(e.target.value)}>
                    <option value="">Alle ATC4</option>
                    {atcOptions.map(a=> <option key={a} value={a}>{a}</option>)}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Percentielen worden berekend binnen de gekozen ATC4 (indien gevuld); anders over de hele bronset.
                  </p>
                </div>
              )}

              {/* Add-on context */}
              <div className="mt-4">
                <label className="text-xs text-slate-500">Add-on context (NZa-max)</label>
                <input className="mt-1 border rounded-xl px-3 py-2 w-full" placeholder="Zoek op ZI / naam / indicatie…"
                  value={qAddOn} onChange={(e)=>setQAddOn(e.target.value)} />
                <div className="mt-2 max-h-36 overflow-auto border rounded-lg">
                  {addonLoading && <div className="p-3 text-sm">Laden…</div>}
                  {addonError && <div className="p-3 text-sm text-red-600">{addonError}</div>}
                  {!addonLoading && !addonError && addOnOptions.map((r)=>(
                    <div key={r.zi} className="p-2 border-b last:border-b-0 text-xs">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-slate-500">{r.zi} · {r.indication}</div>
                      <div className="mt-1">NZa-max: {typeof r.maxTariff==="number" ? fmtEUR(r.maxTariff,2) : "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Individuele gauge */}
            <BenchGaugePanel p10={dist.p10} p50={dist.p50} p90={dist.p90}
              benchInputRef={benchInputRef} benchInputNet={benchInputNet}
              setBenchInputRef={setBenchInputRef} setBenchInputNet={setBenchInputNet}
              value={benchDisc} />
          </div>
        </Card>

        {/* Dataset import/export */}
        <Card title="Dataset (GIP/CSV)">
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e)=>{ const f=e.target.files?.[0]; if (f) onCsvFile(f); }} />
            <div className="flex flex-wrap items-center gap-2">
              <button className="rounded-xl border px-4 py-2" onClick={()=>fileRef.current?.click()}>CSV importeren</button>
              <button className="rounded-xl border px-4 py-2" onClick={exportCsv} disabled={portfolio.length===0}>CSV exporteren</button>
            </div>
            <p className="text-xs text-slate-500">
              Kolommen: <code>product</code> | <code>atc4</code> (optioneel) | <code>ref_price</code> | <code>net_price</code> | <code>volume</code>  &nbsp;óf&nbsp;  <code>product</code> | <code>atc4</code> | <code>spend_without</code> | <code>spend_realized</code>.
            </p>
          </div>

          {showMapper && (
            <div className="mt-3 border rounded-xl p-3 bg-slate-50">
              <div className="text-sm font-medium mb-2">Kolommen toewijzen</div>
              <div className="grid md:grid-cols-3 gap-3">
                {["product","atc4","ref_price","net_price","volume","spend_without","spend_realized"].map((k)=>(
                  <div key={k} className="flex flex-col">
                    <label className="text-xs text-slate-500">{k}</label>
                    <select className="border rounded-lg px-2 py-1" value={mapping[k]||""}
                      onChange={(e)=>setMapping(m=>({...m,[k]:e.target.value}))}>
                      <option value="">—</option>
                      {rawHeaders.map(h=>(<option key={h} value={h}>{h}</option>))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button className="rounded-xl bg-slate-900 text-white px-4 py-2" onClick={applyMapping}>Toepassen</button>
                <button className="rounded-xl border px-4 py-2" onClick={()=>setShowMapper(false)}>Annuleren</button>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* ===== Portfolio Optimizer ===== */}
      <section className="mt-6">
        <Card title="Portfolio Optimizer">
          {portfolio.length===0 ? (
            <div className="text-sm text-slate-500">Importeer eerst een CSV om portfolio-adviezen te zien.</div>
          ) : (
            <>
              {/* Samenvatting */}
              <div className="rounded-xl border p-3 mb-3 bg-slate-50 grid sm:grid-cols-4 gap-3 text-sm">
                <div><div className="text-slate-500 text-xs">Benchmarkbron</div><div className="font-medium capitalize">{source}</div></div>
                <div><div className="text-slate-500 text-xs">ATC4-filter</div><div className="font-medium">{atcFilter || "Alle ATC4"}</div></div>
                <div><div className="text-slate-500 text-xs">p10–p50–p90</div><div className="font-medium">
                  {isFinite(dist.p10)?fmtPct(dist.p10*100,0):"—"} / {isFinite(dist.p50)?fmtPct(dist.p50*100,0):"—"} / {isFinite(dist.p90)?fmtPct(dist.p90*100,0):"—"}
                </div></div>
                <div><div className="text-slate-500 text-xs">Totale jaarimpact (nu − target)</div>
                  <div className={totals.delta>=0?"text-emerald-700 font-medium":"text-red-700 font-medium"}>{fmtEUR(totals.delta,0)}</div>
                </div>
              </div>

              {/* Tabel */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-slate-600">
                      <th className="text-left py-2 px-2">Product</th>
                      <th className="text-left py-2 px-2">ATC4</th>
                      <th className="text-right py-2 px-2">Ref €</th>
                      <th className="text-right py-2 px-2">Netto €</th>
                      <th className="text-right py-2 px-2">Volume</th>
                      <th className="text-right py-2 px-2">Zonder</th>
                      <th className="text-right py-2 px-2">Gerealiseerd</th>
                      <th className="text-right py-2 px-2">Huidig %</th>
                      <th className="text-right py-2 px-2">Target %</th>
                      <th className="text-left  py-2 px-2">Advies</th>
                      <th className="text-right py-2 px-2">Δ Jaar €</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perRowComputed.map(({ r, adv, delta, adviceText })=>{
                      const cur = r.currentDisc;
                      const tgt = r.targetDisc ?? cur ?? 0;
                      const colorCell = (v?:number) => {
                        if (!isFinite(v!)) return "bg-slate-100";
                        if (!isFinite(dist.p50)) return "bg-sky-50";
                        if (v! < (dist.p10 ?? 0)) return "bg-red-50";
                        if (v! < (dist.p50 ?? 0)) return "bg-amber-50";
                        if (v! < (dist.p90 ?? 1)) return "bg-emerald-50";
                        return "bg-emerald-100";
                      };
                      return (
                        <tr key={r.id} className="border-t align-top">
                          <td className="py-2 px-2 font-medium">{r.product}</td>
                          <td className="py-2 px-2">{r.atc4 || "—"}</td>
                          <td className="py-2 px-2 text-right">
                            <EditableNumber value={r.refPrice} onChange={(v)=>changeRow(r.id,{refPrice:v, currentDisc:deriveDisc(v, r.netPrice, r.volume, r.spendWithout, r.spendRealized)})}/>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <EditableNumber value={r.netPrice} onChange={(v)=>changeRow(r.id,{netPrice:v, currentDisc:deriveDisc(r.refPrice, v, r.volume, r.spendWithout, r.spendRealized)})}/>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <EditableNumber value={r.volume} onChange={(v)=>changeRow(r.id,{volume:v})}/>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <EditableNumber value={r.spendWithout} onChange={(v)=>changeRow(r.id,{spendWithout:v, currentDisc:deriveDisc(r.refPrice, r.netPrice, r.volume, v, r.spendRealized)})}/>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <EditableNumber value={r.spendRealized} onChange={(v)=>changeRow(r.id,{spendRealized:v, currentDisc:deriveDisc(r.refPrice, r.netPrice, r.volume, r.spendWithout, v)})}/>
                          </td>
                          <td className={`py-2 px-2 text-right ${colorCell(cur)}`}>{isFinite(cur!)? fmtPct(cur!*100,0):"—"}</td>
                          <td className="py-2 px-2 text-right">
                            <div className="flex items-center gap-2">
                              <input aria-label="target-slider" type="range" min={0} max={100} value={Math.round((tgt||0)*100)}
                                onChange={(e)=>changeRow(r.id,{targetDisc: Number(e.target.value)/100})}/>
                              <input className="w-16 border rounded px-2 py-1 text-right"
                                value={isFinite(tgt)? Math.round(tgt*100):""}
                                onChange={(e)=>{ const v=parseNL(e.target.value)/100; changeRow(r.id,{targetDisc:isFinite(v)?v:undefined}); }} />
                              <span className="text-xs text-slate-500">%</span>
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <div className="text-xs">
                              <div className="font-medium">{adv??"—"}</div>
                              <div className="text-slate-500">{adviceText}</div>
                            </div>
                          </td>
                          <td className={`py-2 px-2 text-right ${delta>=0?"text-emerald-700":"text-red-700"}`}>{fmtEUR(delta,0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </section>
    </div>
  );
}

/** ============== Subcomponents & utilities ============== */
function Card({ title, subtitle, badge, className, children }:{
  title: string; subtitle?: string; badge?: string; className?: string; children: React.ReactNode
}) {
  return (
    <section className={`rounded-2xl border p-4 bg-white shadow-sm ${className||""}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
        </div>
        {badge && <span className="text-xs rounded-full bg-slate-100 text-slate-700 px-2 py-1">{badge}</span>}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function BenchGaugePanel({
  p10, p50, p90, value,
  benchInputRef, benchInputNet, setBenchInputRef, setBenchInputNet
}:{
  p10?:number; p50?:number; p90?:number; value:number;
  benchInputRef:string; benchInputNet:string;
  setBenchInputRef:(s:string)=>void; setBenchInputNet:(s:string)=>void;
}) {
  return (
    <div className="rounded-xl border p-3">
      <label className="text-xs text-slate-500">Jouw referentie & netto</label>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <input className="border rounded-xl px-3 py-2" placeholder="Referentie (AIP/Wgp) €"
          value={benchInputRef} onChange={(e)=>setBenchInputRef(e.target.value)} />
        <input className="border rounded-xl px-3 py-2" placeholder="Jouw netto €"
          value={benchInputNet} onChange={(e)=>setBenchInputNet(e.target.value)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 items-center">
        <div className="col-span-1">
          <div className="text-xs text-slate-500 mb-1">Jouw korting</div>
          <Gauge value={isFinite(value) ? value : 0} p10={p10} p50={p50} p90={p90} />
        </div>
        <div className="col-span-1 text-sm space-y-1">
          <div>Jij: <b>{isFinite(value) ? fmtPct(value*100,0) : "—"}</b></div>
          <div>p10–p90: <b>{isFinite(p10!)?fmtPct(p10!*100,0):"—"} – {isFinite(p90!)?fmtPct(p90!*100,0):"—"}</b></div>
          <div>Mediaan: <b>{isFinite(p50!)?fmtPct(p50!*100,0):"—"}</b></div>
          <div className="text-xs text-slate-500">* Percentielen worden berekend binnen de gekozen bron en ATC4-filter.</div>
        </div>
      </div>
    </div>
  );
}

function PctInput({label, value, onChange}:{label:string; value?:number; onChange:(v:number|undefined)=>void}) {
  const [raw, setRaw] = useState(value==null?"":String(Math.round((value||0)*100)));
  useEffect(()=>{ setRaw(value==null?"":String(Math.round((value||0)*100))); }, [value]);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-8 text-slate-500">{label}</span>
      <input className="w-16 border rounded px-2 py-1 text-right" value={raw}
        onChange={(e)=>{ setRaw(e.target.value); const v=parseNL(e.target.value)/100; onChange(isFinite(v)?v:undefined); }} />
      <span className="text-xs text-slate-500">%</span>
    </div>
  );
}

function Gauge({ value, p10, p50, p90 }:{ value:number; p10?:number; p50?:number; p90?:number }) {
  const clamp01 = (x:number)=>Math.max(0, Math.min(1, x));
  const val = clamp01(isFinite(value)?value:0);
  const toXY = (t:number)=>({ x: 60 + 60*Math.cos(Math.PI*(1-t)), y: 60 + 60*Math.sin(Math.PI*(1-t)) });
  const g = toXY(val);
  const p10xy = isFinite(p10!)? toXY(clamp01(p10!)) : null;
  const p50xy = isFinite(p50!)? toXY(clamp01(p50!)) : null;
  const p90xy = isFinite(p90!)? toXY(clamp01(p90!)) : null;

  return (
    <svg viewBox="0 0 120 80" className="w-full h-auto">
      <path d="M0 60 A60 60 0 0 1 120 60" fill="none" stroke="#e2e8f0" strokeWidth="10" />
      {p10xy && <line x1={p10xy.x} y1={p10xy.y} x2={p10xy.x} y2={p10xy.y-8} stroke="#94a3b8" strokeWidth="2" />}
      {p50xy && <line x1={p50xy.x} y1={p50xy.y} x2={p50xy.x} y2={p50xy.y-10} stroke="#64748b" strokeWidth="2" />}
      {p90xy && <line x1={p90xy.x} y1={p90xy.y} x2={p90xy.x} y2={p90xy.y-8} stroke="#94a3b8" strokeWidth="2" />}
      <line x1="60" y1="60" x2={g.x} y2={g.y} stroke="#0f172a" strokeWidth="3" />
      <circle cx="60" cy="60" r="3" fill="#0f172a" />
    </svg>
  );
}

function EditableNumber({ value, onChange }:{ value?: number; onChange:(v:number|undefined)=>void }) {
  const [raw, setRaw] = useState(value==null?"":String(value));
  useEffect(()=>{ setRaw(value==null?"":String(value)); }, [value]);
  return (
    <input className="w-24 border rounded px-2 py-1 text-right"
      value={raw}
      onChange={(e)=>{ setRaw(e.target.value); const n = parseNL(e.target.value); onChange(isFinite(n)?n:undefined); }} />
  );
}

function deriveDisc(ref?: number, net?: number, volume?: number, without?: number, realized?: number): number|undefined {
  if (isFinite(ref!) && isFinite(net!)) return (ref!-net!)/ref!;
  if (isFinite(without!) && isFinite(realized!) && without!>0) return (without!-realized!)/without!;
  if (isFinite(ref!) && isFinite(volume!) && isFinite(realized!)) {
    const implied = realized!/volume!;
    return (ref!-implied)/ref!;
  }
  return undefined;
}
