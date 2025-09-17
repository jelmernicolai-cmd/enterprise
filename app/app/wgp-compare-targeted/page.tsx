// app/app/wgp-compare-targeted/page.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";

/** ================= Types ================= */
type AipRow = {
  sku?: string;
  name?: string;
  zi?: string;
  reg: string;
  pack: number;
  aip?: number;
};
type DiffRow = {
  reg: string;
  sku?: string;
  name?: string;
  zi?: string;
  pack: number | null;
  aip_current: number | null;
  unit_price_eur: number | null;
  aip_suggested: number | null;
  diff_eur: number | null;
  diff_pct: number | null;
  page?: number;
  update: boolean;
  note?: string;
};

/** ================= Helpers ================= */
function normReg(v: any) {
  return String(v ?? "").toUpperCase().replace(/[.\s]/g, "").trim();
}
function toNumEU(v: any, fallback = NaN) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")
    .trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}
function toAipRow(o: Record<string, any>): AipRow {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      if (o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== "")
        return o[k];
      const kk = Object.keys(o).find(
        (x) =>
          x.toLowerCase().replace(/\s|\./g, "") ===
          k.toLowerCase().replace(/\s|\./g, "")
      );
      if (kk) return o[kk];
    }
    return "";
  };
  const str = (v: any) => String(v ?? "").trim();
  const num = (v: any, fb = NaN) => toNumEU(v, fb);
  return {
    sku: str(pick("sku", "productcode")),
    name: str(pick("product", "productnaam", "product naam", "naam")),
    zi: str(pick("zi", "zi-nummer", "zinummer")),
    reg: normReg(
      pick(
        "reg",
        "registratienummer",
        "rvg",
        "rvgnr",
        "regnr",
        "reg.nr",
        "rvg nr",
        "rvg_nr"
      )
    ),
    pack: Math.max(
      0,
      Math.round(
        num(
          pick(
            "pack",
            "verpakking",
            "standaard verpakk. grootte",
            "standaard verpakking"
          ),
          0
        )
      )
    ),
    aip: num(pick("aip", "lijstprijs", "apotheekinkoopprijs"), NaN),
  };
}
async function readSheetToJson(file: File): Promise<any[]> {
  const ext = (file.name.toLowerCase().split(".").pop() || "").trim();
  if (ext === "xlsx" || ext === "xls") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: "" });
  }
  if (ext === "csv") {
    const txt = await file.text();
    const wb = XLSX.read(txt, { type: "string" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: "" });
  }
  throw new Error("Ondersteund: .xlsx, .xls, .csv");
}
function exportXlsx(filename: string, rows: any[], sheet = "Sheet1") {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".xlsx") ? filename : filename + ".xlsx";
  a.click();
  URL.revokeObjectURL(a.href);
}

/** ===== Targeted PDF scan (ultra-robust import, no worker) ===== */
const PRICE_RE = /([\d.,]+)\s*per\s+([A-Za-z]+)/i;
const REG_RE = /\b([A-Z0-9/\.]+(?:\/\/[A-Z0-9/\.]+)?)\b/g;

