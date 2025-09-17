"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/** ===================== Helpers ===================== */
const fmtEUR = (n: number, d = 0) =>
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

type PortfolioRow = {
  id: string;
  product: string;
  category?: PresetKey | "";
  atc4?: string;
  refPrice?: number;   // referentie (AIP/Wgp/max)
  netPrice?: number;   // netto inkoop
  volume?: number;     // jaarvolume (eenheden)
  spendWithout?: number; // spend zonder korting (optioneel alternatief)
  spendRealized?: number; // gerealiseerde spend (optioneel alternatief)
  currentDisc?: number;   // afgeleid
  targetDisc?: number;    // doelkorting
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
  return "Je zit rond het doel.";
}

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

function deriveDisc(ref?: number, net?: number, volume?: number, without?: number, realized?: number): number|undefined {
  if (isFinite(ref!) && isFinite(net!) && ref!>0) return (ref!-net!)/ref!;
  if (isFinite(without!) && isFinite(realized!) && without!>0) return (without!-realized!)/without!;
  if (isFinite(ref!) && isFinite(volume!) && isFinite(realized!) && ref!>0 && volume!>0) {
    const implied = realized!/volume!;
    return (ref!-implied)/ref!;
  }
  return undefined;
}

/** ===================== Evidence presets ===================== */
/** Sleutel-categorieën + percentielranges gebaseerd op literatuur/rapporten.
 *  Bron-logica:
 *  - Speciality/mono: 0–10% (Vogler 2017/2013)
 *  - Me-too: 10–25% (Vogler 2017; NZa-monitor)
 *  - Generiek/multi: 30–60% p10–p90, mediane ~45% (Ehlers/Denemarken + Vogler)
 *  - Sluis: 20–50% indicatief (Algemene Rekenkamer; variabel & vertrouwelijk)
 *  - Niet-sluis: ~20–30% (gemiddeld ~26%) (NZa/VIG)
 *  - Dure zonder alternatief: 0–20% (Vogler; Pomp-notitie)
 */
type PresetKey =
  | "speciality_mono"
  | "metoo"
  | "generic_multi"
  | "sluis"
  | "niet_sluis"
  | "duur_geen_alt";

const PRESETS: Record<PresetKey, {label:string; p10:number; p50:number; p90:number; note:string; refs:string[]}> = {
  speciality_mono: { label: "Speciality / mono-source", p10: 0.00, p50: 0.05, p90: 0.10,
    note: "Weinig alternatieven → beperkte korting.",
    refs: ["Vogler 2017 (Health Policy)", "Vogler 2013 (hospital discounts)"] },
  metoo: { label: "Me-too / therapeutische alternatieven", p10: 0.10, p50: 0.18, p90: 0.25,
    note: "Enige substitueerbaarheid → matig.",
    refs: ["Vogler 2017", "NZa monitor 2015"] },
  generic_multi: { label: "Generiek / multi-source", p10: 0.30, p50: 0.45, p90: 0.60,
    note: "Sterke concurrentie/tendering.",
    refs: ["Ehlers et al. 2022 (Denemarken analogue tenders)", "Vogler 2017"] },
  sluis: { label: "Sluis (NL, centraal arrangement)", p10: 0.20, p50: 0.35, p90: 0.50,
    note: "Sterk middel-afhankelijk; vertrouwelijk.",
    refs: ["Algemene Rekenkamer 2020", "VWS kamerbrieven"] },
  niet_sluis: { label: "Niet-sluis (regulier intramuraal)", p10: 0.20, p50: 0.26, p90: 0.30,
    note: "Gemiddeld ~26% korting.",
    refs: ["VIG/NZa 2019"] },
  duur_geen_alt: { label: "Dure middelen zonder alternatief", p10: 0.00, p50: 0.10, p90: 0.20,
    note: "Budgetcap/zekerheid belangrijker dan %.",
    refs: ["Vogler 2017", "Pomp-notitie ‘Dubbel onderhandelen’"] },
};

