// components/contracts/ContractTable.tsx
"use client";

import * as React from "react";
import type { AggRow } from "../../lib/contract-analysis";

/* ---- formatters ---- */
const nf = new Intl.NumberFormat("nl-NL");
const eur = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );
const pct = (p: number) => `${(Number.isFinite(p) ? p : 0).toFixed(1)}%`;

/* ---- helpers: defensief lezen ---- */
function num<T extends object>(obj: T, keys: (keyof any)[], fallback = 0): number {
  for (const k of keys) {
    const v = (obj as any)[k as any];
    const n = typeof v === "number" ? v : parseFloat?.(String(v));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}
function str<T extends object>(obj: T, keys: (keyof any)[], fallback = "—"): string {
  for (const k of keys) {
    const v = (obj as any)[k as any];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return fallback;
}

export default function ContractTable({ rows }: { rows: AggRow[] }) {
  // sorteer op delta (beste eerst), met fallback op netto-omzet
  const sorted = [...rows].sort((a, b) => {
    const da = num(a, ["delta_pp", "deltaPP", "delta_pct", "delta", "delta_pp_netto"]);
    const db = num(b, ["delta_pp", "deltaPP", "delta_pct", "delta", "delta_pp_netto"]);
    if (db !== da) return db - da;
    const na = num(a, ["netto", "netto_omzet", "nettoTotal", "totalNetto", "totaal_netto", "total"]);
    const nb = num(b, ["netto", "netto_omzet", "nettoTotal", "totalNetto", "totaal_netto", "total"]);
    return nb - na;
  });

  return (
    <div className="overflow-x-auto rounded-2xl border bg-white">
      <table className="min-w-[720px] w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left">Contract</th>
            <th className="px-3 py-2 text-right">Netto omzet</th>
            <th className="px-3 py-2 text-right">Groei (contract)</th>
            <th className="px-3 py-2 text-right">Groei (totaal)</th>
            <th className="px-3 py-2 text-right">Δ vs totaal (pp)</th>
            <th className="px-3 py-2 text-right">Bijdrage</th>
            <th className="px-3 py-2 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((r, i) => {
            // key/naam
            const name = str(r, ["contractKey", "contract", "klant_sku", "klant", "sku", "key"], `Contract ${i + 1}`);

            // waarden (met meerdere mogelijke veldnamen)
            const netto = num(r, ["netto", "netto_omzet", "nettoTotal", "totalNetto", "totaal_netto", "total"]);
            const growthC = num(r, ["growth_contract", "groei_contract", "growth", "growth_netto", "growth_pct_contract"]); // %
            const growthT = num(r, ["growth_total", "groei_totaal", "total_growth", "growth_pct_total"]); // %
            const deltaPP = num(r, ["delta_pp", "deltaPP", "delta_pct", "delta", "delta_vs_total_pp"]); // percentage-punten
            const share = num(r, ["share_netto", "share", "bijdrage_pct", "contribution_pct"]); // %

            // badge
            const hasDelta = Number.isFinite(deltaPP);
            const status =
              !hasDelta ? (
                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-500">n.v.t.</span>
              ) : deltaPP > 0 ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-200">
                  Beter
                </span>
              ) : deltaPP < 0 ? (
                <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700 ring-1 ring-rose-200">
                  Achter
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-700 ring-1 ring-gray-200">
                  In lijn
                </span>
              );

            return (
              <tr key={name + i} className="hover:bg-gray-50/60">
                <td className="px-3 py-2">{name}</td>
                <td className="px-3 py-2 text-right font-medium">{eur(netto)}</td>
                <td className="px-3 py-2 text-right">{pct(growthC)}</td>
                <td className="px-3 py-2 text-right">{pct(growthT)}</td>
                <td className="px-3 py-2 text-right">{pct(deltaPP)}</td>
                <td className="px-3 py-2 text-right">{pct(share)}</td>
                <td className="px-3 py-2 text-right">{status}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-50 text-gray-600">
          <tr>
            <td className="px-3 py-2" colSpan={7}>
              <span className="text-[11px]">
                Δ vs totaal (pp) = verschil tussen contractgroei en totale groei (in percentage-punten). Positief = outperform.
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
