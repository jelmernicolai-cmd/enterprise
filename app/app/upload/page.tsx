"use client";

import React, { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import type { NormalizedRow } from "@/lib/upload-schema";
import { normalizeRows } from "@/lib/upload-schema";
import { saveWaterfallRows, eur0 } from "@/lib/waterfall-storage";
import type { Row } from "@/lib/waterfall-types";

/**
 * Doel: dezelfde, eenvoudige UI behouden — maar achter de schermen
 * robuuster parsen/valideren/reconciliëren. Negatieve waarden (retours/correcties)
 * worden NIET weggepoetst en tellen gewoon mee in de totalen.
 */

type ParseResult = { report: ReturnType<typeof normalizeRows>; all: NormalizedRow[] };

/* -------------------- Helpers: CSV -------------------- */
function csvToJson(text: string): any[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]);
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const obj: any = {};
    headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));
    rows.push(obj);
  }
  return rows;
}
function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "",
    inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/* -------------------- Helpers: Numbers -------------------- */
/** Slimme parser: "1.234,56" → 1234.56, "(123)" → -123, "  " → 0, "€ 1.000" → 1000 */
function parseSmartNumber(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  let s = String(v).trim();
  if (!s) return 0;
  let neg = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    neg = true;
    s = s.slice(1, -1);
  }
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // NL-stijl
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // EN-stijl
    s = s.replace(/,/g, "");
  }
  s = s.replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
}

/* -------------------- Checks & balances (achtergrond) -------------------- */
const TOL = 0.5; // 50 cent per rij tolerantie bij reconciliatie

function sumDiscounts(r: NormalizedRow): number {
  return (
    (r.d_channel || 0) +
    (r.d_customer || 0) +
    (r.d_product || 0) +
    (r.d_volume || 0) +
    (r.d_other_sales || 0) +
    (r.d_mandatory || 0) +
    (r.d_local || 0)
  );
}
function sumRebates(r: NormalizedRow): number {
  return (
    (r.r_direct || 0) +
    (r.r_prompt || 0) +
    (r.r_indirect || 0) +
    (r.r_mandatory || 0) +
    (r.r_local || 0)
  );
}

/**
 * 1) Forceer numeriek (zonder tekenconversies: negatieven blijven negatief).
 * 2) Herleid ontbrekende invoiced/net (als leeg of niet-numeriek) vanuit identiteiten.
 * 3) Als bestaande waarden afwijken buiten tolerantie: voeg waarschuwing toe.
 * 4) Basiscontroles: periodeformaat, sleutelvelden.
 * Let op: we muteren het report-object (issues + preview) zodat UI hetzelfde kan blijven.
 */
function hardenReport(report: ReturnType<typeof normalizeRows>) {
  // defensief klonen (zoveel mogelijk dezelfde vorm behouden)
  const rows: NormalizedRow[] = report.preview.map((src) => ({ ...src }));
  const extraIssues: string[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];

    // numerieke velden forceren — TEKEN NIET AANPASSEN (negatieven blijven mee tellen)
    const numKeys: (keyof NormalizedRow)[] = [
      "gross",
      "d_channel",
      "d_customer",
      "d_product",
      "d_volume",
      "d_other_sales",
      "d_mandatory",
      "d_local",
      "invoiced",
      "r_direct",
      "r_prompt",
      "r_indirect",
      "r_mandatory",
      "r_local",
      "net",
    ];
    for (const k of numKeys) {
      (r as any)[k] = parseSmartNumber((r as any)[k]);
    }

    // identiteiten
    const disc = sumDiscounts(r);
    const reb = sumRebates(r);
    const invoicedCalc = (r.gross || 0) - disc;
    const netCalc = (Number.isFinite(r.invoiced) ? r.invoiced : invoicedCalc) - reb;

    // invoiced ontbreekt → afleiden
    if (!Number.isFinite(r.invoiced)) {
      r.invoiced = invoicedCalc;
      extraIssues.push(`Rij ${idx}: 'invoiced' ontbrak — afgeleid uit gross − Σdiscounts.`);
    } else if (Math.abs((r.invoiced || 0) - invoicedCalc) > TOL) {
      extraIssues.push(
        `Rij ${idx}: 'invoiced' wijkt af van gross − Σdiscounts met Δ ${eur0((r.invoiced || 0) - invoicedCalc)}.`
      );
    }

    // net ontbreekt → afleiden
    if (!Number.isFinite(r.net)) {
      r.net = netCalc;
      extraIssues.push(`Rij ${idx}: 'net' ontbrak — afgeleid uit invoiced − Σrebates.`);
    } else if (Math.abs((r.net || 0) - netCalc) > TOL) {
      extraIssues.push(`Rij ${idx}: 'net' wijkt af van invoiced − Σrebates met Δ ${eur0((r.net || 0) - netCalc)}.`);
    }

    // basisformaten
    if (!r.period || !/^\d{4}-\d{2}$/.test(String(r.period))) {
      extraIssues.push(`Rij ${idx}: 'period' verwacht als YYYY-MM.`);
    }
    if (!r.cust || !r.sku) {
      extraIssues.push(`Rij ${idx}: ontbrekende sleutelvelden (cust of sku).`);
    }
  }

  // Duplicaatdetectie op (period,cust,sku)
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const key = `${r.period}::${r.cust}::${r.sku}`;
    if (seen.has(key)) {
      extraIssues.push(`Rij ${i}: mogelijke dubbele sleutel (period,cust,sku).`);
    } else {
      seen.add(key);
    }
  });

  // schrijf terug in report zodat rest van de pagina ongewijzigd kan blijven
  (report as any).preview = rows;
  (report as any).issues = [...report.issues, ...extraIssues];
  return report;
}

