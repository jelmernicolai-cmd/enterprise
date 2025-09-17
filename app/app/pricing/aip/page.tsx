"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";

/** ---------------- Types ---------------- */
type Row = {
  sku: string;
  name: string;
  pack: string;
  reg: string;        // Registratienummer (RVG/G),
  zi: string;         // ZI-nummer
  aip: number;        // lijstprijs (EUR)
  moq: number;        // Minimale bestelgrootte
  caseQty: number;    // Doosverpakking
  purchaseQty: number; // Inkoophoeveelheid per verpakking
  // custom fields: generiek object
  custom?: Record<string, string | number>;
};

type ImportRow = Partial<Row> & Record<string, any>;

/** ---------------- Helpers ---------------- */
const eur = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(isFinite(n) ? n : 0);

function coerceNum(v: any, def = 0) {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : def;
}
function trimStr(v: any) {
  return String(v ?? "").trim();
}

function parseXlsxOrCsv(file: File): Promise<ImportRow[]> {
  return new Promise<ImportRow[]>(async (resolve, reject) => {
    try {
      const buf = await file.arrayBuffer();
      let rows: any[] = [];
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const wb = XLSX.read(buf);
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      } else if (/\.(csv)$/i.test(file.name)) {
        const text = new TextDecoder().decode(buf);
        const delim = text.split("\n")[0].includes(";") ? ";" : ",";
        rows = XLSX.utils.sheet_to_json(XLSX.read(text, { type: "string" }).Sheets.Sheet1, { defval: "" });
        if (!rows.length) {
          // fallback mini CSV parser
          const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
          const headers = lines.shift()!.split(delim).map((s) => s.trim());
          rows = lines.map((l) => {
            const cols = l.split(delim);
            const o: any = {};
            headers.forEach((h, i) => (o[h] = cols[i] ?? ""));
            return o;
          });
        }
      } else {
        return reject(new Error("Ondersteund: .xlsx, .xls of .csv"));
      }
      resolve(rows);
    } catch (e: any) {
      reject(e);
    }
  });
}

function normalizeHeaders(o: Record<string, any>) {
  const map = new Map<string, any>();
  Object.entries(o).forEach(([k, v]) => map.set(k.toLowerCase().trim(), v));
  const pick = (keys: string[]) => {
    for (const k of keys) if (map.has(k)) return map.get(k);
    return undefined;
  };
  return {
    sku: pick(["sku", "sku nummer", "sku_nummer", "productcode"]),
    name: pick(["product naam", "productnaam", "naam"]),
    pack: pick(["standaard verpakk. grootte", "verpakking", "pack", "standaard verpakking", "standaard verpakkingsgrootte"]),
    reg: pick(["registratienummer", "rvg", "rvgnr", "registratie"]),
    zi: pick(["zi-nummer", "zi", "zinummer"]),
    aip: pick(["aip", "apotheekinkoopprijs", "lijstprijs"]),
    moq: pick(["minimale bestelgrootte", "min order", "moq", "min_order", "min order qty", "min_order_qty"]),
    caseQty: pick(["doosverpakking", "case", "doos", "caseqty", "case_qty"]),
    purchaseQty: pick([
      "inkoophoeveelheid per verpakking","inkoophoeveelheid","inhoud per verpakking",
      "units per pack","units_per_pack","units-per-pack","unitsperpack",
      "per_pack","per pack","qty per pack","qty_per_pack","qty/pack"
    ]),
    rest: Object.fromEntries(
      [...map.entries()].filter(([k]) => ![
        "sku","sku nummer","sku_nummer","productcode",
        "product naam","productnaam","naam",
        "standaard verpakk. grootte","verpakking","pack","standaard verpakking","standaard verpakkingsgrootte",
        "registratienummer","rvg","rvgnr","registratie",
        "zi-nummer","zi","zinummer",
        "aip","apotheekinkoopprijs","lijstprijs",
        "minimale bestelgrootte","min order","moq","min_order","min order qty","min_order_qty",
        "doosverpakking","case","doos","caseqty","case_qty",
        "inkoophoeveelheid per verpakking","inkoophoeveelheid","inhoud per verpakking","units per pack","units_per_pack","units-per-pack","unitsperpack","per_pack","per pack","qty per pack","qty_per_pack","qty/pack"
      ].includes(k))
    )
  };
}

