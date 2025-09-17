// components/UploadAndAnalyze.tsx
"use client";

import { useState } from "react";
import { parse } from "csv-parse/browser/esm/sync";
import * as XLSX from "xlsx";

export type Mode = "waterfall" | "consistency" | "parallel";

function fmtEUR(n: number) {
  const val = typeof n === "number" && isFinite(n) ? n : 0;
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(val);
}

// Helpers
function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    // verwijder € , . spaties
    const clean = v.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(clean);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function normalizeRows(rawRows: any[]): any[] {
  // trim alle kolomnamen en map naar een “schone” key
  return rawRows.map((r) => {
    const out: Record<string, any> = {};
    Object.keys(r).forEach((k) => {
      const nk = String(k).trim(); // <-- belangrijk: headers uit jouw template hebben spaties
      out[nk] = r[k];
    });
    return out;
  });
}

export default function UploadAndAnalyze({ mode }: { mode: Mode }) {
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ title: string; metrics: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(f: File) {
    setError(null);
    setSummary(null);
    setFileName(f.name);
    setLoading(true);

    try {
      const buf = await f.arrayBuffer();
      let rows: any[] = [];

      if (f.name.toLowerCase().endsWith(".csv")) {
        const text = new TextDecoder().decode(new Uint8Array(buf));
        const parsed = parse(text, { columns: true, skip_empty_lines: true });
        rows = Array.isArray(parsed) ? parsed : [];
      } else {
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws); // eerste rij = headers
      }

      const data = normalizeRows(rows);

      if (!data.length) {
        setError("Geen rijen gevonden. Klopt het bestand en de sheet?");
        return;
      }

      if (mode === "waterfall") {
        // Vereiste kolommen (getrimd):
        // "Sum of Gross Sales", "Sum of Channel Discounts", "Sum of Customer Discounts",
        // "Sum of Product Discounts", "Sum of Volume Discounts", "Sum of Value Discounts",
        // "Sum of Other Sales Discounts", "Sum of Mandatory Discounts", "Sum of Discount Local",
        // "Sum of Direct Rebates", "Sum of Prompt Payment Rebates", "Sum of Indirect Rebates",
        // "Sum of Mandatory Rebates", "Sum of Rebate Local"

        const gross = data.reduce((a, r) => a + toNumber(r["Sum of Gross Sales"]), 0);

        const discounts = data.reduce(
          (a, r) =>
            a +
            toNumber(r["Sum of Channel Discounts"]) +
            toNumber(r["Sum of Customer Discounts"]) +
            toNumber(r["Sum of Product Discounts"]) +
            toNumber(r["Sum of Volume Discounts"]) +
            toNumber(r["Sum of Value Discounts"]) +
            toNumber(r["Sum of Other Sales Discounts"]) +
            toNumber(r["Sum of Mandatory Discounts"]) +
            toNumber(r["Sum of Discount Local"]),
          0
        );

        const rebates = data.reduce(
          (a, r) =>
            a +
            toNumber(r["Sum of Direct Rebates"]) +
            toNumber(r["Sum of Prompt Payment Rebates"]) +
            toNumber(r["Sum of Indirect Rebates"]) +
            toNumber(r["Sum of Mandatory Rebates"]) +
            toNumber(r["Sum of Rebate Local"]),
          0
        );

        setSummary({
          title: "Gross-to-Net Waterfall — samenvatting",
          metrics: [
            `Total Gross Sales: ${fmtEUR(gross)}`,
            `Total Discounts: ${fmtEUR(discounts)}`,
            `Total Rebates: ${fmtEUR(rebates)}`,
          ],
        });
      } else if (mode === "consistency") {
        // Vereiste kolommen (getrimd):
        // "Sum of Gross Sales", "Sum of Total GtN Spend"
        const gross = data.reduce((a, r) => a + toNumber(r["Sum of Gross Sales"]), 0);
        const gtn = data.reduce((a, r) => a + toNumber(r["Sum of Total GtN Spend"]), 0);
        const pct = gross ? (gtn / gross) * 100 : 0;

        setSummary({
          title: "Consistency — samenvatting",
          metrics: [
            `Total Gross Sales: ${fmtEUR(gross)}`,
            `Total GTN Spend: ${fmtEUR(gtn)} (${pct.toFixed(1)}%)`,
          ],
        });
      } else {
        // PARALLEL (placeholder) — laat in elk geval duidelijk zien dat je parallel draait
        const count = data.length;
        setSummary({
          title: "Parallel Pressure — samenvatting (placeholder)",
          metrics: [
            `Records ingelezen: ${count}`,
            `Voeg hier je parallel-analyse toe met de gewenste kolommen.`,
          ],
        });
      }
    } catch (e: any) {
      setError(e?.message || "Kon bestand niet verwerken");
    } finally {
      setLoading(false);
    }
  }

  const label =
    mode === "waterfall"
      ? "Waterfall-template"
      : mode === "consistency"
      ? "Consistency-template"
      : "Parallel-template";

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm text-gray-700">
          Upload {label} (.xlsx of .csv)
        </span>
        <input
          type="file"
          accept=".xlsx,.csv"
          className="mt-1 block w-full rounded border p-2"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </label>

      {fileName && <p className="text-xs text-gray-500">Bestand: {fileName}</p>}
      {loading && <p className="text-sm">Bezig met verwerken…</p>}
      {error && <p className="text-sm text-red-600">Fout: {error}</p>}

      {summary && (
        <div className="rounded border p-4 bg-gray-50">
          <h3 className="font-semibold">{summary.title}</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
            {summary.metrics.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
