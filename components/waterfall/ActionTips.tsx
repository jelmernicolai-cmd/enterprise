'use client';

type TipsProps = {
  gross: number;
  d_channel: number; d_customer: number; d_product: number; d_volume: number; d_value: number; d_other_sales: number; d_mandatory: number; d_local: number;
  invoiced: number;
  r_direct: number; r_prompt: number; r_indirect: number; r_mandatory: number; r_local: number;
  inc_royalty: number; inc_other: number;
  top3Cust: Array<{ name: string; gtn: number }>;
  top3Sku: Array<{ name: string; gtn: number }>;
};

// === Tweakbare drempels (op verzoek 15% voor value-discount-dominantie) ===
const THRESHOLDS = {
  VALUE_DOMINANCE_OF_DISCOUNTS: 0.15, // 15% van alle discounts
  CHANNEL_OF_GROSS_MIN_PCT: 1.0,      // 1% van Gross
  PROMPT_OF_GROSS_MAX_PCT: 0.5,       // 0.5% van Gross
  GTN_OF_GROSS_ALERT_PCT: 10,         // 10% van Gross
};

function pct(n: number, d: number) { return d > 0 ? (100 * n / d) : 0; }
function eur(n: number) { return n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }); }
function fmtPct(p: number, digits = 1) { return p.toFixed(digits).replace('.', ',') + '%'; }

export default function ActionTips(p: TipsProps) {
  const totalDiscounts = p.d_channel + p.d_customer + p.d_product + p.d_volume + p.d_value + p.d_other_sales + p.d_mandatory + p.d_local;
  const totalRebates   = p.r_direct + p.r_prompt + p.r_indirect + p.r_mandatory + p.r_local;
  const gtnSpend       = totalDiscounts + totalRebates;

  const tips: string[] = [];

  // 1) Value Discounts domineren (nu 15% drempel)
  if (p.d_value > 0 && p.d_value >= THRESHOLDS.VALUE_DOMINANCE_OF_DISCOUNTS * totalDiscounts) {
    tips.push(
      `Waarde-kortingen zijn substantieel (${eur(p.d_value)} ≈ ${fmtPct(pct(p.d_value, totalDiscounts))} van alle discounts). ` +
      `Zet een cap, migreer deel naar performance-based rebates (tiered/retroactief) met duidelijke einddatum en approval.`
    );
  }

  // 2) Channel Discounts hoog
  if (p.d_channel > 0 && pct(p.d_channel, p.gross) >= THRESHOLDS.CHANNEL_OF_GROSS_MIN_PCT) {
    tips.push(
      `Kanaalkortingen zijn ≥${fmtPct(THRESHOLDS.CHANNEL_OF_GROSS_MIN_PCT)} van Gross (${eur(p.d_channel)}). ` +
      `Heronderhandel service fees (OTIF, expiry, returns), introduceer marge-caps en SLA-gebaseerde toeslagen i.p.v. generieke korting.`
    );
  }

  // 3) Direct rebates domineren
  if (p.r_direct > (p.r_prompt + p.r_indirect + p.r_mandatory + p.r_local)) {
    tips.push(
      `Direct rebates domineren (${eur(p.r_direct)}). ` +
      `Vervang een deel door tiered growth rebates op netto groei/mix; borg claim-eisen (data, bewijs) om lekken te beperken.`
    );
  }

  // 4) Prompt payment boven norm
  if (p.r_prompt > 0 && pct(p.r_prompt, p.gross) > THRESHOLDS.PROMPT_OF_GROSS_MAX_PCT) {
    tips.push(
      `Prompt-payment > ${fmtPct(THRESHOLDS.PROMPT_OF_GROSS_MAX_PCT)} van Gross (${eur(p.r_prompt)}). ` +
      `Zet een plafond en koppel aan automatische betaling/SEPA en een DSO-target; zo niet gehaald, tarief verlagen.`
    );
  }

  // 5) Customer concentratie
  const gtnByTop3Cust = p.top3Cust.reduce((a, b) => a + b.gtn, 0);
  if (gtnSpend > 0 && gtnByTop3Cust >= 0.5 * gtnSpend) {
    tips.push(
      `Top-3 klanten zijn >50% van GtN spend (${eur(gtnByTop3Cust)}). ` +
      `Voer account-specifieke net-price corridors in, vervang off-invoice door contractuele rebates met KPI’s en audits.`
    );
  }

  // 6) SKU’s met hoge GtN%
  if (p.top3Sku.length) {
    tips.push(
      `Herzie SKU’s met hoogste GtN (Top-3): ${p.top3Sku.map(x => x.name).join(', ')}. ` +
      `Overweeg pack-architectuur, minimale net-floors en rationalisatie van low-margin varianten.`
    );
  }

  // 7) Leakage/governance alert (GtN spend > X% van Gross)
  if (pct(gtnSpend, p.gross) > THRESHOLDS.GTN_OF_GROSS_ALERT_PCT) {
    tips.push(
      `GtN spend is >${fmtPct(THRESHOLDS.GTN_OF_GROSS_ALERT_PCT)} van Gross (${eur(gtnSpend)}). ` +
      `Introduceer oorzaakcodes per korting, goedkeuringsflow boven drempels en maandelijkse accruals-vs-claims matching (<5% foutmarge).`
    );
  }

  // 8) Inkomsten vs rebates
  if (p.inc_royalty + p.inc_other < 0.1 * totalRebates && totalRebates > 0) {
    tips.push(
      `Weinig inkomsten t.o.v. rebates. ` +
      `Onderzoek service fees/licenties die aan afzet of projecten gekoppeld kunnen worden (contractueel geborgd).`
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="font-medium mb-2">Aanbevolen acties om marge te optimaliseren</div>
      {tips.length ? (
        <ul className="space-y-2 text-sm text-gray-800">
          {tips.map((t, i) => (
            <li key={i} className="rounded-lg border px-3 py-2 leading-relaxed">{t}</li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-gray-500">Geen opvallende kansen bij de huidige selectie. Verfijn filters voor specifieke inzichten.</div>
      )}
      <div className="mt-3 text-xs text-gray-500">
        Tip: Leg wijzigingen vast in je deal-kalender met einddata, KPI’s en audit-rechten om lekkage te voorkomen.
      </div>
    </div>
  );
}
