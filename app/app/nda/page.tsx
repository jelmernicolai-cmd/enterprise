// app/app/nda/page.tsx
import NDAForm from "../../../components/legal/NDAForm";

export const metadata = {
  title: "NDA | PharmaGtN",
  description: "Teken hier de NDA/vertrouwelijkheidsovereenkomst en ontvang een bevestiging.",
};

export default function NDAPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <header className="rounded-2xl border bg-white p-5 md:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">NDA / Vertrouwelijkheid</h1>
        <p className="mt-2 text-sm text-gray-600">
          Vul je gegevens in, lees de voorwaarden en zet je handtekening. Na ondertekening slaan we
          een kopie veilig op en krijg je een bevestiging met link.
        </p>
      </header>

      <section className="rounded-2xl border bg-white">
        <NDAForm />
      </section>

      <p className="text-[11px] text-gray-500">
        Let op: deze NDA-tekst is een generieke template en vormt geen juridisch advies. Gebruik je eigen
        juridische tekst indien gewenst.
      </p>
    </main>
  );
}
