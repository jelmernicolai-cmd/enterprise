// app/app/pricing/page.tsx
import PricingAdminClient from "./Client";

export const metadata = {
  title: "Prijsbeheer",
  description: "Beheer AIP-lijstprijzen en genereer klant-specifieke GIP-prijslijsten.",
};

export default function PricingAdminPage() {
  return <PricingAdminClient />;
}