async function scanPdfForRegs(
  file: File,
  targetRegs: Set<string>,
  onProgress?: (done: number, total: number) => void
) {
  if (typeof window === "undefined") {
    throw new Error("PDF verwerken kan alleen in de browser (client-side).");
  }

  const buf = await file.arrayBuffer();

  // Robuuste dynamic import: probeer meerdere entrypoints, fallback naar default export
  let pdfjs: any = null;
  const candidates = [
    "pdfjs-dist",
    "pdfjs-dist/build/pdf",
    "pdfjs-dist/legacy/build/pdf",
  ];
  let lastErr: unknown = null;
  for (const c of candidates) {
    try {
      // @ts-ignore types verschillen per build
      const mod: any = await import(/* @vite-ignore */ c);
      const maybe = mod?.getDocument ? mod : (mod?.default ?? mod);
      if (maybe?.getDocument) {
        pdfjs = maybe;
        break;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  if (!pdfjs?.getDocument) {
    console.error("pdfjs import failed:", lastErr);
    throw new Error("Kan pdf.js niet laden. Controleer dat 'pdfjs-dist' is geïnstalleerd.");
  }

  // Zonder worker draaien (geen workerSrc nodig)
  const loadingTask = pdfjs.getDocument({
    data: buf,
    disableWorker: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    disableFontFace: true,
  });

  let pdf: any;
  try {
    pdf = await loadingTask.promise;
  } catch (e) {
    console.error("pdfjs getDocument() failed:", e);
    throw new Error("PDF openen mislukt. Is het bestand niet corrupt?");
  }

  const total = pdf.numPages;
  const found = new Map<string, { unit: number; page: number }>();
  const remaining = new Set(targetRegs);

  for (let p = 1; p <= total; p++) {
    let text = "";
    try {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text = (content.items as any[])
        .map((it) => (it as any).str || "")
        .join(" ");
    } catch (e) {
      console.warn(`Tekst extractie faalde op pagina ${p}:`, e);
      onProgress?.(p, total);
      continue;
    }

    // prijs zoeken
    let unit: number | null = null;
    const m = PRICE_RE.exec(text);
    if (m) {
      const val = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(val)) unit = val;
    }
    PRICE_RE.lastIndex = 0;

    // REGNR’s op de pagina
    let hit: RegExpExecArray | null;
    while ((hit = REG_RE.exec(text)) !== null) {
      const reg = normReg(hit[1]);
      if (unit !== null && remaining.has(reg)) {
        found.set(reg, { unit, page: p });
        remaining.delete(reg);
      }
    }
    REG_RE.lastIndex = 0;

    onProgress?.(p, total);
    if (remaining.size === 0) break;
  }

  return { found, totalPages: total };
}

/** ================= Page ================= */
export default function Page() {
  const [aip, setAip] = useState<AipRow[]>([]);
  const [diffs, setDiffs] = useState<DiffRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [thresholdPct, setThresholdPct] = useState<number>(0.001);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [aipName, setAipName] = useState<string>("");
  const [pdfName, setPdfName] = useState<string>("");
  const pdfFileRef = useRef<File | null>(null);

  async function onUploadAip(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(null);
    setBusy(true);
    setAipName(f.name);
    try {
      const json = await readSheetToJson(f);
      const rows = json.map(toAipRow).filter((r) => r.reg && r.pack > 0);
      setAip(rows);
    } catch (e: any) {
      setErr(e?.message || "AIP kon niet worden gelezen.");
    } finally {
      setBusy(false);
    }
  }
  function onPickPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    pdfFileRef.current = f;
    setPdfName(f ? f.name : "");
  }

  async function runTargetedScan() {
    const f = pdfFileRef.current;
    if (!f) {
      setErr("Kies eerst een Staatscourant PDF.");
      return;
    }
    if (!aip.length) {
      setErr("Upload eerst de AIP-master.");
      return;
    }
    setErr(null);
    setBusy(true);
    setProgress({ done: 0, total: 0 });

    try {
      const targetRegs = new Set(aip.map((r) => r.reg).filter(Boolean));
      const { found, totalPages } = await scanPdfForRegs(
        f,
        targetRegs,
        (done, total) => setProgress({ done, total })
      );

      const out: DiffRow[] = aip.map((r) => {
        const m = found.get(r.reg);
        const unit = m ? m.unit : null;
        const pack = Number.isFinite(r.pack) && r.pack > 0 ? r.pack : null;
        const current = Number.isFinite(r.aip as number) ? (r.aip as number) : null;
        const suggested =
          unit !== null && pack !== null ? +(unit * pack).toFixed(4) : null;

        let diff_eur: number | null = null;
        let diff_pct: number | null = null;
        let update = false;
        let note: string | undefined;

        if (current !== null && suggested !== null) {
          diff_eur = +(suggested - current).toFixed(4);
          if (current !== 0) {
            diff_pct = +(diff_eur / current).toFixed(6);
            update = Math.abs(diff_pct) >= thresholdPct;
          } else {
            diff_pct = null;
            update = true;
          }
        } else {
          if (unit === null) note = "Geen eenheidsprijs gevonden in PDF";
          if (pack === null)
            note = note ? `${note}; pack ontbreekt/ongeldig` : "Pack ontbreekt/ongeldig";
          if (current === null)
            note = note ? `${note}; AIP ontbreekt` : "AIP ontbreekt";
        }

        return {
          reg: r.reg,
          sku: r.sku,
          name: r.name,
          zi: r.zi,
          pack,
          aip_current: current,
          unit_price_eur: unit,
          aip_suggested: suggested,
          diff_eur,
          diff_pct,
          page: m?.page,
          update,
          note,
        };
      });

      setDiffs(out);
      setProgress({ done: totalPages, total: totalPages });
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Scannen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  const nMatched = useMemo(
    () => diffs.filter((d) => d.unit_price_eur !== null).length,
    [diffs]
  );
  const nUpdate = useMemo(() => diffs.filter((d) => d.update).length, [diffs]);

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 lg:px-6 py-6 space-y-6">
      <header className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-semibold">
            Wgp Compare — gericht scannen (client-only)
          </h1>
          <span className="ml-auto">
            <Link
              href="/app/pricing"
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              ← Terug naar Pricing-dashboard
            </Link>
          </span>
        </div>
        <p className="text-sm text-gray-700 mt-1">
          Upload je <b>AIP-master</b> en de <b>Staatscourant-PDF</b>. We scannen
          pagina’s gericht op jouw REGNR’s en nemen de prijs van die pagina over.
          Geen server, werkt ook met héle grote PDF’s.
        </p>
      </header>

      <section className="rounded-2xl border bg-white p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm block" htmlFor="aipInput">
            <div className="font-medium">AIP-master (.xlsx/.csv)</div>
            <input
              id="aipInput"
              type="file"
              accept=".xlsx,.xls,.csv"
              // belangrijk: reset vóór selecteren, zodat dezelfde file opnieuw kan
              onClick={(e) => ((e.currentTarget as HTMLInputElement).value = "")}
              onChange={onUploadAip}
              className="mt-1 block w-full rounded-md border px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              {aipName ? <>Gekozen: <b>{aipName}</b></> : "Kolommen: REGNR (reg/regnr/rvg) + pack, optioneel SKU/naam/ZI/AIP."}
            </p>
          </label>

          <label className="text-sm block" htmlFor="pdfInput">
            <div className="font-medium">Staatscourant PDF (groot toegestaan)</div>
            <input
              id="pdfInput"
              type="file"
              accept=".pdf"
              onClick={(e) => ((e.currentTarget as HTMLInputElement).value = "")}
              onChange={onPickPdf}
              className="mt-1 block w-full rounded-md border px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              {pdfName ? <>Gekozen: <b>{pdfName}</b></> : "We verwerken pagina’s in de browser met pdfjs."}
            </p>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs inline-flex items-center gap-2">
            Drempel Δ%:
            <input
              type="number"
              step="0.001"
              value={+(thresholdPct * 100).toFixed(3)}
              onChange={(e) =>
                setThresholdPct(Math.max(0, Number(e.target.value) / 100))
              }
              className="w-24 rounded-md border px-2 py-1.5 text-sm text-right"
            />
            %
          </label>

          <button
            onClick={runTargetedScan}
            disabled={!aip.length || !pdfFileRef.current}
            className="rounded-md bg-emerald-600 text-white px-3 py-2 text-sm hover:opacity-95 disabled:opacity-50"
          >
            Scan & Vergelijk
          </button>

          <button
            onClick={() => {
              if (!diffs.length) return;
              const rows = diffs.map((r) => ({
                REGNR: r.reg,
                SKU: r.sku ?? "",
                Product: r.name ?? "",
                ZI: r.zi ?? "",
                Pack: r.pack ?? "",
                AIP_huidig: r.aip_current ?? "",
                Eenheidsprijs: r.unit_price_eur ?? "",
                AIP_voorgesteld: r.aip_suggested ?? "",
                Verschil_EUR: r.diff_eur ?? "",
                Verschil_pct:
                  r.diff_pct !== null && r.diff_pct !== undefined
                    ? +(r.diff_pct * 100).toFixed(3)
                    : "",
                Pagina: r.page ?? "",
                Bijwerken: r.update ? "JA" : "NEE",
                Opmerking: r.note ?? "",
              }));
              exportXlsx("wgp_aip_diffs_targeted.xlsx", rows, "Diffs");
            }}
            disabled={!diffs.length}
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Exporteer diffs (Excel)
          </button>

          {progress && (
            <span className="text-sm text-gray-600">
              Pagina {Math.min(progress.done, progress.total)} /{" "}
              {progress.total || "..."}
            </span>
          )}

          {busy && <span className="text-sm text-gray-600">Bezig…</span>}
          {err && (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {err}
            </span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-3 sm:p-4">
        <div className="text-sm font-medium">
          Resultaat:{" "}
          {diffs.length
            ? `${useMemo(
                () => diffs.filter((d) => d.unit_price_eur !== null).length,
                [diffs]
              )}/${diffs.length} matched • ${
                useMemo(() => diffs.filter((d) => d.update).length, [diffs])
              } bijwerken`
            : "nog geen vergelijking"}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-2 py-2 text-left">REGNR</th>
                <th className="px-2 py-2 text-left">SKU</th>
                <th className="px-2 py-2 text-left">Product</th>
                <th className="px-2 py-2 text-left">ZI</th>
                <th className="px-2 py-2 text-right">Pack</th>
                <th className="px-2 py-2 text-right">AIP huidig (€)</th>
                <th className="px-2 py-2 text-right">Unit (€)</th>
                <th className="px-2 py-2 text-right">AIP voorgesteld (€)</th>
                <th className="px-2 py-2 text-right">Δ €</th>
                <th className="px-2 py-2 text-right">Δ %</th>
                <th className="px-2 py-2 text-left">Bijwerken?</th>
                <th className="px-2 py-2 text-left">Pagina</th>
                <th className="px-2 py-2 text-left">Opmerking</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {diffs.map((r) => (
                <tr key={r.reg}>
                  <td className="px-2 py-1">{r.reg}</td>
                  <td className="px-2 py-1">{r.sku ?? ""}</td>
                  <td className="px-2 py-1">{r.name ?? ""}</td>
                  <td className="px-2 py-1">{r.zi ?? ""}</td>
                  <td className="px-2 py-1 text-right">{r.pack ?? "-"}</td>
                  <td className="px-2 py-1 text-right">{r.aip_current ?? "-"}</td>
                  <td className="px-2 py-1 text-right">{r.unit_price_eur ?? "-"}</td>
                  <td className="px-2 py-1 text-right">{r.aip_suggested ?? "-"}</td>
                  <td className="px-2 py-1 text-right">{r.diff_eur ?? "-"}</td>
                  <td className="px-2 py-1 text-right">
                    {r.diff_pct !== null && r.diff_pct !== undefined
                      ? `${+(r.diff_pct * 100).toFixed(3)}%`
                      : "-"}
                  </td>
                  <td className="px-2 py-1">{r.update ? "JA" : "NEE"}</td>
                  <td className="px-2 py-1">{r.page ?? "-"}</td>
                  <td className="px-2 py-1">{r.note ?? ""}</td>
                </tr>
              ))}
              {!diffs.length && (
                <tr>
                  <td colSpan={13} className="px-2 py-6 text-center text-gray-500">
                    Upload AIP + PDF en klik “Scan & Vergelijk”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