/* =========================================================
   Component – UI ongewijzigd, backend robuuster gemaakt
   ========================================================= */
export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  }, []);

  const handleBrowse = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  };

  async function handleFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const ext = (file.name.toLowerCase().split(".").pop() || "").trim();
      let rows: any[] = [];

      if (ext === "xlsx" || ext === "xls") {
        const XLSX: any = await import("xlsx");
        if (!XLSX?.read || !XLSX?.utils) {
          throw new Error("Excel parser kon niet worden geladen (xlsx).");
        }
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      } else if (ext === "csv") {
        const text = await file.text();
        rows = csvToJson(text);
      } else {
        throw new Error("Ondersteunde formaten: .xlsx, .xls of .csv");
      }

      // 1) Schema-normalisatie
      let report = normalizeRows(rows);

      // 2) Achtergrond-robustheid (parsen, reconciliatie, basischecks)
      report = hardenReport(report);

      setResult({ report, all: report.preview });

      if (!report.ok) {
        setErr(
          "Bestand verwerkt maar er ontbreken kernkolommen of alle rijen zijn ongeldig. Zie details hieronder."
        );
      }
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Upload mislukt");
    } finally {
      setBusy(false);
    }
  }

  function toRowShape(input: NormalizedRow[]): Row[] {
    return input.map((r) => {
      const row: any = {
        period: r.period,
        cust: r.cust,
        pg: r.pg,
        sku: r.sku,
        gross: r.gross,
        d_channel: r.d_channel,
        d_customer: r.d_customer,
        d_product: r.d_product,
        d_volume: r.d_volume,
        d_other_sales: r.d_other_sales,
        d_mandatory: r.d_mandatory,
        d_local: r.d_local,
        invoiced: r.invoiced,
        r_direct: r.r_direct,
        r_prompt: r.r_prompt,
        r_indirect: r.r_indirect,
        r_mandatory: r.r_mandatory,
        r_local: r.r_local,
        net: r.net,
      };
      return row as Row;
    });
  }

  function onSave() {
    if (!result?.report.ok) return;
    const rows = toRowShape(result.report.preview);
    saveWaterfallRows(rows);
    alert("Dataset opgeslagen. Open Waterfall of Consistency om de analyses te bekijken.");
  }

  function onReset() {
    setResult(null);
    setErr(null);
    setBusy(false);
    setDragOver(false);
  }

  // Totals: NEGATIEVEN tellen GEWOON mee (retours/correcties)
  const totals = useMemo(() => {
    if (!result?.report.ok) return null;
    const r = result.report.preview;
    let gross = 0,
      disc = 0;
    for (const x of r) {
      gross += parseSmartNumber(x.gross);
      disc +=
        parseSmartNumber(x.d_channel) +
        parseSmartNumber(x.d_customer) +
        parseSmartNumber(x.d_product) +
        parseSmartNumber(x.d_volume) +
        parseSmartNumber(x.d_other_sales) +
        parseSmartNumber(x.d_mandatory) +
        parseSmartNumber(x.d_local);
    }
    return { gross, disc, pct: gross ? (disc / gross) * 100 : 0 };
  }, [result]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Upload – Masterdataset</h1>
          <p className="text-gray-600 text-sm">
            Deze masterfile voedt zowel de <b>Waterfall</b> als de <b>Consistency</b>-analyse. Eén dataset = consistente
            inzichten.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/waterfall" className="text-sm rounded border px-3 py-2 hover:bg-gray-50">
            Naar Waterfall
          </Link>
          <Link href="/app/consistency" className="text-sm rounded border px-3 py-2 hover:bg-gray-50">
            Naar Consistency
          </Link>
        </div>
      </header>

      {/* Dropzone */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={[
          "rounded-2xl border-2 border-dashed p-6 bg-white text-center transition",
          dragOver ? "border-sky-500 bg-sky-50/50" : "border-gray-200",
        ].join(" ")}
      >
        <div className="text-sm text-gray-700">Sleep je Excel/CSV hierheen of</div>
        <label className="mt-2 inline-flex items-center gap-2 rounded-lg bg-sky-600 text-white text-sm px-4 py-2 hover:bg-sky-700 cursor-pointer">
          Bestand kiezen
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBrowse} disabled={busy} />
        </label>
        <p className="mt-2 text-xs text-gray-500">
          Headers mogen variëren; we herkennen synoniemen en repareren decimale komma’s en periodes automatisch.
        </p>
        {busy && <div className="mt-2 text-sm text-gray-600">Bezig met verwerken…</div>}
        {err && (
          <div className="mt-3 inline-block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {err}
          </div>
        )}
      </section>

      {/* Werkafspraak-tip (zelfde plek/tonality aanhouden) */}
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-base font-semibold">Aanbevolen: samenstellen met Finance/Controller</h2>
        <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
          <li>
            Stem definities af: <i>Gross</i>, afzonderlijke <i>Discounts</i>, <i>Rebates</i>, en <i>Net</i> (formule:
            net = invoiced − rebates + incomes).
          </li>
          <li>Controleer periodes (YYYY-MM) en dat elk record één (SKU, klant, periode) is.</li>
          <li>Gebruik dezelfde bron als je P&L/BI om discussies te voorkomen.</li>
          <li>
            Negatieve bedragen (retours/correcties) zijn toegestaan en worden meegenomen in de totalen; je ziet ze
            terug in Waterfall/Consistency.
          </li>
        </ul>
      </section>

      {/* Rapport */}
      {result && (
        <section className="rounded-2xl border bg-white p-4 space-y-3">
          <h2 className="text-lg font-semibold">Resultaat validatie</h2>

          <div className="rounded-lg border p-3 text-sm">
            <div className="font-medium">Samenvatting</div>
            <div className="mt-1 text-gray-700">
              Rijen na normalisatie: <b>{result.report.rows}</b>
              <br />
              {totals && (
                <>
                  Totaal Gross: <b>{eur0(totals.gross)}</b>
                  <br />
                  Totaal Discounts: <b>{eur0(totals.disc)}</b> ({totals.pct.toFixed(1)}%)
                </>
              )}
            </div>
          </div>

          {result.report.missing.length > 0 && (
            <div className="rounded-lg border p-3 text-sm text-amber-800 bg-amber-50 border-amber-200">
              Ontbrekende velden die we niet konden mappen: {result.report.missing.join(", ")}
            </div>
          )}

          {result.report.issues.length > 0 && (
            <div className="rounded-lg border p-3 text-sm text-amber-800 bg-amber-50 border-amber-200">
              <div className="font-medium">Geconstateerde issues (max 50)</div>
              <ul className="list-disc pl-5">
                {result.report.issues.slice(0, 50).map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`rounded-lg px-4 py-2 text-sm border ${
                result.report.ok ? "bg-sky-600 text-white hover:bg-sky-700" : "opacity-50 cursor-not-allowed"
              }`}
              disabled={!result.report.ok}
              onClick={onSave}
            >
              Opslaan als dataset
            </button>
            <button type="button" onClick={onReset} className="rounded-lg px-4 py-2 text-sm border hover:bg-gray-50">
              Reset
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