function toRow(r: any): Row {
  const n = normalizeHeaders(r);
  const aip = coerceNum(n.aip, NaN);
  return {
    sku: trimStr(n.sku),
    name: trimStr(n.name),
    pack: trimStr(n.pack),
    reg: trimStr(n.reg),
    zi: trimStr(n.zi),
    aip: isFinite(aip) ? parseFloat(aip.toFixed(4)) : NaN,
    moq: Math.max(0, Math.round(coerceNum(n.moq, 0))),
    caseQty: Math.max(0, Math.round(coerceNum(n.caseQty ?? n["caseqty"] ?? n["case_qty"] ?? n["case"], 0))),
    purchaseQty: Math.max(0, Math.round(coerceNum(n.purchaseQty ?? 0, 0))),
    custom: Object.fromEntries(Object.entries(n.rest).map(([k, v]) => [k, typeof v === "number" ? v : trimStr(v)])),
  };
}

function validate(r: Row) {
  const errs: string[] = [];
  if (!r.sku) errs.push("SKU vereist");
  if (!r.name) errs.push("Productnaam vereist");
  if (!isFinite(r.aip) || r.aip < 0) errs.push("AIP ongeldig (≥ 0)");
  if (r.zi && !/^\d{6,8}$/.test(r.zi)) errs.push("ZI-nummer verwacht 6–8 cijfers");
  return errs;
}

/** Undo/Redo helper */
function useHistoryState<T>(initial: T) {
  const [present, setPresent] = useState<T>(initial);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  const set = useCallback((updater: (cur: T) => T) => {
    setPresent((cur) => {
      const next = updater(cur);
      pastRef.current.push(cur);
      futureRef.current = [];
      return next;
    });
  }, []);
  const undo = useCallback(() => {
    const last = pastRef.current.pop();
    if (last !== undefined) {
      futureRef.current.push(present);
      setPresent(last);
    }
  }, [present]);
  const redo = useCallback(() => {
    const nxt = futureRef.current.pop();
    if (nxt !== undefined) {
      pastRef.current.push(present);
      setPresent(nxt);
    }
  }, [present]);
  return { value: present, set, undo, redo, canUndo: pastRef.current.length > 0, canRedo: futureRef.current.length > 0 };
}

