// components/contracts/UploadAndDashboard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import ContractDashboard from "./ContractDashboard";
import {
  analyze,
  type ContractLevel,
  type Row,
  type AnalyzeResult,
} from "../../lib/contract-analysis";

/* ---------- Header mapping (NL/EN) ---------- */
const ALIAS: Record<string, keyof Row> = {
  klant: "klant",
  sku: "sku",
  aantal_units: "aantal_units",
  claimbedrag: "claimbedrag",
  omzet: "omzet",
  periode: "periode",
  customer: "klant",
  units: "aantal_units",
  claim_amount: "claimbedrag",
  revenue: "omzet",
  period: "periode",
};
const REQUIRED_ROW_KEYS: Array<keyof Row> = [
  "klant",
  "sku",
  "aantal_units",
  "claimbedrag",
  "omzet",
  "periode",
];

function normalizeHeader(h: string) {
  return String(h || "").toLowerCase().trim();
}
function normalizePeriod(p: string) {
  const v = String(p || "").trim();
  if (/^\d{4}-\d{2}$/.test(v)) return v; // YYYY-MM
  if (/^\d{2}-\d{4}$/.test(v)) {
    const [mm, yyyy] = v.split("-");
    return `${yyyy}-${mm}`;
  }
  if (/^\d{4}-q[1-4]$/i.test(v)) return v.toUpperCase(); // YYYY-Qx
  throw new Error(`Ongeldig period-formaat: "${p}". Gebruik YYYY-MM, MM-YYYY of YYYY-Qx.`);
}
function toNum(x: any) {
  const n = typeof x === "number" ? x : parseFloat(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function periodRank(p: string): number {
  const m = p.match(/^(\d{4})-(\d{2})$/);
  if (m) return Number(m[1]) * 12 + Number(m[2]);
  const q = p.match(/^(\d{4})-Q([1-4])$/i);
  if (q) return Number(q[1]) * 12 + Number(q[2]) * 3; // eindmaand van kwartaal
  return -1;
}

/* ---------- Parsers ---------- */
function parseCsvToRows(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const headers = lines.shift()!.split(/[;,]/).map(normalizeHeader);
  const indexFor = (name: keyof Row) => headers.findIndex((h) => ALIAS[h] === name);

  const missing = REQUIRED_ROW_KEYS.filter((k) => indexFor(k) < 0);
  if (missing.length) {
    throw new Error(
      "Vereiste kolommen ontbreken. Gebruik NL: klant, sku, aantal_units, claimbedrag, omzet, periode — of EN: customer, sku, units, claim_amount, revenue, period."
    );
  }

  return lines.map((line) => {
    const c = line.split(/[;,]/);
    return {
      klant: (c[indexFor("klant")] || "").trim(),
      sku: (c[indexFor("sku")] || "").trim(),
      aantal_units: toNum(c[indexFor("aantal_units")]),
      claimbedrag: toNum(c[indexFor("claimbedrag")]),
      omzet: toNum(c[indexFor("omzet")]),
      periode: normalizePeriod(String(c[indexFor("periode")] || "")),
    } satisfies Row;
  });
}

async function parseXlsxToRows(buffer: ArrayBuffer): Promise<Row[]> {
  const XLSX = await import("xlsx"); // dynamic import
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" }) as any[][];
  if (!rows.length) return [];

  const headers = (rows[0] as any[]).map((h) => normalizeHeader(String(h)));
  const body = rows.slice(1);
  const indexFor = (name: keyof Row) => headers.findIndex((h) => ALIAS[h] === name);

  const missing = REQUIRED_ROW_KEYS.filter((k) => indexFor(k) < 0);
  if (missing.length) {
    throw new Error(
      "Vereiste kolommen ontbreken. Gebruik NL: klant, sku, aantal_units, claimbedrag, omzet, periode — of EN: customer, sku, units, claim_amount, revenue, period."
    );
  }

  return body.map((arr) => ({
    klant: String(arr[indexFor("klant")] ?? "").trim(),
    sku: String(arr[indexFor("sku")] ?? "").trim(),
    aantal_units: toNum(arr[indexFor("aantal_units")]),
    claimbedrag: toNum(arr[indexFor("claimbedrag")]),
    omzet: toNum(arr[indexFor("omzet")]),
    periode: normalizePeriod(String(arr[indexFor("periode")] ?? "")),
  }));
}

/* ---------- Component ---------- */
export default function UploadAndDashboard() {
  // Aggregatie
  const [level, setLevel] = useState<ContractLevel>("klant_sku");

  // Full dataset + gefilterde subset
  const [rawAll, setRawAll] = useState<Row[] | null>(null);
  const [raw, setRaw] = useState<Row[] | null>(null);

  // Analyse-result
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  // UI state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SKU filter state
  const [skuQuery, setSkuQuery] = useState("");
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());

  // Tabel-paginatie state
  const [page, setPage] = useState(0); // 0-gebaseerd; pagina 1 = 0

  // Afgeleide SKU-lijst (alfabetisch, met aantallen)
  const skuStats = useMemo(() => {
    const m = new Map<string, number>();
    (rawAll || []).forEach((r) => {
      if (!r.sku) return;
      m.set(r.sku, (m.get(r.sku) || 0) + 1);
    });
    const list = Array.from(m.entries())
      .map(([sku, count]) => ({ sku, count }))
      .sort((a, b) => a.sku.localeCompare(b.sku, "nl"));
    const q = skuQuery.trim().toLowerCase();
    return q ? list.filter((x) => x.sku.toLowerCase().includes(q)) : list;
  }, [rawAll, skuQuery]);

  // Filter toepassen + analyseren
  useEffect(() => {
    if (!rawAll) {
      setRaw(null);
      setResult(null);
      setPage(0);
      return;
    }
    const hasFilter = selectedSkus.size > 0;
    const subset = hasFilter ? rawAll.filter((r) => selectedSkus.has(r.sku)) : rawAll;

    setRaw(subset);
    setPage(0); // reset naar eerste pagina bij wijziging dataset/filter
    if (subset.length) {
      const analyzed = analyze(subset, level);
      setResult(analyzed);
    } else {
      setResult(null);
    }
  }, [rawAll, selectedSkus, level]);

  /* ---------- Periode-selectie (laatste & vorige) ---------- */
  const { lastP, prevP } = useMemo(() => {
    const periods = Array.from(new Set((raw || []).map((r) => r.periode))).sort(
      (a, b) => periodRank(a) - periodRank(b)
    );
    const last = periods.at(-1) || "";
    const prev = periods.at(-2) || "";
    return { lastP: last, prevP: prev };
  }, [raw]);

  /* ---------- KPI-extras (totals) ---------- */
  const kpiExtras = useMemo(() => {
    let curUnits = 0, prevUnits = 0, curRevenue = 0, prevRevenue = 0;
    (raw || []).forEach((r) => {
      if (r.periode === lastP) {
        curUnits += r.aantal_units || 0;
        curRevenue += r.omzet || 0;
      } else if (r.periode === prevP) {
        prevUnits += r.aantal_units || 0;
        prevRevenue += r.omzet || 0;
      }
    });
    return { periods: { last: lastP, prev: prevP }, totals: { curUnits, prevUnits, curRevenue, prevRevenue } };
  }, [raw, lastP, prevP]);

  /* ---------- Tabel-aggregatie per contract (afhankelijk van level) ---------- */
  type AggRow = {
    key: string;
    name: string;
    curUnits: number;
    prevUnits: number;
    deltaUnits: number;
    curRevenue: number;
  };
  const tableAgg: AggRow[] = useMemo(() => {
    const map = new Map<string, AggRow>();
    (raw || []).forEach((r) => {
      const key = level === "klant" ? r.klant : `${r.klant}||${r.sku}`;
      const name = level === "klant" ? r.klant : `${r.klant} • ${r.sku}`;
      const g = map.get(key) || { key, name, curUnits: 0, prevUnits: 0, deltaUnits: 0, curRevenue: 0 };
      if (r.periode === lastP) {
        g.curUnits += r.aantal_units || 0;
        g.curRevenue += r.omzet || 0;
      } else if (r.periode === prevP) {
        g.prevUnits += r.aantal_units || 0;
      }
      map.set(key, g);
    });
    const arr = Array.from(map.values()).map((g) => ({
      ...g,
      deltaUnits: (g.curUnits || 0) - (g.prevUnits || 0),
    }));
    // sorteer op grootste absolute verandering
    arr.sort((a, b) => Math.abs(b.deltaUnits) - Math.abs(a.deltaUnits));
    return arr;
  }, [raw, level, lastP, prevP]);

  /* ---------- Helpers: paginatie voor tabel ---------- */
  const totalRows = tableAgg.length;
  const pageCount = useMemo(() => {
    if (totalRows <= 0) return 1;
    if (totalRows <= 20) return 1;
    const remaining = totalRows - 20;
    return 1 + Math.ceil(remaining / 25);
  }, [totalRows]);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  function pageBounds(total: number, p: number) {
    if (total <= 0) return { start: 0, end: 0, size: 0 };
    if (p === 0) {
      const end = Math.min(20, total);
      return { start: 0, end, size: end - 0 };
    }
    const size = 25;
    const start = 20 + (p - 1) * size;
    const end = Math.min(start + size, total);
    return { start, end, size: end - start };
  }
  const { start, end, size } = pageBounds(totalRows, page);
  const pageRows = tableAgg.slice(start, end);

  /* ---------- Handlers ---------- */
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    try {
      const name = file.name.toLowerCase();
      let rows: Row[] = [];

      if (name.endsWith(".csv")) {
        const text = await file.text();
        rows = parseCsvToRows(text);
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        rows = await parseXlsxToRows(buffer);
      } else {
        throw new Error("Bestandsformaat niet ondersteund (upload .csv, .xlsx of .xls).");
      }

      setRawAll(rows);
      setSelectedSkus(new Set()); // reset filters
      setSkuQuery("");
    } catch (err: any) {
      setError(err?.message || "Uploaden of analyseren is mislukt.");
      setRawAll(null);
      setRaw(null);
      setResult(null);
    } finally {
      setBusy(false);
      e.target.value = ""; // reset input
    }
  }

  async function onExport() {
    if (!result || !raw) return;
    try {
      const res = await fetch("/api/contracts/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw, ...result }),
      });
      if (!res.ok) throw new Error("Export mislukt");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "contract_performance.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "Export mislukt");
    }
  }

  function toggleSku(sku: string) {
    setSelectedSkus((cur) => {
      const next = new Set(cur);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }
  function selectAllSkus() {
    const all = new Set((rawAll || []).map((r) => r.sku).filter(Boolean));
    setSelectedSkus(all);
  }
  function clearSkus() {
    setSelectedSkus(new Set());
  }

  const hasData = (rawAll?.length || 0) > 0;

  /* ---------- Render ---------- */
  return (
    <div className="space-y-6">
      {/* Upload + Instellingen */}
      <div className="rounded-2xl border bg-white p-4 md:p-5">
        <div className="flex flex-col gap-3 md:grid md:grid-cols-12 md:items-end">
          <div className="md:col-span-6">
            <label className="block text-sm text-gray-700">Bestand uploaden</label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={onUpload}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
            />
            <p className="mt-2 text-xs text-gray-500">
              CSV/Excel: <code>klant/customer</code>, <code>sku</code>, <code>aantal_units/units</code>,{" "}
              <code>claimbedrag/claim_amount</code>, <code>omzet/revenue</code>, <code>periode/period</code> (YYYY-MM, MM-YYYY of YYYY-Qx).
            </p>
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm text-gray-700">Aggregatie</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={level}
              onChange={(e) => setLevel(e.target.value as ContractLevel)}
              aria-label="Aggregatieniveau"
            >
              <option value="klant_sku">Klant + SKU</option>
              <option value="klant">Klant (geaggregeerd)</option>
            </select>
            <p className="mt-1 text-[11px] text-gray-500">Bepaalt hoe prestaties worden samengevat.</p>
          </div>

          {hasData && (
            <div className="md:col-span-3">
              <label className="block text-sm text-gray-700">Periodes</label>
              <div className="mt-1 text-sm">
                <span className="inline-block rounded-lg border bg-slate-50 px-2 py-1 mr-2">
                  Laatste: <b>{kpiExtras.periods.last || "—"}</b>
                </span>
                <span className="inline-block rounded-lg border bg-slate-50 px-2 py-1">
                  Vorige: <b>{kpiExtras.periods.prev || "—"}</b>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SKU-filter (optioneel) */}
      {hasData && (
        <div className="rounded-2xl border bg-white p-4 md:p-5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Filter op SKU</h3>
            <span className="ml-auto text-xs text-gray-500">
              {selectedSkus.size > 0 ? `${selectedSkus.size} geselecteerd` : `Alle SKUs`}
            </span>
          </div>

          {selectedSkus.size > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from(selectedSkus).slice(0, 12).map((sku) => (
                <button
                  key={sku}
                  onClick={() => toggleSku(sku)}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-gray-50"
                  title="Verwijderen uit selectie"
                >
                  {sku} <span className="text-gray-400">×</span>
                </button>
              ))}
              {selectedSkus.size > 12 && (
                <span className="text-xs text-gray-500">+{selectedSkus.size - 12} meer…</span>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={skuQuery}
              onChange={(e) => setSkuQuery(e.target.value)}
              placeholder="Zoek SKU…"
              className="rounded-lg border px-3 py-2 text-sm w-full sm:w-72"
            />
            <div className="flex gap-2">
              <button onClick={selectAllSkus} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                Selecteer alles
              </button>
              <button onClick={clearSkus} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-64 overflow-auto rounded-lg border">
            <ul className="divide-y text-sm">
              {skuStats.length === 0 ? (
                <li className="px-3 py-2 text-gray-500">Geen SKU’s gevonden voor deze zoekterm.</li>
              ) : (
                skuStats.map(({ sku, count }) => {
                  const checked = selectedSkus.has(sku);
                  return (
                    <li key={sku} className="flex items-center justify-between gap-3 px-3 py-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSku(sku)}
                          className="h-4 w-4"
                        />
                        <span className="font-mono">{sku}</span>
                      </label>
                      <span className="text-xs text-gray-500">{count}</span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Dashboard met bondige KPI's */}
      {result ? (
        <ContractDashboard dataOverride={result} kpiExtras={kpiExtras} />
      ) : hasData ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
          Je huidige filter levert <b>geen rijen</b> op. Pas je SKU-selectie aan of reset de filter.
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
          <div className="md:flex md:items-center md:justify-between">
            <p>Upload een CSV of Excel om het dashboard te vullen. Tip: gebruik het voorbeeldbestand.</p>
            <div className="mt-3 md:mt-0">
              <a href="/templates/dummy_contracts_nl.xlsx" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                Voorbeeldbestand downloaden
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ---- Tabel (responsief) met laatste vs vorige periode + paginatie ---- */}
      {hasData && (
        <div className="rounded-2xl border bg-white p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold">Contract-overzicht — units laatste vs vorige</h3>
            <div className="ml-auto text-xs text-gray-600">
              Totaal: {totalRows} • Pagina {page + 1} / {pageCount} • Deze pagina: {size}
            </div>
          </div>

          {/* Desktop/tablet table */}
          <div className="mt-3 overflow-auto hidden md:block">
            <table className="min-w-[920px] w-full text-sm border-collapse">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <Th>Contract</Th>
                  <Th className="text-right">Units {kpiExtras.periods.last || "laatste"}</Th>
                  <Th className="text-right">Units {kpiExtras.periods.prev || "vorige"}</Th>
                  <Th className="text-right">Δ Units</Th>
                  <Th className="text-right">Omzet {kpiExtras.periods.last || "laatste"} (€)</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500 py-6">Geen rijen op deze pagina.</td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.key} className="align-top">
                      <Td className="truncate max-w-[360px]">{r.name}</Td>
                      <Td className="text-right">{(r.curUnits || 0).toLocaleString("nl-NL")}</Td>
                      <Td className="text-right">{(r.prevUnits || 0).toLocaleString("nl-NL")}</Td>
                      <Td className={`text-right ${r.deltaUnits >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {r.deltaUnits >= 0 ? "▲" : "▼"} {Math.abs(r.deltaUnits).toLocaleString("nl-NL")}
                      </Td>
                      <Td className="text-right">
                        {(r.curRevenue || 0).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden mt-3 space-y-3">
            {pageRows.length === 0 ? (
              <div className="text-center text-gray-500 py-6">Geen rijen op deze pagina.</div>
            ) : (
              pageRows.map((r) => (
                <div key={r.key} className="rounded-xl border p-3">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <div className="text-[11px] text-gray-500">Units {kpiExtras.periods.last || "laatste"}</div>
                      <div className="font-medium">{(r.curUnits || 0).toLocaleString("nl-NL")}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <div className="text-[11px] text-gray-500">Units {kpiExtras.periods.prev || "vorige"}</div>
                      <div className="font-medium">{(r.prevUnits || 0).toLocaleString("nl-NL")}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 col-span-2">
                      <div className="text-[11px] text-gray-500">Δ Units</div>
                      <div className={`font-medium ${r.deltaUnits >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {r.deltaUnits >= 0 ? "▲" : "▼"} {Math.abs(r.deltaUnits).toLocaleString("nl-NL")}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    <b>Omzet:</b> {(r.curRevenue || 0).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Paginatie controls */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
            >
              ← Vorige
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
            >
              Volgende →
            </button>
            <div className="ml-auto text-xs text-gray-600">
              P1 toont 20 rijen; vervolgpagina’s 25 rijen.
            </div>
          </div>
        </div>
      )}

      {/* Export-knop */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onExport}
          disabled={!result || !raw}
          className="inline-flex items-center rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Exporteer naar Excel
        </button>
      </div>
    </div>
  );
}

/* ---------- Kleine table helpers ---------- */
function Th(props: React.HTMLAttributes<HTMLTableCellElement>) {
  return <th {...props} className={"text-left px-2 py-2 " + (props.className || "")} />;
}
function Td(props: React.HTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} className={"align-top px-2 py-1 " + (props.className || "")} />;
}
