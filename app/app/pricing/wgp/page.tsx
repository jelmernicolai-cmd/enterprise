"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type WgpRow = { regnr: string; artikelnaam: string; maxprijs_eur: number; eenheid: string; };
type AipRow = {
  sku: string; name: string; pack: string; reg: string; zi: string; aip: number; moq?: number; caseQty?: number;
  unitsPerPack?: number; ppu?: number; packUnits?: number; custom?: Record<string, string | number>;
};
type MatchRow = {
  regnr: string; artikelnaamWgp: string; eenheid: string; maxprijs_eur: number;
  sku?: string; artikelnaamAip?: string; pack?: string; unitsPerPack: number;
  aip_pack_eur?: number; aip_per_eenheid?: number; delta_eur?: number; delta_pct?: number;
};

function eur(n: number) { return new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR",maximumFractionDigits:6}).format(Number.isFinite(n)?n:0); }
function pct(n: number) { return new Intl.NumberFormat("nl-NL",{style:"percent",maximumFractionDigits:1}).format(Number.isFinite(n)?n:0); }
function normReg(v: unknown) { return String(v ?? "").toUpperCase().replace(/[.\s]/g,"").trim(); }
function coerceNum(v: any, def = 0) { if (typeof v==="number") return v; const s=String(v??"").replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,""); const n=parseFloat(s); return isFinite(n)?n:def; }

