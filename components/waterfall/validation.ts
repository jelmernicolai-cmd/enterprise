export type CleanRow = {
  pg: string; sku: string; cust: string; period: string;
  gross: number;
  d_channel: number; d_customer: number; d_product: number; d_volume: number; d_value: number; d_other_sales: number; d_mandatory: number; d_local: number;
  invoiced: number;
  r_direct: number; r_prompt: number; r_indirect: number; r_mandatory: number; r_local: number;
  inc_royalty: number; inc_other: number;
  net: number;
};

export type ValidationResult = {
  rows: CleanRow[];
  warnings: string[];
  errors: string[];
  correctedCount: number;
};

/* ============ Header canon + aliassen (zonder "Sum of" verplichting) ============ */
const CANON = (s: string) => s.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");

// Kern string kolommen (vereist)
const STR_FIELDS = {
  pg: ["productgroupname", "productgroup", "pg", "groep", "productgroep"],
  sku: ["skuname", "sku", "material", "product", "artikel", "productnaam"],
  cust: ["customernamesoldto", "customer", "soldto", "klant", "klantnaam", "debiteur"],
  period: ["fiscalyearperiod", "fiscalperiod", "fyperiod", "period", "maand", "yyyy-mm", "mm-yyyy", "yyyyq", "qyyyy"],
};

// Numerieke velden (optioneel behalve gross; invoiced/net worden indien nodig berekend)
const NUM_FIELD_DEFS: { id: keyof Omit<CleanRow, "pg" | "sku" | "cust" | "period">; aliases: string[]; group?: "discount" | "rebate" | "income" | "core"; }[] = [
  { id: "gross", aliases: ["grosssales", "gross", "grossrevenue", "brutoomzet", "sumofgrosssales"], group: "core" },

  { id: "d_channel", aliases: ["channeldiscounts", "channeldiscount", "channel", "kortingkanaal", "sumofchanneldiscounts"], group: "discount" },
  { id: "d_customer", aliases: ["customerdiscounts", "customerdiscount", "customer", "kortingklant", "sumofcustomerdiscounts"], group: "discount" },
  { id: "d_product", aliases: ["productdiscounts", "productdiscount", "product", "kortingproduct", "sumofproductdiscounts"], group: "discount" },
  { id: "d_volume", aliases: ["volumediscounts", "volumediscount", "volume", "kortingvolume", "sumofvolumediscounts"], group: "discount" },
  { id: "d_value", aliases: ["valuediscounts", "valuediscount", "value", "kortingwaarde", "sumofvaluediscounts"], group: "discount" },
  { id: "d_other_sales", aliases: ["othersalesdiscounts", "othersalesdiscount", "otherdiscounts", "overigekortingen", "sumofothersalesdiscounts"], group: "discount" },
  { id: "d_mandatory", aliases: ["mandatorydiscounts", "mandatorydiscount", "verplichtekorting", "sumofmandatorydiscounts"], group: "discount" },
  { id: "d_local", aliases: ["discountlocal", "locdiscount", "localkorting", "sumofdiscountlocal"], group: "discount" },

  { id: "invoiced", aliases: ["invoicedsales", "invoiced", "factuuromzet", "sumofinvoicedsales"], group: "core" },

  { id: "r_direct", aliases: ["directrebates", "directrebate", "direct", "sumofdirectrebates"], group: "rebate" },
  { id: "r_prompt", aliases: ["promptpaymentrebates", "promptpayment", "prompt", "betalingskorting", "sumofpromptpaymentrebates"], group: "rebate" },
  { id: "r_indirect", aliases: ["indirectrebates", "indirectrebate", "indirect", "sumofindirectrebates"], group: "rebate" },
  { id: "r_mandatory", aliases: ["mandatoryrebates", "mandatoryrebate", "verplichterebate", "sumofmandatoryrebates"], group: "rebate" },
  { id: "r_local", aliases: ["rebatelocal", "localrebate", "lokalerebate", "sumofrebatelocal"], group: "rebate" },

  { id: "inc_royalty", aliases: ["royaltyincome", "royalty", "sumofroyaltyincome"], group: "income" },
  { id: "inc_other", aliases: ["otherincome", "overigeinkomsten", "sumofotherincome"], group: "income" },

  { id: "net", aliases: ["netsales", "net", "nettoomzet", "sumofnetsales"], group: "core" },
];

type NumId = (typeof NUM_FIELD_DEFS)[number]["id"];

/* ============ Parsing helpers ============ */

