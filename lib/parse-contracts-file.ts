// lib/parse-contracts-file.ts
export type ContractRow = {
  customer: string;
  sku: string;
  units: number;
  claim_amount: number;
  revenue: number;
  period: string; // MM-YYYY
};

export type ParseResult = {
  rows: ContractRow[];
  issues: string[];
  headerMap: Record<string, string>;
};

const HEADER_ALIASES: Record<string, string> = {
  // canonical -> aliases (lowercase)
  customer: "customer,klant,client,account,buyer",
  sku: "sku,productcode,product,artikel,artikelcode,code",
  units: "units,qty,quantity,aantal,aantal_units,stuks,stuks_afzet",
  claim_amount: "claim_amount,claimbedrag,claim,discount,rebate,uitbetaalde_korting,uitbetaling",
  revenue: "revenue,omzet,sales,netto_omzet,turnover,amount",
  period: "period,periode,month,maand",
};

const REQUIRED = ["customer", "sku", "units", "claim_amount", "revenue", "period"] as const;

function norm(s: any) {
  return String(s ?? "").trim();
}
function toNum(v: any) {
  if (typeof v === "number") return v;
  const s = String(v ?? "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

function detectDelim(firstLine: string) {
  const counts = {
    ";": (firstLine.match(/;/g) || []).length,
    ",": (firstLine.match(/,/g) || []).length,
    "\t": (firstLine.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function splitCSVLine(line: string, delim: string) {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === delim && !inQ) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function normalizePeriod(raw: string): { ok: boolean; value: string } {
  const s = norm(raw);
  const m1 = /^(\d{2})-(\d{4})$/.exec(s); // MM-YYYY
  const m2 = /^(\d{4})-(\d{2})$/.exec(s); // YYYY-MM
  if (m1) return { ok: true, value: `${m1[1]}-${m1[2]}` };
  if (m2) return { ok: true, value: `${m2[2]}-${m2[1]}` };
  return { ok: false, value: s };
}

function buildHeaderMap(headers: string[]) {
  const map: Record<string, string> = {};
  const lc = headers.map((h) => norm(h).toLowerCase());
  for (const canonical of Object.keys(HEADER_ALIASES)) {
    const aliases = HEADER_ALIASES[canonical].split(",");
    // exacte match eerst
    let idx = lc.findIndex((h) => h === canonical);
    if (idx === -1) {
      idx = lc.findIndex((h) => aliases.includes(h));
    }
    if (idx !== -1) map[canonical] = headers[idx];
  }
  return map;
}

async function parseXlsx(file: File): Promise<any[]> {
  const XLSX: any = await import("xlsx"); // client-side
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

async function parseCsv(file: File): Promise<any[]> {
  const text = await file.text();
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const delim = detectDelim(lines[0]);
  const headers = splitCSVLine(lines[0], delim);
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], delim);
    const obj: any = {};
    headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));
    rows.push(obj);
  }
  return rows;
}

export async function parseContractsFile(file: File): Promise<ParseResult> {
  const ext = norm(file.name).toLowerCase().split(".").pop();
  let rawRows: any[] = [];
  if (ext === "xlsx" || ext === "xls") rawRows = await parseXlsx(file);
  else if (ext === "csv") rawRows = await parseCsv(file);
  else throw new Error("Ondersteunde formaten: .xlsx, .xls, .csv");

  const issues: string[] = [];
  if (!rawRows.length) return { rows: [], issues: ["Bestand bevat geen rijen."], headerMap: {} };

  const headers = Object.keys(rawRows[0] ?? {});
  const headerMap = buildHeaderMap(headers);

  // check verplichte velden
  for (const req of REQUIRED) {
    if (!headerMap[req]) issues.push(`Ontbrekende kolom: "${req}" (synoniemen toegestaan, zie documentatie).`);
  }

  const seen = new Set<string>();
  const out: ContractRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const get = (canon: string) => r[headerMap[canon] ?? ""];

    const customer = norm(get("customer"));
    const sku = norm(get("sku"));
    const units = toNum(get("units"));
    const claim = toNum(get("claim_amount"));
    const rev = toNum(get("revenue"));
    const periodRaw = norm(get("period"));

    if (!customer || !sku) {
      issues.push(`Rij ${i + 2}: lege customer/sku — rij overgeslagen.`);
      continue;
    }

    const p = normalizePeriod(periodRaw);
    if (!p.ok) {
      issues.push(`Rij ${i + 2}: ongeldige periode "${periodRaw}" — verwacht MM-YYYY of YYYY-MM.`);
      continue;
    }

    if (!Number.isFinite(units) || !Number.isFinite(claim) || !Number.isFinite(rev)) {
      issues.push(`Rij ${i + 2}: numerieke waarden ongeldig (units/claim_amount/revenue).`);
      continue;
    }

    const key = `${customer}::${sku}::${p.value}`;
    if (seen.has(key)) issues.push(`Rij ${i + 2}: dubbele combinatie (customer, sku, period) — laatste telt.`);
    seen.add(key);

    out.push({
      customer,
      sku,
      units: Math.round(units),
      claim_amount: Math.round(claim),
      revenue: Math.round(rev),
      period: p.value,
    });
  }

  if (!out.length && !issues.length) issues.push("Geen geldige rijen gevonden.");
  return { rows: out, issues, headerMap };
}
