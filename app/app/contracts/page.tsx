// app/app/contracts/page.tsx
import Link from "next/link";
import UploadAndDashboard from "../../../components/contracts/UploadAndDashboard";
import { PageShell, PageHeader, SectionCard } from "@/components/ui/Page";

export const metadata = {
  title: "Contract Performance",
  description: "Vergelijk groei per contract t.o.v. totale geaggregeerde groei.",
};

export default function Page() {
  return (
    <PageShell>
      <PageHeader
        title="Contract Performance"
        subtitle="Upload je dataset en zie direct welke contracten sneller groeien dan het totaal, inclusief bijdrage en outperformance."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/templates" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
              Download template
            </Link>
            <Link
              href="/security"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-3 py-2 text-sm text-white hover:opacity-95"
            >
              Data & beveiliging
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* hoofdcontent breder */}
        <div className="lg:col-span-9 space-y-4">
          <SectionCard
            title="Upload & Analyse"
            subtitle={
              <>
                Ondersteund: <b>Excel/CSV</b>. Vereiste kolommen: <code>customer</code>, <code>sku</code>, <code>units</code>,{" "}
                <code>claim_amount</code>, <code>revenue</code>, <code>period</code>.
              </>
            }
          >
            <UploadAndDashboard />
          </SectionCard>
        </div>

        {/* rechterzijbalk compacter */}
        <aside className="lg:col-span-3 lg:sticky lg:top-4 space-y-3">
          <SectionCard title="Snel starten">
            <ul className="mt-1 space-y-1.5 text-xs text-gray-600">
              <li>• Eén tab of CSV per upload.</li>
              <li>• Check headers (NL/EN) & periodeformaat.</li>
              <li>• Aggregatie kies je bij <i>Niveau</i>.</li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/templates" className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs hover:bg-gray-50">
                Templates
              </Link>
              <Link href="/security" className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs hover:bg-gray-50">
                Beveiliging
              </Link>
            </div>
          </SectionCard>

          <SectionCard title="Dataveiligheid">
            <p className="mt-1 text-xs text-gray-600">Verwerking is <b>client-side</b>. We slaan <b>geen bedrijfsdata</b> op.</p>
            <Link href="/security" className="mt-2 inline-flex items-center gap-1 text-xs text-sky-700 hover:underline">
              Meer over beveiliging →
            </Link>
          </SectionCard>

          <SectionCard title="Veelvoorkomende fouten">
            <ul className="mt-1 list-disc pl-5 text-xs text-gray-600 space-y-1">
              <li>Ontbrekende kolommen (<code>period</code>, <code>revenue</code>, …).</li>
              <li>Periode niet in <code>YYYY-MM</code>, <code>MM-YYYY</code> of <code>YYYY-Qx</code>.</li>
              <li>Leeg tweede werkblad in Excel.</li>
            </ul>
          </SectionCard>
        </aside>
      </div>
    </PageShell>
  );
}