// Herken EU/US formats en accounting (parentheses = negatief)
function parseNumber(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  let s = String(v).trim();
  const neg = /^\(.*\)$/.test(s);
  if (neg) s = s.slice(1, -1);
  s = s.replace(/[^\d,.\-]/g, ""); // laat alleen cijfers en separators
  // EU pattern: 1.234.567,89  of  123.456,7
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? (neg ? -n : n) : 0;
  }
  // US pattern: 1,234,567.89
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? (neg ? -n : n) : 0;
  }
  // Only comma or only dot: laat laatste separator als decimal punt
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

// Excel serial → Date
function excelSerialToISO(serial: number): string {
  // Excel epoch 1899-12-30
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function normalizePeriod(v: any, warnings: string[], rowIdx: number): string {
  if (typeof v === "number" && isFinite(v) && v > 20000) {
    return excelSerialToISO(v);
  }
  let s = String(v ?? "").trim();
  if (!s) return "";
  s = s.replace(/[^\dA-Za-z\-\/\sQq]/g, "");
  // YYYY-MM / YYYY/MM
  let m = s.match(/(20\d{2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;
  // MM-YYYY / MM/YYYY
  m = s.match(/(\d{1,2})[\/\-](20\d{2})/);
  if (m) return `${m[2]}-${String(Number(m[1])).padStart(2, "0")}`;
  // YYYYMM
  m = s.match(/(20\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;
  // YYYY-Qx / Qx YYYY / YYYYQx / QxYYYY
  m = s.match(/(20\d{2})\s*[-\/]?\s*[Qq]([1-4])/);
  if (m) return `${m[1]}-Q${m[2]}`;
  m = s.match(/[Qq]([1-4])\s*(20\d{2})/);
  if (m) return `${m[2]}-Q${m[1]}`;
  warnings.push(`Rij ${rowIdx}: onherkenbare "period" waarde "${String(v)}" (gelaten zoals is).`);
  return String(v).trim();
}

function approxEq(a: number, b: number, tolPct = 0.02, tolAbs = 50): boolean {
  const diff = Math.abs(a - b);
  if (diff <= tolAbs) return true;
  const base = Math.max(1, Math.max(Math.abs(a), Math.abs(b)));
  return diff / base <= tolPct;
}

/* ============ Header mapping ============ */

function buildHeaderMap(presentHeaders: string[]) {
  const canonToActual = presentHeaders.reduce<Record<string, string>>((m, h) => {
    m[CANON(h)] = h; return m;
  }, {});

  // Strings
  const strMap: Record<keyof typeof STR_FIELDS, string | undefined> = { pg: undefined, sku: undefined, cust: undefined, period: undefined };
  for (const key of Object.keys(STR_FIELDS) as (keyof typeof STR_FIELDS)[]) {
    const hits = STR_FIELDS[key].find(a => canonToActual[a]);
    if (hits) strMap[key] = canonToActual[hits];
  }

  // Numbers
  const numMap = new Map<NumId, string>();
  NUM_FIELD_DEFS.forEach(f => {
    for (const alias of f.aliases) {
      if (canonToActual[alias]) { numMap.set(f.id, canonToActual[alias]); return; }
    }
  });

  return { strMap, numMap };
}

/* ============ Validatie ============ */

export function validateAndNormalize(rawRows: Record<string, any>[]): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let corrected = 0;

  if (!rawRows.length) {
    return { rows: [], warnings, errors: ["Geen rijen gevonden in het Excel-tabblad."], correctedCount: 0 };
  }

  const headers = Object.keys(rawRows[0] || {});
  const { strMap, numMap } = buildHeaderMap(headers);

  // Vereiste minimum: pg, sku, cust, period, gross (de rest is optioneel)
  const missingStr: string[] = [];
  if (!strMap.pg) missingStr.push("Product Group Name");
  if (!strMap.sku) missingStr.push("SKU Name");
  if (!strMap.cust) missingStr.push("Customer Name (Sold-to)");
  if (!strMap.period) missingStr.push("Fiscal year / period");

  if (missingStr.length) {
    errors.push(`Ontbrekende kolommen: ${missingStr.join(", ")}`);
    return { rows: [], warnings, errors, correctedCount: 0 };
  }
  if (!numMap.get("gross")) {
    errors.push(`Ontbrekende kolom: Gross Sales (mag heten: "Gross", "Gross Sales", "Sum of Gross Sales", "Bruto omzet").`);
    return { rows: [], warnings, errors, correctedCount: 0 };
  }

  const rows: CleanRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const rowNo = i + 2; // Excel-achtige nummering (met header)

    const getStr = (actual?: string) => String(actual ? r[actual] ?? "" : "").trim();
    const pg = getStr(strMap.pg);
    const sku = getStr(strMap.sku);
    const cust = getStr(strMap.cust);
    const period = normalizePeriod(getStr(strMap.period), warnings, rowNo);

    const num: Record<NumId, number> = {
      gross: 0, d_channel: 0, d_customer: 0, d_product: 0, d_volume: 0, d_value: 0, d_other_sales: 0, d_mandatory: 0, d_local: 0,
      invoiced: 0, r_direct: 0, r_prompt: 0, r_indirect: 0, r_mandatory: 0, r_local: 0,
      inc_royalty: 0, inc_other: 0, net: 0,
    };

    // Parse aanwezige numerieke velden
    NUM_FIELD_DEFS.forEach(f => {
      const actual = numMap.get(f.id);
      if (actual) num[f.id] = parseNumber(r[actual]);
    });

    // Kortingen/rebates naar positief, met waarschuwing
    const toPos: { id: NumId; label: string; group?: string }[] = [];
    NUM_FIELD_DEFS.forEach(f => {
      if ((f.group === "discount" || f.group === "rebate") && num[f.id] < 0) {
        num[f.id] = Math.abs(num[f.id]);
        corrected++;
        toPos.push({ id: f.id, label: f.id, group: f.group });
      }
    });
    if (toPos.length) warnings.push(`Rij ${rowNo}: negatieve kortingen/rebates omgezet naar positief (${toPos.map(x => x.id).join(", ")}).`);

    // Sommen
    const totalDiscounts =
      num.d_channel + num.d_customer + num.d_product + num.d_volume + num.d_value + num.d_other_sales + num.d_mandatory + num.d_local;
    const totalRebates =
      num.r_direct + num.r_prompt + num.r_indirect + num.r_mandatory + num.r_local;
    const totalIncome = num.inc_royalty + num.inc_other;

    // Invoiced berekenen indien ontbreekt of 0 terwijl onderdelen aanwezig zijn
    if ((!numMap.get("invoiced") || num.invoiced === 0) && (num.gross !== 0 || totalDiscounts !== 0)) {
      const calc = num.gross - totalDiscounts;
      if (num.invoiced === 0) num.invoiced = calc;
      warnings.push(`Rij ${rowNo}: "Invoiced" afgeleid als Gross − Discounts (= ${calc.toFixed(0)}).`);
      corrected++;
    }

    // Net berekenen indien ontbreekt
    if ((!numMap.get("net") || num.net === 0) && (num.invoiced !== 0 || totalRebates !== 0 || totalIncome !== 0)) {
      const calc = num.invoiced - totalRebates + totalIncome;
      if (num.net === 0) num.net = calc;
      warnings.push(`Rij ${rowNo}: "Net" afgeleid als Invoiced − Rebates + Income (= ${calc.toFixed(0)}).`);
      corrected++;
    }

    // Balanschecks (toleranter)
    const expInvoiced = num.gross - totalDiscounts;
    if (!approxEq(num.invoiced, expInvoiced)) {
      warnings.push(`Rij ${rowNo}: Invoiced (${num.invoiced.toFixed(0)}) wijkt af van Gross − Discounts (${expInvoiced.toFixed(0)}).`);
    }
    const expNet = num.invoiced - totalRebates + totalIncome;
    if (!approxEq(num.net, expNet)) {
      warnings.push(`Rij ${rowNo}: Net (${num.net.toFixed(0)}) wijkt af van Invoiced − Rebates + Income (${expNet.toFixed(0)}).`);
    }

    rows.push({
      pg, sku, cust, period,
      gross: num.gross,
      d_channel: num.d_channel,
      d_customer: num.d_customer,
      d_product: num.d_product,
      d_volume: num.d_volume,
      d_value: num.d_value,
      d_other_sales: num.d_other_sales,
      d_mandatory: num.d_mandatory,
      d_local: num.d_local,
      invoiced: num.invoiced,
      r_direct: num.r_direct,
      r_prompt: num.r_prompt,
      r_indirect: num.r_indirect,
      r_mandatory: num.r_mandatory,
      r_local: num.r_local,
      inc_royalty: num.inc_royalty,
      inc_other: num.inc_other,
      net: num.net,
    });
  }

  return { rows, warnings, errors, correctedCount: corrected };
}