export default function Wgp2Page() {
  const [wgp, setWgp] = useState<WgpRow[]>([]);
  const [aip, setAip] = useState<AipRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => { try { const raw = localStorage.getItem("aip_master_rows"); if (raw) setAip(JSON.parse(raw)); } catch {} }, []);
  const importAipFromApi = useCallback(async () => { alert("AIP wordt nu uit localStorage geladen. Vervang dit met een API-call als je serveropslag hebt."); }, []);

  const onUploadPdf = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/wgp/parse", { method: "POST", body: fd }); // ← nieuw endpoint
      const js = await r.json(); if (!r.ok) throw new Error(js?.error || "Upload/parsen mislukt");
      const rows: WgpRow[] = (js.rows || []).map((x: any) => ({
        regnr: String(x.reg || x.regnr || "").trim(),
        artikelnaam: String(x.artikelnaam || x.name || "").trim(),
        maxprijs_eur: Number(x.unit_price_eur || x.maxprijs_eur),
        eenheid: String(x.eenheid || x.unit || "").trim()
      }));
      setWgp(rows); localStorage.setItem("wgp2_last_rows", JSON.stringify(rows));
    } catch (err: any) {
      alert(err?.message || "Kon PDF niet verwerken.");
    } finally { setBusy(false); e.currentTarget.value = ""; }
  }, []);
  const loadLast = useCallback(() => { try { const raw = localStorage.getItem("wgp2_last_rows"); if (raw) setWgp(JSON.parse(raw)); } catch {} }, []);

  function unitsPerPack(r: AipRow): number {
    const explicit = r.unitsPerPack ?? r.ppu ?? r.packUnits ?? (typeof r.custom?.unitsPerPack === "number" ? (r.custom!.unitsPerPack as number) : undefined);
    if (typeof explicit === "number" && explicit > 0) return explicit;
    const s = (r.pack || "").toLowerCase();
    const mMulti = s.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
    if (mMulti) { const a=coerceNum(mMulti[1],NaN), b=coerceNum(mMulti[2],NaN); if (Number.isFinite(a)&&Number.isFinite(b)) return Math.round(a*b); }
    const mUnits = s.match(/\b(\d{1,4})\s*(?:st(?:uk|uks|.)|tabl|tabletten?|caps?|amp|sachet|pcs)/i);
    if (mUnits) return parseInt(mUnits[1],10);
    return 1;
  }

  const joined = useMemo<MatchRow[]>(() => {
    if (!wgp.length) return [];
    const idx = new Map<string, AipRow[]>();
    for (const r of aip) { const k = normReg(r.reg); if (!k) continue; const list = idx.get(k) || []; list.push(r); idx.set(k, list); }
    const out: MatchRow[] = [];
    for (const w of wgp) {
      const matches = idx.get(normReg(w.regnr)) || [];
      if (!matches.length) { out.push({ regnr:w.regnr, artikelnaamWgp:w.artikelnaam, eenheid:w.eenheid, maxprijs_eur:w.maxprijs_eur, unitsPerPack:1 }); continue; }
      for (const a of matches) {
        const u = unitsPerPack(a);
        const aipPerUnit = Number.isFinite(a.aip) && u > 0 ? a.aip / u : NaN;
        const delta = Number.isFinite(aipPerUnit) ? (aipPerUnit - w.maxprijs_eur) : NaN;
        const deltaPct = Number.isFinite(delta) && w.maxprijs_eur > 0 ? delta / w.maxprijs_eur : NaN;
        out.push({ regnr:w.regnr, artikelnaamWgp:w.artikelnaam, eenheid:w.eenheid, maxprijs_eur:w.maxprijs_eur, sku:a.sku, artikelnaamAip:a.name, pack:a.pack, unitsPerPack:u, aip_pack_eur:a.aip, aip_per_eenheid:aipPerUnit, delta_eur:delta, delta_pct:deltaPct });
      }
    }
    return out;
  }, [wgp, aip]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase(); if (!s) return joined;
    return joined.filter(r =>
      r.regnr.toLowerCase().includes(s) ||
      (r.sku||"").toLowerCase().includes(s) ||
      (r.artikelnaamAip||"").toLowerCase().includes(s) ||
      (r.artikelnaamWgp||"").toLowerCase().includes(s)
    );
  }, [joined, q]);

  const kpis = useMemo(() => {
    const nW = wgp.length, nA = aip.length;
    const matched = joined.filter(r => !!r.sku).length;
    const overCap = joined.filter(r => Number.isFinite(r.delta_eur) && (r.delta_eur as number) > 0).length;
    return { nW, nA, matched, overCap };
  }, [wgp, aip, joined]);

  const exportCsv = useCallback(() => {
    const headers = ["regnr","sku","artikelnaamAip","pack","unitsPerPack","aip_pack_eur","aip_per_eenheid","artikelnaamWgp","eenheid","wgp_max_eur","delta_eur","delta_pct"];
    const rows = filtered.map(r => [r.regnr, r.sku ?? "", r.artikelnaamAip ?? "", r.pack ?? "", r.unitsPerPack, r.aip_pack_eur ?? "", r.aip_per_eenheid ?? "", r.artikelnaamWgp, r.eenheid, r.maxprijs_eur, r.delta_eur ?? "", r.delta_pct ?? ""]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "wgp_vs_aip.csv"; a.click(); URL.revokeObjectURL(a.href);
  }, [filtered]);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6 space-y-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Wgp-builder (v2)</h1>
          <p className="mt-1 text-sm text-gray-600">Upload PDF met <b>eenheidsprijzen</b>, match op <b>regnr</b> en vergelijk met jouw <b>AIP per eenheid</b>.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/pricing" className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">← Terug naar Pricing</Link>
        </div>
      </header>

      <section className="rounded-2xl border bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg bg-sky-600 text-white text-sm px-4 py-2 hover:opacity-95 cursor-pointer">
            PDF uploaden
            <input type="file" accept=".pdf" onChange={onUploadPdf} className="hidden" />
          </label>
          <button onClick={loadLast} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">Laatste PDF-resultaat laden</button>
          <button onClick={importAipFromApi} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">AIP automatisch laden</button>
          <div className="ml-auto">
            <input placeholder="Zoek regnr/SKU/naam…" value={q} onChange={(e)=>setQ(e.target.value)} className="rounded-lg border px-3 py-2 text-sm w-56 sm:w-72" />
          </div>
        </div>
        {busy && <div className="mt-2 text-sm text-gray-600">PDF verwerken…</div>}
      </section>

      <section className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <Kpi title="WGP regels" value={String(kpis.nW)} />
        <Kpi title="AIP regels" value={String(kpis.nA)} />
        <Kpi title="Matches (regnr)" value={String(kpis.matched)} />
        <Kpi title="Boven cap" value={String(kpis.overCap)} help="AIP/eenheid > WGP-max" />
      </section>

      <section className="rounded-2xl border bg-white p-3 sm:p-4">
        <div className="overflow-auto">
          <table className="min-w-[1024px] w-full text-sm border-collapse">
            <thead className="bg-slate-50 border-b">
              <tr>
                <Th>Regnr</Th><Th>SKU</Th><Th>Product (AIP)</Th><Th>Pack</Th>
                <Th className="text-right">Eenh/pack</Th>
                <Th className="text-right">AIP/pack</Th>
                <Th className="text-right">AIP/eenh</Th>
                <Th>Product (WGP)</Th><Th>Eenh</Th>
                <Th className="text-right">WGP max/eenh</Th>
                <Th className="text-right">Δ €/eenh</Th>
                <Th className="text-right">Δ %</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r, i) => {
                const over = Number.isFinite(r.delta_eur) && (r.delta_eur as number) > 0;
                return (
                  <tr key={i} className={over ? "bg-rose-50" : ""}>
                    <Td>{r.regnr}</Td>
                    <Td>{r.sku || <span className="text-gray-400">—</span>}</Td>
                    <Td className="max-w-[280px]">{r.artikelnaamAip || <span className="text-gray-400">—</span>}</Td>
                    <Td>{r.pack || <span className="text-gray-400">—</span>}</Td>
                    <Td className="text-right">{r.unitsPerPack}</Td>
                    <Td className="text-right">{r.aip_pack_eur != null ? eur(r.aip_pack_eur) : "—"}</Td>
                    <Td className="text-right">{r.aip_per_eenheid != null ? eur(r.aip_per_eenheid) : "—"}</Td>
                    <Td className="max-w-[320px]">{r.artikelnaamWgp}</Td>
                    <Td>{r.eenheid}</Td>
                    <Td className="text-right">{eur(r.maxprijs_eur)}</Td>
                    <Td className={"text-right " + (over ? "text-rose-700 font-medium" : "")}>{r.delta_eur != null ? eur(r.delta_eur) : "—"}</Td>
                    <Td className="text-right">{r.delta_pct != null && Number.isFinite(r.delta_pct) ? pct(r.delta_pct) : "—"}</Td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="text-center text-sm text-gray-500 py-6">Geen rijen. Upload PDF en laad AIP.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={exportCsv} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">Exporteer CSV</button>
          <button onClick={() => { localStorage.setItem("wgp2_compare_rows", JSON.stringify(joined)); alert("Opgeslagen (lokaal)."); }} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">Opslaan in portal</button>
        </div>
      </section>
    </div>
  );
}

function Kpi({ title, value, help }: { title: string; value: string; help?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-3 sm:p-4">
      <div className="text-[12px] text-gray-600">{title}</div>
      <div className="text-lg sm:text-xl font-semibold mt-1">{value}</div>
      {help ? <div className="text-[11px] sm:text-xs text-gray-500 mt-1">{help}</div> : null}
    </div>
  );
}
function Th(props: React.HTMLAttributes<HTMLTableCellElement>) { return <th {...props} className={"text-left px-2 py-2 " + (props.className || "")} />; }
function Td(props: React.HTMLAttributes<HTMLTableCellElement>) { return <td {...props} className={"align-top px-2 py-1 " + (props.className || "")} />; }
