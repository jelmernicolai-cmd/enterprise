// app/app/layout.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import AppShell from "@/components/portal/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || "gebruiker";
  const hasActiveSub = Boolean((session?.user as any)?.hasActiveSub);

  return (
    <AppShell email={email} hasActiveSub={hasActiveSub}>
      {children}
    </AppShell>
  );
}
