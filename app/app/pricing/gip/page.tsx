// app/app/pricing/gip/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";

/** ---------------- Types ---------------- */
type AIPRow = {
  sku: string;
  name: string;
  pack: string;
  reg: string;
  zi: string;
  aip: number;
  moq: number;
  caseQty: number;
};

type Discount = { distFee: number; extra: number }; // fracties (0.07 = 7%)
type Discounts = Record<string, Discount>;          // key = wholesaler.id
type GIPRow = AIPRow & { discounts: Discounts };

type Wholesaler = { id: string; label: string };

type GIPStore = {
  wholesalers: Wholesaler[];
  rows: { sku: string; discounts: Record<string, Discount> }[];
  updatedAt?: string;
};

/** ---------------- Helpers ---------------- */
const eur = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 2 })
    .format(isFinite(n) ? n : 0);

function coerceNum(v: any, def = 0) {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : def;
}
function trimStr(v: any) {
  return String(v ?? "").trim();
}
const pctToText = (p: number) => (isFinite(p) ? Math.round(p * 10000) / 100 : 0); // 0.1734 -> 17.34

function parseXlsxOrCsv(file: File): Promise<Partial<AIPRow>[]> {
  return new Promise<Partial<AIPRow>[]>(async (resolve, reject) => {
    try {
      const buf = await file.arrayBuffer();
      let rows: any[] = [];
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const wb = XLSX.read(buf);
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      } else if (/\.(csv)$/i.test(file.name)) {
        const text = new TextDecoder().decode(buf);
        const wb = XLSX.read(text, { type: "string" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
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
  const pick = (...keys: string[]) => {
    for (const k of keys) if (map.has(k)) return map.get(k);
    return undefined;
  };
  return {
    sku: pick("sku", "sku nummer", "sku_nummer", "productcode"),
    name: pick("product naam", "productnaam", "naam"),
    pack: pick("standaard verpakk. grootte", "verpakking", "pack", "standaard verpakking", "standaard verpakkingsgrootte"),
    reg: pick("registratienummer", "rvg", "rvgnr", "registratie"),
    zi: pick("zi-nummer", "zi", "zinummer"),
    aip: pick("aip", "apotheekinkoopprijs", "lijstprijs"),
    moq: pick("minimale bestelgrootte", "min order", "moq"),
    caseQty: pick("doosverpakking", "case", "doos", "caseqty", "case_qty"),
  };
}

function toAipRow(r: any): AIPRow {
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
  };
}

/** Netto = AIP × (1 − fee) × (1 − extra) */
function net(aip: number, d: Discount) {
  const df = Math.min(Math.max(d?.distFee ?? 0, 0), 0.9999);
  const ex = Math.min(Math.max(d?.extra ?? 0, 0), 0.9999);
  return Math.max(0, (aip || 0) * (1 - df) * (1 - ex));
}

/** ---------------- Page ---------------- */
export default function GIPPage() {
  const [rows, setRows] = useState<GIPRow[]>([]);
  const [whs, setWhs] = useState<Wholesaler[]>([{ id: "WHS1", label: "Groothandel 1" }]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.sku, r.name, r.reg, r.zi].some((s) => (s || "").toLowerCase().includes(q)));
  }, [rows, filter]);

  /** ------- Data load helpers ------- */
  async function uploadAIP(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const raw = await parseXlsxOrCsv(file);
      const base = raw.map(toAipRow).filter((r) => r.sku || r.name);
      setRows(base.map((r) => ({ ...r, discounts: {} })));
      setMsg(`Geüpload: ${base.length} rijen`);
    } catch (err: any) {
      alert(err?.message || "Upload mislukt");
    } finally {
      setBusy(false);
      e.currentTarget.value = "";
    }
  }

  async function loadAIPFromPortal() {
    try {
      setBusy(true);
      setMsg(null);
      const res = await fetch("/api/pricing/products", { method: "GET", cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !Array.isArray(j?.rows)) throw new Error(j?.error || "Laden mislukt");
      const base: AIPRow[] = j.rows.map((p: any) => ({
        sku: trimStr(p.sku),
        name: trimStr(p.productName ?? p.name),
        pack: trimStr(p.packSize ?? p.pack_size),
        reg: trimStr(p.registration ?? p.registration_no),
        zi: trimStr(p.zi ?? p.zi_number),
        aip: Number(p.aip ?? p.aip_eur) || NaN,
        moq: Number(p.minOrder ?? p.min_order_qty) || 0,
        caseQty: Math.max(0, Math.round(coerceNum(p.casePack ?? p.case_pack, 0))),
      }));
      setRows(base.map((r) => ({ ...r, discounts: {} })));
      setMsg(`Geladen uit portal: ${base.length} rijen`);
    } catch (e: any) {
      setMsg(e?.message || "Laden mislukt");
    } finally {
      setBusy(false);
    }
  }

  /** ------- Portal opslag (NIEUW) ------- */
  async function saveDiscountsToPortal() {
    function clamp01(x: any) {
      const n = Number.isFinite(x) ? Number(x) : 0;
      return Math.min(Math.max(n, 0), 0.9999);
    }
    function sanitizeDiscounts(d: Partial<Discount> | undefined): Discount {
      return {
        distFee: clamp01(d?.distFee),
        extra: clamp01(d?.extra),
      };
    }

    try {
      setBusy(true);
      setMsg(null);
      const payload: GIPStore = {
        wholesalers: whs.map(w => ({ id: String(w.id), label: String(w.label || "").trim() })),
        rows: rows
          .filter((r) => !!r.sku)
          .map((r) => {
            const discounts: Record<string, Discount> = {};
            for (const [wid, d] of Object.entries(r.discounts || {})) {
              discounts[wid] = sanitizeDiscounts(d);
            }
            return { sku: String(r.sku), discounts };
          }),
      };

      const res = await fetch("/api/pricing/gip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      let j: any = null;
      try { j = await res.json(); } catch {}
      if (!res.ok || j?.ok === false) {
        throw new Error(j?.error || `Opslaan mislukt (HTTP ${res.status})`);
      }
      setMsg(`Kortingen opgeslagen (${j.rowsCount} rijen, ${j.wholesalersCount} groothandels).`);
    } catch (e: any) {
      setMsg(e?.message || "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function loadDiscountsFromPortal() {
    try {
      setBusy(true);
      setMsg(null);
      const res = await fetch("/api/pricing/gip", { method: "GET", cache: "no-store" });
      const j = (await res.json()) as { ok: boolean } & GIPStore;
      if (!res.ok || j?.ok === false) throw new Error((j as any)?.error || "Laden mislukt");

      // Update groothandelslijst
      if (Array.isArray(j.wholesalers) && j.wholesalers.length) {
        setWhs(j.wholesalers);
      }

      // Merge per SKU
      const map = new Map<string, Record<string, Discount>>();
      (j.rows || []).forEach((r) => {
        if (r?.sku) map.set(String(r.sku), r.discounts || {});
      });

      setRows((cur) =>
        cur.map((r) => {
          const found = map.get(r.sku);
          if (!found) return r;
          return { ...r, discounts: { ...r.discounts, ...found } };
        })
      );

      setMsg(
        `Kortingen geladen (${j.rows?.length || 0} rijen${j.updatedAt ? ` • snapshot: ${new Date(j.updatedAt).toLocaleString("nl-NL")}` : ""
        }).`
      );
    } catch (e: any) {
      setMsg(e?.message || "Laden mislukt");
    } finally {
      setBusy(false);
    }
  }

  /** ------- Mutations ------- */
  function setDisc(rowIdx: number, wholesalerId: string, patch: Partial<Discount>) {
    setRows((cur) =>
      cur.map((r, i) => {
        if (i !== rowIdx) return r;
        const prev = r.discounts[wholesalerId] ?? { distFee: 0, extra: 0 };
        return { ...r, discounts: { ...r.discounts, [wholesalerId]: { ...prev, ...patch } } };
      })
    );
  }
  function bulkApply(whId: string, patch: Partial<Discount>) {
    setRows((cur) =>
      cur.map((r) => {
        const prev = r.discounts[whId] ?? { distFee: 0, extra: 0 };
        return { ...r, discounts: { ...r.discounts, [whId]: { ...prev, ...patch } } };
      })
    );
  }

  function addWholesaler() {
    const n = whs.length + 1;
    const nw = { id: `WHS${n}`, label: `Groothandel ${n}` };
    setWhs((cur) => [...cur, nw]);
  }
  function renameWholesaler(id: string, label: string) {
    setWhs((cur) => cur.map((w) => (w.id === id ? { ...w, label } : w)));
  }
  function removeWholesaler(id: string) {
    setWhs((cur) => cur.filter((w) => w.id !== id));
    setRows((cur) =>
      cur.map((r) => {
        const { [id]: _, ...rest } = r.discounts;
        return { ...r, discounts: rest };
      })
    );
  }

  /** ------- Export: één tab per groothandel ------- */
  function exportWorkbook() {
    if (!rows.length || !whs.length) {
      alert("Geen data of geen groothandel gedefinieerd.");
      return;
    }
    const book = XLSX.utils.book_new();

    for (const w of whs) {
      const data = rows.map((r) => {
        const d = r.discounts[w.id] ?? { distFee: 0, extra: 0 };
        const netPrice = net(r.aip, d);
        return {
          SKU: r.sku,
          "Product naam": r.name,
          Verpakking: r.pack,
          Registratie: r.reg,
          "ZI-nummer": r.zi,
          "AIP (EUR)": Number.isFinite(r.aip) ? r.aip : 0,
          "Distributiefee %": pctToText(d.distFee),
          "Extra korting %": pctToText(d.extra),
          "Netto EUR": Math.round(netPrice * 100) / 100,
          MOQ: r.moq,
          Doos: r.caseQty,
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(book, ws, safeSheetName(w.label));
    }

    const buf = XLSX.write(book, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "GIP_lists.xlsx";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function safeSheetName(input: string) {
    const banned = /[\[\]\:\*\?\/\\]/g;
    let s = (input || "Sheet").replace(banned, " ").trim();
    if (s.startsWith("'")) s = s.slice(1);
    if (s.endsWith("'")) s = s.slice(0, -1);
    if (!s) s = "Sheet";
    if (s.length > 31) s = s.slice(0, 31);
    return s;
  }

  /** ------- KPIs ------- */
  const kpis = useMemo(() => {
    const nSkus = rows.length;
    const avgAip = nSkus ? rows.reduce((s, r) => (isFinite(r.aip) ? s + r.aip : s), 0) / nSkus : 0;
    return { nSkus, avgAip };
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-6 space-y-6">
      {/* Header */}
      <header className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-semibold">GIP – lijsten per groothandel</h1>
          <span className="ml-auto flex items-center gap-2">
            <Link href="/app/pricing" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
              ← Terug naar Pricing-dashboard
            </Link>
          </span>
        </div>
        <p className="text-sm text-gray-700 mt-1">
          Beheer <b>distributiefee</b> en <b>extra korting</b> per SKU per groothandel. Laad AIP automatisch, sla kortingen op en exporteer per groothandel.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg bg-sky-600 text-white text-sm px-4 py-2 hover:opacity-95 cursor-pointer">
            Upload AIP (.xlsx/.csv)
            <input type="file" accept=".xlsx,.xls,.csv" onChange={uploadAIP} className="hidden" />
          </label>
          <button onClick={loadAIPFromPortal} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            AIP laden uit portal
          </button>
          <button onClick={loadDiscountsFromPortal} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            Kortingen laden
          </button>
          <button onClick={saveDiscountsToPortal} className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm hover:opacity-95">
            Opslaan in portal
          </button>
          <button onClick={exportWorkbook} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            Exporteer Excel (per groothandel)
          </button>
          <div className="ml-auto flex items-center gap-2">
            <input
              placeholder="Zoek sku/naam/ZI/RVG…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm w-44 sm:w-64"
            />
          </div>
        </div>
        {(busy || msg) && (
          <div className="mt-2 text-sm">
            {busy && <span className="text-gray-600">Bezig…</span>}
            {msg && <span className="ml-2 text-gray-700">{msg}</span>}
          </div>
        )}
      </header>

      {/* Wholesalers setup */}
      <section className="rounded-2xl border bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-medium">Groothandels</div>
          <button onClick={addWholesaler} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
            + Voeg groothandel toe
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {whs.map((w) => (
            <div key={w.id} className="flex items-center gap-2 rounded-lg border px-2 py-1.5">
              <input
                value={w.label}
                onChange={(e) => renameWholesaler(w.id, e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
              <button onClick={() => bulkApply(w.id, { distFee: 0 })} className="text-xs underline">Reset fee</button>
              <button onClick={() => bulkApply(w.id, { extra: 0 })} className="text-xs underline">Reset extra</button>
              <button onClick={() => removeWholesaler(w.id)} className="text-xs text-rose-600 underline">Verwijder</button>
            </div>
          ))}
          {whs.length === 0 && <div className="text-sm text-gray-500">Nog geen groothandel toegevoegd.</div>}
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <Kpi title="Totaal SKUs" value={String(kpis.nSkus)} />
        <Kpi title="Gem. AIP" value={eur(kpis.avgAip)} />
        <Kpi title="Groothandels" value={String(whs.length)} />
      </section>

      {/* Tabel (desktop) */}
      <section className="rounded-2xl border bg-white p-3 sm:p-4">
        <div className="overflow-auto hidden md:block">
          <table className="min-w-[1200px] w-full text-sm border-collapse">
            <thead className="bg-slate-50 border-b sticky top-0 z-10">
              <tr>
                <Th>SKU</Th>
                <Th>Productnaam</Th>
                <Th>Verpakking</Th>
                <Th>Registratie</Th>
                <Th>ZI-nummer</Th>
                <Th className="text-right">AIP (EUR)</Th>
                {whs.map((w) => (
                  <Th key={w.id} className="text-right">
                    {w.label} – Fee / Extra / Netto
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((r) => {
                const idx = rows.indexOf(r);
                return (
                  <tr key={idx} className="align-top">
                    <Td><Input value={r.sku} onChange={(v) => setRows(cur => cur.map((x,i)=> i===idx? {...x, sku:v}:x))} placeholder="SKU…" /></Td>
                    <Td><Input value={r.name} onChange={(v) => setRows(cur => cur.map((x,i)=> i===idx? {...x, name:v}:x))} placeholder="Productnaam…" /></Td>
                    <Td><Input value={r.pack} onChange={(v) => setRows(cur => cur.map((x,i)=> i===idx? {...x, pack:v}:x))} placeholder="Bijv. 30 stuks blister" /></Td>
                    <Td><Input value={r.reg} onChange={(v) => setRows(cur => cur.map((x,i)=> i===idx? {...x, reg:v}:x))} placeholder="RVG 12345" /></Td>
                    <Td><Input value={r.zi}  onChange={(v) => setRows(cur => cur.map((x,i)=> i===idx? {...x, zi:v}:x))} placeholder="12345678" /></Td>
                    <Td className="text-right"><Num value={r.aip} onChange={(v) => setRows(cur => cur.map((x,i)=> i===idx? {...x, aip:v}:x))} /></Td>
                    {whs.map((w) => {
                      const d = r.discounts[w.id] ?? { distFee: 0, extra: 0 };
                      return (
                        <Td key={w.id} className="text-right">
                          <div className="grid gap-1">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-gray-500">Fee</span>
                              <Pct value={d.distFee} onChange={(v) => setDisc(idx, w.id, { distFee: v })} />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-gray-500">Extra</span>
                              <Pct value={d.extra} onChange={(v) => setDisc(idx, w.id, { extra: v })} />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">Netto: {eur(net(r.aip, d))}</div>
                          </div>
                        </Td>
                      );
                    })}
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6 + whs.length} className="text-center text-sm text-gray-500 py-6">
                    Geen rijen. Upload of laad AIP uit de portal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {visible.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-6">Geen rijen. Upload of laad AIP uit de portal.</div>
          ) : null}
          {visible.map((r) => {
            const idx = rows.indexOf(r);
            return (
              <div key={idx} className="rounded-xl border p-3">
                <div className="font-medium mb-2">{r.name || "Nieuwe SKU"}</div>
                <div className="space-y-2">
                  <Field label="SKU"><Input value={r.sku} onChange={(v)=>setRows(cur=>cur.map((x,i)=>i===idx?{...x,sku:v}:x))} /></Field>
                  <Field label="Verpakking"><Input value={r.pack} onChange={(v)=>setRows(cur=>cur.map((x,i)=>i===idx?{...x,pack:v}:x))} /></Field>
                  <Field label="Registratie"><Input value={r.reg} onChange={(v)=>setRows(cur=>cur.map((x,i)=>i===idx?{...x,reg:v}:x))} /></Field>
                  <Field label="ZI-nummer"><Input value={r.zi} onChange={(v)=>setRows(cur=>cur.map((x,i)=>i===idx?{...x,zi:v}:x))} /></Field>
                  <Field label="AIP (EUR)"><Num value={r.aip} onChange={(v)=>setRows(cur=>cur.map((x,i)=>i===idx?{...x,aip:v}:x))} /></Field>
                  {whs.map((w) => {
                    const d = r.discounts[w.id] ?? { distFee: 0, extra: 0 };
                    return (
                      <div key={w.id} className="rounded-lg border p-2">
                        <div className="text-xs text-gray-600 mb-1">{w.label}</div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-500">Fee</span>
                          <Pct value={d.distFee} onChange={(v)=>setDisc(idx, w.id, { distFee: v })} />
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-500">Extra</span>
                          <Pct value={d.extra} onChange={(v)=>setDisc(idx, w.id, { extra: v })} />
                        </div>
                        <div className="mt-1 text-xs text-gray-500 text-right">Netto: {eur(net(r.aip, d))}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="w-40">{children}</div>
    </div>
  );
}
function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={"w-full rounded-md border px-2 py-1.5"}
    />
  );
}
function Num({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
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
        onChange(n);
      }}
      className={"w-full text-right rounded-md border px-2 py-1.5"}
      placeholder="0"
    />
  );
}
function Pct({
  value,
  onChange,
}: {
  value: number; // fraction: 0.17
  onChange: (v: number) => void;
}) {
  const [raw, setRaw] = useState<string>(isFinite(value) ? String(Math.round(value * 10000) / 100) : "");
  useEffect(() => {
    setRaw(isFinite(value) ? String(Math.round(value * 10000) / 100) : "");
  }, [value]);
  return (
    <div className="flex items-center justify-end gap-1">
      <input
        inputMode="decimal"
        className="w-24 text-right rounded-md border px-2 py-1.5"
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          const pct = coerceNum(e.target.value, 0) / 100;
          onChange(pct);
        }}
      />
      <span className="text-gray-500">%</span>
    </div>
  );
}