/** ---------------- Page ---------------- */
export default function AIPPage() {
  const hist = useHistoryState<Row[]>([]);
  const rows = hist.value;

  const [errors, setErrors] = useState<Record<number, string[]>>({});
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Hotkeys: Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) hist.redo();
        else hist.undo();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hist]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.sku, r.name, r.reg, r.zi].some((s) => (s || "").toLowerCase().includes(q)));
  }, [rows, filter]);

  const invalidCount = useMemo(() => rows.reduce((n, r) => n + (validate(r).length ? 1 : 0), 0), [rows]);

  function applyValidation(nextRows: Row[]) {
    const e: Record<number, string[]> = {};
    nextRows.forEach((r, i) => {
      const errs = validate(r);
      if (errs.length) e[i] = errs;
    });
    setErrors(e);
  }

  const mutate = useCallback(
    (idx: number, key: keyof Row, val: any) => {
      hist.set((cur) => {
        const next = cur.map((r, i) =>
          i === idx
            ? ({
                ...r,
                [key]:
                  key === "aip" ? coerceNum(val, NaN)
                  : key === "moq" || key === "caseQty" || key === "purchaseQty" ? Math.max(0, Math.round(coerceNum(val, 0)))
                  : trimStr(val),
              } as Row)
            : r
        );
        return next;
      });
    },
    [hist]
  );

  useEffect(() => { applyValidation(rows); }, [rows]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const raw = await parseXlsxOrCsv(file);
      const parsed = raw.map(toRow);
      hist.set(() => parsed);
      setMsg(`Geüpload: ${parsed.length} rijen`);
    } catch (err: any) {
      alert(err?.message || "Upload mislukt");
    } finally {
      setBusy(false);
      e.currentTarget.value = "";
    }
  }

  function addBlank() {
    hist.set((cur) => [
      ...cur,
      { sku: "", name: "", pack: "", reg: "", zi: "", aip: NaN, moq: 0, caseQty: 0, purchaseQty: 0, custom: {} },
    ]);
  }
  function removeRow(i: number) {
    hist.set((cur) => cur.filter((_, idx) => idx !== i));
  }

  function exportXLSX() {
    const data = rows.map((r) => ({
      "SKU nummer": r.sku,
      "Product naam": r.name,
      "Standaard Verpakk. Grootte": r.pack,
      "Registratienummer": r.reg,
      "ZI-nummer": r.zi,
      "AIP": r.aip,
      "Minimale bestelgrootte": r.moq,
      "Doosverpakking": r.caseQty,
      "Inkoophoeveelheid per verpakking": r.purchaseQty,
      ...r.custom,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "AIP");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "AIP_prijslijst.xlsx";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** ---- Portal opslag: gebruikt bestaande /api/pricing/products ----
   * purchaseQty zetten we in custom.purchaseQty om serverside types niet te wijzigen.
   */
  async function saveToPortal() {
    try {
      setSaving(true);
      setMsg(null);
      const bodyRows = rows.map(r => ({
        sku: r.sku,
        productName: r.name,
        packSize: r.pack,
        registration: r.reg,
        zi: r.zi,
        aip: r.aip,
        minOrder: r.moq,
        casePack: String(r.caseQty || ""),
        custom: { ...(r.custom || {}), purchaseQty: r.purchaseQty },
      }));
      const res = await fetch("/api/pricing/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: bodyRows }),
      });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || "Opslaan mislukt");
      setMsg(`Opgeslagen in portal (${j.count ?? bodyRows.length} rijen).`);
    } catch (e: any) {
      setMsg(e?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function loadFromPortal() {
    try {
      setLoading(true);
      setMsg(null);
      const res = await fetch("/api/pricing/products", { method: "GET" });
      const j = await res.json();
      if (!res.ok || !Array.isArray(j?.rows)) throw new Error(j?.error || "Laden mislukt");
      const parsed: Row[] = (j.rows || []).map((p: any) => ({
        sku: trimStr(p.sku),
        name: trimStr(p.productName ?? p.name),
        pack: trimStr(p.packSize ?? p.pack_size),
        reg: trimStr(p.registration ?? p.registration_no),
        zi: trimStr(p.zi ?? p.zi_number),
        aip: Number(p.aip ?? p.aip_eur) || NaN,
        moq: Number(p.minOrder ?? p.min_order_qty) || 0,
        caseQty: Math.max(0, Math.round(coerceNum(p.casePack ?? p.case_pack, 0))),
        purchaseQty: Math.max(0, Math.round(coerceNum((p.custom?.purchaseQty) ?? 0, 0))),
        custom: p.custom || {},
      }));
      hist.set(() => parsed);
      setMsg(`Geladen: ${parsed.length} rijen`);
    } catch (e: any) {
      setMsg(e?.message || "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }

  const kpis = useMemo(() => {
    const n = rows.length;
    const withAip = rows.filter((r) => isFinite(r.aip) && r.aip >= 0);
    const avg = withAip.length ? withAip.reduce((s, r) => s + r.aip, 0) / withAip.length : 0;
    const med = withAip.length
      ? [...withAip.map((r) => r.aip)].sort((a, b) => a - b)[Math.floor((withAip.length - 1) / 2)]
      : 0;
    return { n, withAip: withAip.length, avg, med };
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-6 space-y-6">
      {/* Header */}
      <header className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-semibold">AIP prijslijst – beheer</h1>
          <span className="ml-auto flex items-center gap-2">
            <Link href="/app/pricing" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
              ← Terug naar Pricing-dashboard
            </Link>
          </span>
        </div>
        <p className="text-sm text-gray-700 mt-1">
          Beheer de <b>lijstprijs (AIP)</b> per SKU. Import/Export Excel, bewerk velden en sla op in de portal.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg bg-sky-600 text-white text-sm px-4 py-2 hover:opacity-95 cursor-pointer">
            Upload (.xlsx/.csv)
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onUpload} className="hidden" />
          </label>
          <button onClick={addBlank} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            + Nieuwe rij
          </button>
          <button onClick={exportXLSX} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            Exporteer Excel
          </button>
          <button onClick={hist.undo} disabled={!hist.canUndo} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40">
            Undo
          </button>
          <button onClick={hist.redo} disabled={!hist.canRedo} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40">
            Redo
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              placeholder="Zoek sku/naam/ZI/RVG…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm w-44 sm:w-64"
            />
            <button onClick={loadFromPortal} disabled={loading} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40">
              {loading ? "Laden…" : "Laden uit portal"}
            </button>
            <button onClick={saveToPortal} disabled={saving} className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm hover:opacity-95 disabled:opacity-40">
              {saving ? "Opslaan…" : "Opslaan in portal"}
            </button>
          </div>
        </div>
        {(busy || msg) && (
          <div className="mt-2 text-sm">
            {busy && <span className="text-gray-600">Bestand verwerken…</span>}
            {msg && <span className="ml-2 text-gray-700">{msg}</span>}
          </div>
        )}
      </header>

      {/* KPIs */}
      <section className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <Kpi title="Totaal SKUs" value={kpis.n.toString()} />
        <Kpi title="Met geldige AIP" value={kpis.withAip.toString()} help={`${((kpis.withAip/(kpis.n||1))*100).toFixed(0)}%`} />
        <Kpi title="Gem. AIP" value={eur(kpis.avg)} />
        <Kpi title="Mediaan AIP" value={eur(kpis.med)} />
        <Kpi title="Openstaande validaties" value={invalidCount.toString()} help={invalidCount ? "Los de rode velden op" : "OK"} />
      </section>

      {/* Tabel (desktop/tablet) */}
      <section className="rounded-2xl border bg-white p-3 sm:p-4">
        {/* Desktop/Tablet table */}
        <div className="overflow-auto hidden md:block">
          <table className="min-w-[1060px] w-full text-sm border-collapse">
            <thead className="bg-slate-50 border-b sticky top-0 z-10">
              <tr>
                <Th>SKU</Th>
                <Th>Productnaam</Th>
                <Th>Verpakking</Th>
                <Th>Registratie</Th>
                <Th>ZI-nummer</Th>
                <Th className="text-right">AIP (EUR)</Th>
                <Th className="text-right">MOQ</Th>
                <Th className="text-right">Doos</Th>
                <Th className="text-right">Inkoop/Verp.</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((r, i) => {
                const idx = rows.indexOf(r);
                const err = errors[idx] || [];
                const has = (k: keyof Row) =>
                  err.some((e) =>
                    (k === "sku" && e.includes("SKU")) ||
                    (k === "name" && e.includes("Productnaam")) ||
                    (k === "aip" && e.includes("AIP")) ||
                    (k === "zi" && e.includes("ZI"))
                  );

                return (
                  <tr key={idx} className="align-top">
                    <Td><Input value={r.sku} onChange={(v) => mutate(idx, "sku", v)} invalid={has("sku")} placeholder="SKU…" /></Td>
                    <Td><Input value={r.name} onChange={(v) => mutate(idx, "name", v)} invalid={has("name")} placeholder="Productnaam…" /></Td>
                    <Td><Input value={r.pack} onChange={(v) => mutate(idx, "pack", v)} placeholder="Bijv. 30 stuks blister" /></Td>
                    <Td><Input value={r.reg} onChange={(v) => mutate(idx, "reg", v)} placeholder="RVG 12345" /></Td>
                    <Td><Input value={r.zi} onChange={(v) => mutate(idx, "zi", v)} invalid={has("zi")} placeholder="12345678" /></Td>
                    <Td className="text-right"><Num value={r.aip} onChange={(v) => mutate(idx, "aip", v)} invalid={has("aip")} /></Td>
                    <Td className="text-right"><Num value={r.moq} onChange={(v) => mutate(idx, "moq", v)} integer /></Td>
                    <Td className="text-right"><Num value={r.caseQty} onChange={(v) => mutate(idx, "caseQty", v)} integer /></Td>
                    <Td className="text-right"><Num value={r.purchaseQty} onChange={(v) => mutate(idx, "purchaseQty", v)} integer /></Td>
                    <Td>
                      <button onClick={() => removeRow(idx)} className="rounded border px-2 py-1 hover:bg-gray-50">Verwijder</button>
                      {!!err.length && (<div className="mt-1 text-[11px] text-rose-600">{err.join(" • ")}</div>)}
                    </Td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-sm text-gray-500 py-6">Geen rijen. Upload of voeg een rij toe.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {visible.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-6">Geen rijen. Upload of voeg een rij toe.</div>
          ) : null}
          {visible.map((r, i) => {
            const idx = rows.indexOf(r);
            const err = errors[idx] || [];
            const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] text-gray-500">{label}</div>
                <div className="w-40">{children}</div>
              </div>
            );
            return (
              <div key={idx} className="rounded-xl border p-3">
                <div className="font-medium mb-2">{r.name || "Nieuwe SKU"}</div>
                <div className="space-y-2">
                  <Field label="SKU"><Input value={r.sku} onChange={(v)=>mutate(idx,"sku",v)} invalid={err.some(e=>e.includes("SKU"))} /></Field>
                  <Field label="Productnaam"><Input value={r.name} onChange={(v)=>mutate(idx,"name",v)} invalid={err.some(e=>e.includes("Productnaam"))} /></Field>
                  <Field label="Verpakking"><Input value={r.pack} onChange={(v)=>mutate(idx,"pack",v)} /></Field>
                  <Field label="Registratie"><Input value={r.reg} onChange={(v)=>mutate(idx,"reg",v)} /></Field>
                  <Field label="ZI-nummer"><Input value={r.zi} onChange={(v)=>mutate(idx,"zi",v)} invalid={err.some(e=>e.includes("ZI"))} /></Field>
                  <Field label="AIP (EUR)"><Num value={r.aip} onChange={(v)=>mutate(idx,"aip",v)} invalid={err.some(e=>e.includes("AIP"))} /></Field>
                  <Field label="MOQ"><Num value={r.moq} onChange={(v)=>mutate(idx,"moq",v)} integer /></Field>
                  <Field label="Doos"><Num value={r.caseQty} onChange={(v)=>mutate(idx,"caseQty",v)} integer /></Field>
                  <Field label="Inkoop/Verp."><Num value={r.purchaseQty} onChange={(v)=>mutate(idx,"purchaseQty",v)} integer /></Field>
                </div>
                <div className="mt-3 flex justify-end">
                  <button onClick={()=>removeRow(idx)} className="rounded border px-2 py-1 hover:bg-gray-50">Verwijder</button>
                </div>
                {!!err.length && <div className="mt-2 text-[11px] text-rose-600">{err.join(" • ")}</div>}
              </div>
            );
          })}
        </div>

        {/* Footer: uitleg + links */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <span>Tip: Undo/Redo met <kbd className="border rounded px-1">Ctrl/⌘</kbd>+<kbd className="border rounded px-1">Z</kbd> en <kbd className="border rounded px-1">Shift</kbd>.</span>
          <span className="opacity-60">Importeer/Exporteer Excel, of sla op in de portal om te delen.</span>
          <Link href="/templates" className="underline">Templates</Link>
        </div>
      </section>
    </div>
  );
}

/** ---------------- Small UI bits ---------------- */
function Kpi({ title, value, help }: { title: string; value: string; help?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-3 sm:p-4">
      <div className="text-[12px] text-gray-600">{title}</div>
      <div className="text-lg sm:text-xl font-semibold mt-1">{value}</div>
      {help ? <div className="text-[11px] sm:text-xs text-gray-500 mt-1">{help}</div> : null}
    </div>
  );
}
function Th(props: React.HTMLAttributes<HTMLTableCellElement>) {
  return <th {...props} className={"text-left px-2 py-2 " + (props.className || "")} />;
}
function Td(props: React.HTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} className={"align-top px-2 py-1 " + (props.className || "")} />;
}
function Input({
  value,
  onChange,
  invalid,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={"w-full rounded-md border px-2 py-1.5 " + (invalid ? "border-rose-300 bg-rose-50" : "")}
    />
  );
}
function Num({
  value,
  onChange,
  invalid,
  integer = false,
}: {
  value: number;
  onChange: (v: number) => void;
  invalid?: boolean;
  integer?: boolean;
}) {
  const [raw, setRaw] = useState<string>(Number.isFinite(value) ? String(value) : "");
  useEffect(() => {
    setRaw(Number.isFinite(value) ? String(value) : "");
  }, [value]);
  return (
    <input
      inputMode="decimal"
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        const n = coerceNum(e.target.value, NaN);
        onChange(integer ? Math.max(0, Math.round(n)) : n);
      }}
      className={"w-full text-right rounded-md border px-2 py-1.5 " + (invalid ? "border-rose-300 bg-rose-50" : "")}
      placeholder="0"
    />
  );
}
