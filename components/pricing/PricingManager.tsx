// components/pricing/PricingManager.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import type { Product, Customer } from "@/lib/pricing/types";

type U = Record<string, any>;

export default function PricingManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const [p, c] = await Promise.all([fetch("/api/pricing/products").then(r => r.json()), fetch("/api/pricing/customers").then(r => r.json())]);
    setProducts(p); setCustomers(c);
  }
  useEffect(() => { refresh(); }, []);

  function parseAIP(file: File) {
    return file.arrayBuffer().then((buf) => {
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const js = XLSX.utils.sheet_to_json<U>(ws, { defval: "" });
      const map = (r: U): Omit<Product, "id"> => ({
        sku: String(r["SKU nummer"] ?? r["SKU"] ?? r["sku"]).trim(),
        name: String(r["Product naam"] ?? r["Product"] ?? r["name"]).trim(),
        pack_size: String(r["Standaard Verpakk. Grootte"] ?? r["Pack"] ?? r["pack_size"] ?? "").trim() || undefined,
        registration_no: String(r["Registratienummer"] ?? r["registratie"] ?? r["registration_no"] ?? "").trim() || undefined,
        zi_number: String(r["ZI-nummer"] ?? r["ZI"] ?? r["zi_number"] ?? "").trim() || undefined,
        aip_eur: Number(String(r["AIP (EUR)"] ?? r["AIP_EUR"] ?? r["aip_eur"] ?? "0").replace(",", ".")) || 0,
        min_order_qty: Number(String(r["Minimale bestelgrootte"] ?? r["Min_bestel"] ?? r["min_order_qty"] ?? "1")) || 1,
        case_pack: String(r["Doosverpakking"] ?? r["Doos"] ?? r["case_pack"] ?? "").trim() || undefined,
        custom: {},
      });
      return js.map(map).filter((x) => x.sku && x.name);
    });
  }

  async function onUploadAIP(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setMsg(null);
    try {
      const rows = await parseAIP(f);
      await fetch("/api/pricing/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ products: rows }) });
      await refresh();
      setMsg(`AIP geüpdatet (${rows.length} rijen).`);
    } catch (err: any) { setMsg(err?.message || "Upload mislukt"); }
    finally { setBusy(false); e.currentTarget.value = ""; }
  }

  async function onSetDiscount(customerId: string, pct: number) {
    await fetch("/api/pricing/customers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, discount_pct: pct }) });
    setMsg(`Korting opgeslagen voor klant.`);
  }

  async function onExportGIP() {
    if (!selectedCustomers.length) { setMsg("Selecteer minimaal één klant."); return; }
    const res = await fetch("/api/pricing/gip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerIds: selectedCustomers }) });
    if (!res.ok) { setMsg("Export mislukt"); return; }
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "GIP_lists.xlsx"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* AIP Upload */}
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-semibold">AIP (lijstprijs) beheren</h2>
        <p className="text-sm text-gray-600">Upload of ververs je AIP-master (Excel). Kolommen: <code>SKU nummer</code>, <code>Product naam</code>, <code>Standaard Verpakk. Grootte</code>, <code>Registratienummer</code>, <code>ZI-nummer</code>, <code>AIP (EUR)</code>, <code>Minimale bestelgrootte</code>, <code>Doosverpakking</code>.</p>
        <div className="mt-3 flex items-center gap-3">
          <input type="file" accept=".xlsx" onChange={onUploadAIP} className="rounded-md border px-3 py-2" />
          <a className="text-sm underline" href="/api/templates/aip" onClick={(e)=>e.preventDefault()}>Gebruik het meegeleverde template (zie link hieronder)</a>
        </div>
        {busy && <div className="mt-2 text-sm text-gray-600">Verwerken…</div>}
        {msg && <div className="mt-2 text-xs text-gray-700">{msg}</div>}
        <div className="mt-4 overflow-auto">
          <table className="min-w-[640px] w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                {["SKU","Product","Pack","Reg.nr","ZI","AIP (€)","Min.bestel","Doos"].map(h=>(
                  <th key={h} className="px-2 py-1 text-left border-b">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p=>(
                <tr key={p.id} className="border-b">
                  <td className="px-2 py-1">{p.sku}</td>
                  <td className="px-2 py-1">{p.name}</td>
                  <td className="px-2 py-1">{p.pack_size}</td>
                  <td className="px-2 py-1">{p.registration_no}</td>
                  <td className="px-2 py-1">{p.zi_number}</td>
                  <td className="px-2 py-1">{p.aip_eur.toFixed(2)}</td>
                  <td className="px-2 py-1">{p.min_order_qty}</td>
                  <td className="px-2 py-1">{p.case_pack}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Customers & discounts */}
      <section className="rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Klanten & groothandelskorting</h2>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            onClick={async ()=>{
              // demo: zet 3 klanten als voorbeeld
              await fetch("/api/pricing/customers", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ customers: [{name:"Groothandel A"}, {name:"Groothandel B"}, {name:"Groothandel C"}] }) });
              await refresh();
            }}
          >Voorbeeldklanten toevoegen</button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {customers.map(c=>(
            <div key={c.id} className="rounded-xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{c.name}</div>
                <label className="text-sm inline-flex items-center gap-2">
                  <span>Korting %</span>
                  <input
                    type="number" step={0.1} min={0} max={100}
                    className="w-24 rounded-md border px-2 py-1"
                    onChange={(e)=>onSetDiscount(c.id, parseFloat(e.target.value || "0"))}
                  />
                </label>
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCustomers.includes(c.id)}
                  onChange={(e)=> setSelectedCustomers(prev => e.target.checked ? [...prev, c.id].slice(0,10) : prev.filter(x=>x!==c.id))}
                />
                <span>Opnemen in export (max 10)</span>
              </label>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <button className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50" onClick={onExportGIP}>
            Exporteer GIP-lijsten (Excel)
          </button>
        </div>
      </section>
    </div>
  );
}
