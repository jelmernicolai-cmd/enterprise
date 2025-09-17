// lib/waterfall-storage.ts
import type { Row } from "@/lib/waterfall-types";

export const WF_STORE_KEY = "pharmagtn_master_rows_v1";
const LEGACY_KEYS = ["pharmagtn_wf_session", "pharmagtn_waterfall"];

type StoredShape = { rows?: Row[] } | Row[];

export function loadWaterfallRows(): Row[] {
  const keys = [WF_STORE_KEY, ...LEGACY_KEYS];
  for (const k of keys) {
    try {
      const raw =
        (typeof sessionStorage !== "undefined" && sessionStorage.getItem(k)) ||
        (typeof localStorage !== "undefined" && localStorage.getItem(k));
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredShape;
      if (Array.isArray(parsed)) return parsed as Row[];
      if (parsed && Array.isArray((parsed as any).rows)) return (parsed as any).rows as Row[];
    } catch {}
  }
  return [];
}

export function saveWaterfallRows(rows: Row[]) {
  const payload = JSON.stringify({ rows });
  try { sessionStorage.setItem(WF_STORE_KEY, payload); } catch {}
  try { localStorage.setItem(WF_STORE_KEY, payload); } catch {}
  for (const k of LEGACY_KEYS) {
    try { sessionStorage.setItem(k, payload); } catch {}
    try { localStorage.setItem(k, payload); } catch {}
  }
}

export function eur0(n: number) {
  return (n || 0).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export function pct1(numerator: number, denominator: number) {
  const v = denominator ? (numerator / denominator) * 100 : 0;
  return v.toLocaleString("nl-NL", { maximumFractionDigits: 1 }) + "%";
}