/** ===================== Component ===================== */
export default function BenchmarkApp() {
  /** ====== Benchmark bron ====== */
  type Source = "preset" | "manual" | "dataset";
  const [source, setSource] = useState<Source>("preset");

  // Handmatig / preset-percentielen
  const [mP10, setMP10] = useState<number | undefined>(PRESETS.speciality_mono.p10);
  const [mP50, setMP50] = useState<number | undefined>(PRESETS.speciality_mono.p50);
  const [mP90, setMP90] = useState<number | undefined>(PRESETS.speciality_mono.p90);

  // Preset-keuze
  const [preset, setPreset] = useState<PresetKey>("speciality_mono");
  useEffect(()=>{
    if (source !== "preset") return;
    const p = PRESETS[preset];
    setMP10(p.p10); setMP50(p.p50); setMP90(p.p90);
  }, [preset, source]);

  // ATC4 (optioneel, alleen voor dataset-berekening)
  const [atcFilter, setAtcFilter] = useState<string>("");

  /** ====== CSV/portfolio ====== */
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string,string>>({});
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
        (fileRef.current as any).__rows = rows;
        setRawHeaders(headers);
        setShowMapper(true);
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
      if (!product) return null as any;
      const atc4 = String(get(r, "atc4") ?? "").trim() || undefined;
      const category = String(get(r, "category") ?? "").trim() as PresetKey | "" || "";
      const refPrice = parseNL(get(r, "ref_price"));
      const netPrice = parseNL(get(r, "net_price"));
      const volume = parseNL(get(r, "volume"));
      const spendWithout = parseNL(get(r, "spend_without"));
      const spendRealized = parseNL(get(r, "spend_realized"));
      const row: PortfolioRow = {
        id: `row-${i}-${Date.now()}`,
        product, atc4, category,
        refPrice: isFinite(refPrice) ? refPrice : undefined,
        netPrice: isFinite(netPrice) ? netPrice : undefined,
        volume: isFinite(volume) ? volume : undefined,
        spendWithout: isFinite(spendWithout) ? spendWithout : undefined,
        spendRealized: isFinite(spendRealized) ? spendRealized : undefined,
      };
      row.currentDisc = deriveDisc(row.refPrice, row.netPrice, row.volume, row.spendWithout, row.spendRealized);
      row.targetDisc = row.currentDisc ?? defaultTargetFor(category);
      return row;
    }).filter(Boolean) as PortfolioRow[];

    setPortfolio(out);
    setShowMapper(false);

    // Stel ATC-filter voor (meest voorkomende)
    const counts = new Map<string, number>();
    out.forEach(r => { if (r.atc4) counts.set(r.atc4, (counts.get(r.atc4) || 0) + 1); });
    const top = [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
    if (top) setAtcFilter(top);
  }

  function defaultTargetFor(cat?: PresetKey | ""): number {
    if (!cat) return PRESETS.metoo.p50;
    return PRESETS[cat].p50;
  }

  function changeRow(id: string, patch: Partial<PortfolioRow>) {
    setPortfolio(p => p.map(r => r.id === id ? ({ ...r, ...patch }) : r));
  }

  /** ====== Dataset-percentielen (optioneel) ====== */
  const distFromDataset = useMemo(() => {
    const subset = atcFilter
      ? portfolio.filter(r => (r.atc4 || "").toUpperCase() === atcFilter.toUpperCase())
      : portfolio;
    const xs = subset.map(r => r.currentDisc!).filter(v => isFinite(v) && v >= 0 && v < 2);
    if (!xs.length) return { p10: NaN, p50: NaN, p90: NaN, n: 0 };
    return { p10: percentile(xs, 0.10), p50: percentile(xs, 0.50), p90: percentile(xs, 0.90), n: xs.length };
  }, [portfolio, atcFilter]);

  const distManual = useMemo(() => ({ p10: mP10, p50: mP50, p90: mP90, n: NaN }), [mP10, mP50, mP90]);

  const dist = useMemo(() => {
    if (source === "dataset") return distFromDataset;
    return distManual; // preset en manual gebruiken mP10/50/90
  }, [source, distFromDataset, distManual]);

  /** ====== Individuele benchmark ====== */
  const [refRaw, setRefRaw] = useState("");
  const [netRaw, setNetRaw] = useState("");
  const refN = parseNL(refRaw);
  const netN = parseNL(netRaw);
  const benchDisc = isFinite(refN) && refN>0 && isFinite(netN) ? (refN - netN)/refN : NaN;

  /** ====== Portfolio berekeningen ====== */
  const perRowComputed = useMemo(()=>{
    return portfolio.map(r=>{
      const cur = r.currentDisc;
      const tgt = r.targetDisc ?? cur ?? 0;
      const adv = getAdvice(cur, dist.p10, dist.p90);
      let spendNow = 0, spendTarget = 0;
      if (isFinite(r.volume!) && isFinite(r.netPrice!) && isFinite(r.refPrice!)) {
        spendNow = r.volume! * r.netPrice!;
        spendTarget = r.volume! * (1 - tgt) * r.refPrice!;
      } else if (isFinite(r.spendRealized!) && isFinite(r.spendWithout!)) {
        spendNow = r.spendRealized!;
        spendTarget = (1 - tgt) * r.spendWithout!;
      } else if (isFinite(r.spendRealized!)) {
        spendNow = r.spendRealized!;
        spendTarget = r.spendRealized!;
      }
      const delta = spendNow - spendTarget;
      return { r, adv, delta, adviceText: adviceText(cur, tgt) };
    });
  }, [portfolio, dist]);

  const totals = useMemo(()=>{
    let spendNow = 0, spendTarget = 0;
    portfolio.forEach(r=>{
      const tgt = r.targetDisc ?? r.currentDisc ?? defaultTargetFor(r.category);
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
    const cat = perRowComputed.reduce((acc, x)=>{
      const k = x.adv ?? "—";
      (acc as any)[k] = ((acc as any)[k] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { spendNow, spendTarget, delta: spendNow - spendTarget, cat };
  }, [portfolio, perRowComputed]);

  /** ====== Export ====== */
  function exportCsv() {
    const rows = perRowComputed.map(({ r, adv, delta }) => ({
      product: r.product,
      category: r.category || "",
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
      source: source,
      p10: isFinite(dist.p10!)? Math.round(dist.p10!*100):"",
      p50: isFinite(dist.p50!)? Math.round(dist.p50!*100):"",
      p90: isFinite(dist.p90!)? Math.round(dist.p90!*100):"",
    }));
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `benchmark-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  /** ====== UI ====== */
  const atcOptions = useMemo(()=>{
    const s = new Set<string>();
    portfolio.forEach(r=>{ if (r.atc4) s.add(r.atc4.toUpperCase()); });
    return Array.from(s).sort();
  }, [portfolio]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Geneesmiddel Discount Benchmark</h1>
          <p className="text-sm text-slate-600">
            Vergelijk jouw korting t.o.v. evidence-based percentielen of je eigen dataset. Optimaliseer je portfolio en exporteer resultaten.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Alles client-side · CSV in/out
        </div>
      </header>

      {/* --- Benchmark bron & presets --- */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Benchmark & percentielen">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Bron & configuratie */}
            <div className="rounded-2xl border p-3">
              <div className="text-sm font-medium mb-2">Bron</div>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="src" checked={source==="preset"} onChange={()=>setSource("preset")} />
                  Evidence-preset (literatuur)
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="src" checked={source==="manual"} onChange={()=>setSource("manual")} />
                  Handmatig p10/p50/p90
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="src" checked={source==="dataset"} onChange={()=>setSource("dataset")} />
                  Uit eigen dataset (CSV)
                </label>
              </div>

              {/* Presets */}
              {source==="preset" && (
                <div className="mt-3">
                  <label className="text-xs text-slate-500">Categorie</label>
                  <select className="mt-1 w-full border rounded-xl px-3 py-2"
                          value={preset} onChange={(e)=>setPreset(e.target.value as PresetKey)}>
                    {Object.entries(PRESETS).map(([k,v])=>(
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <div className="mt-2 text-xs text-slate-600">
                    <div className="font-medium">{PRESETS[preset].label}</div>
                    <div>{Math.round(PRESETS[preset].p10*100)}% / {Math.round(PRESETS[preset].p50*100)}% / {Math.round(PRESETS[preset].p90*100)}% · {PRESETS[preset].note}</div>
                  </div>
                </div>
              )}

              {/* Handmatig */}
              {source==="manual" && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <PctInput label="p10" value={mP10} onChange={setMP10}/>
                  <PctInput label="p50" value={mP50} onChange={setMP50}/>
                  <PctInput label="p90" value={mP90} onChange={setMP90}/>
                </div>
              )}

              {/* Dataset ATC4-filter */}
              {source==="dataset" && (
                <div className="mt-3">
                  <label className="text-xs text-slate-500">ATC4-filter (optioneel)</label>
                  <select className="mt-1 border rounded-xl px-3 py-2 w-full"
                          value={atcFilter} onChange={e=>setAtcFilter(e.target.value)}>
                    <option value="">Alle ATC4</option>
                    {atcOptions.map(a=> <option key={a} value={a}>{a}</option>)}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Percentielen worden berekend op basis van je geïmporteerde dataset (filter toepasbaar).
                  </p>
                </div>
              )}
            </div>

            {/* Individuele gauge */}
            <BenchGaugePanel p10={dist.p10} p50={dist.p50} p90={dist.p90}
              refRaw={refRaw} netRaw={netRaw}
              setRefRaw={setRefRaw} setNetRaw={setNetRaw}
              value={benchDisc} />
          </div>
        </Card>

        {/* Dataset import/export */}
        <Card title="Dataset (CSV)">
          <div className="flex flex-col gap-2 text-sm">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e)=>{ const f=e.target.files?.[0]; if (f) onCsvFile(f); }} />
            <div className="flex flex-wrap items-center gap-2">
              <button className="rounded-xl border px-4 py-2" onClick={()=>fileRef.current?.click()}>CSV importeren</button>
              <button className="rounded-xl border px-4 py-2" onClick={exportCsv} disabled={portfolio.length===0}>CSV exporteren</button>
            </div>
            <p className="text-xs text-slate-500">
              Kolommen (vrije volgorde): <code>product</code> | <code>category</code> (preset key optioneel) | <code>atc4</code> |
              <code>ref_price</code> | <code>net_price</code> | <code>volume</code> of <code>spend_without</code>/<code>spend_realized</code>.
            </p>
          </div>

          {showMapper && (
            <div className="mt-3 border rounded-xl p-3 bg-slate-50">
              <div className="text-sm font-medium mb-2">Kolommen toewijzen</div>
              <div className="grid md:grid-cols-3 gap-3">
                {["product","category","atc4","ref_price","net_price","volume","spend_without","spend_realized"].map((k)=>(
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

      {/* --- Portfolio Optimizer --- */}
      <section className="mt-6">
        <Card title="Portfolio Optimizer">
          {portfolio.length===0 ? (
            <div className="text-sm text-slate-500">Importeer een CSV om adviezen te zien.</div>
          ) : (
            <>
              {/* Samenvatting */}
              <div className="rounded-xl border p-3 mb-3 bg-slate-50 grid sm:grid-cols-4 gap-3 text-sm">
                <div><div className="text-slate-500 text-xs">Bron</div><div className="font-medium capitalize">{source}</div></div>
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
                      <th className="text-left py-2 px-2">Categorie</th>
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
                      const tgt = r.targetDisc ?? cur ?? defaultTargetFor(r.category);
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
                          <td className="py-2 px-2">
                            <select className="border rounded px-2 py-1"
                              value={r.category||""}
                              onChange={(e)=>changeRow(r.id,{ category: e.target.value as PresetKey | "" , targetDisc: defaultTargetFor(e.target.value as PresetKey)})}>
                              <option value="">—</option>
                              {Object.entries(PRESETS).map(([k,v])=>(<option key={k} value={k}>{v.label}</option>))}
                            </select>
                          </td>
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

      {/* --- Bronnenpaneel (transparantie) --- */}
      <section className="mt-6">
        <Card title="Bronnen & aannames" subtitle="De preset-ranges komen uit peer-reviewed artikelen en NL-rapporten.">
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li><b>Vogler et al., 2017</b> (Health Policy): payers’ experiences met vertrouwelijke kortingen; vaak 20–29%, soms &gt;30%.</li>
            <li><b>Vogler et al., 2013</b> (hospital use): speciality weinig korting; generiek meer; centrale inkoop werkt.</li>
            <li><b>Ehlers et al., 2022</b> (Denemarken): analogue tenders; gem. ~44% besparing; range zeer breed.</li>
            <li><b>Algemene Rekenkamer, 2020</b>: substantiële maar vertrouwelijke sluis-kortingen (middelafhankelijk).</li>
            <li><b>NZa/VIG, 2019</b>: ziekenhuizen bedingen gemiddeld ~26% op niet-sluis.</li>
            <li><b>Pomp-notitie</b>: voor dure mono-source vaak lage kortingen; andere condities (plafonds) relevant.</li>
          </ul>
          <p className="text-xs text-slate-500 mt-2">
            Gebruik deze presets als startpunt. Voor precisie: laad je eigen transacties en herbereken de percentielen met “Dataset”.
          </p>
        </Card>
      </section>
    </div>
  );
}

/** ============== UI subcomponents ============== */
function Card({ title, subtitle, className, children }:{
  title: string; subtitle?: string; className?: string; children: React.ReactNode
}) {
  return (
    <section className={`rounded-2xl border p-4 bg-white shadow-sm ${className||""}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function BenchGaugePanel({
  p10, p50, p90, value, refRaw, netRaw, setRefRaw, setNetRaw
}:{
  p10?:number; p50?:number; p90?:number; value:number;
  refRaw:string; netRaw:string;
  setRefRaw:(s:string)=>void; setNetRaw:(s:string)=>void;
}) {
  return (
    <div className="rounded-2xl border p-3">
      <label className="text-xs text-slate-500">Referentie en netto (één middel)</label>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <input className="border rounded-xl px-3 py-2" placeholder="Referentie €" value={refRaw} onChange={(e)=>setRefRaw(e.target.value)} />
        <input className="border rounded-xl px-3 py-2" placeholder="Netto €" value={netRaw} onChange={(e)=>setNetRaw(e.target.value)} />
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
          <div className="text-xs text-slate-500">Percentielen komen uit gekozen bron/preset.</div>
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

