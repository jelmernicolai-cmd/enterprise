"use client";
import { usePathname } from "next/navigation";

export default function Footer() {
  const year = new Date().getFullYear();
  const pathname = usePathname();
  const isPortal = pathname?.startsWith("/app");

  return (
    <footer className="mt-24">
      {/* CTA-band (alleen buiten portal) */}
      {!isPortal && (
        <section className="mx-auto w-full max-w-7xl px-4">
          <div className="rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white p-5 sm:p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-semibold leading-snug">
                  Zien hoe PharmGtN jouw kortingsbeleid optimaliseert?
                </h3>
                <p className="text-white/90 text-sm">
                  Korte demo met jouw casus — zonder verplichtingen.
                </p>
              </div>
              <div className="flex w-full flex-col sm:flex-row md:w-auto gap-2">
                <a
                  href="mailto:sales@pharmgtn.com?subject=Plan%20demo%20PharmGtN&body=Bedrijf%3A%0AUse%20case%3A%0AWens%20datum%2Ftijd%3A%0A"
                  className="inline-flex items-center justify-center rounded-xl bg-white/10 backdrop-blur border border-white/30 px-4 py-2 text-sm hover:bg-white/15 w-full sm:w-auto"
                >
                  Plan demo
                </a>
                <a
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-xl bg-white text-slate-900 px-4 py-2 text-sm font-medium hover:bg-slate-100 w-full sm:w-auto"
                >
                  Bekijk pricing
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Mobiel: compacte accordions */}
      <div className="mt-10 border-t bg-white md:hidden">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 space-y-4">
          {/* Brand-blok */}
          <div>
            <a href="/" className="text-lg font-semibold">PharmGtN</a>
            <p className="mt-2 text-sm text-slate-600">
              Helder inzicht in Gross-to-Net, scenario’s en governance — gebouwd voor farma.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-700">
              <span className="rounded-full border px-3 py-1">EU-hosting</span>
              <span className="rounded-full border px-3 py-1">Dataminimalisatie</span>
              <span className="rounded-full border px-3 py-1">Audit logging</span>
            </div>
          </div>

          {/* Accordeon secties */}
          <details className="rounded-xl border">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">Product</summary>
            <ul className="px-4 pb-3 space-y-2">
              <FooterLink href="/features">Features</FooterLink>
              <FooterLink href="/pricing">Pricing</FooterLink>
              <FooterLink href="/templates">Templates</FooterLink>
              <FooterLink href="/login">Portal login</FooterLink>
            </ul>
          </details>

          <details className="rounded-xl border">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">Bedrijf</summary>
            <ul className="px-4 pb-3 space-y-2">
              <FooterLink href="/about">Over ons</FooterLink>
              <FooterLink href="/about#security">Security</FooterLink>
              <FooterLink href="/contact">Contact</FooterLink>
            </ul>
          </details>

          <details className="rounded-xl border">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">Volg ons</summary>
            <ul className="px-4 pb-3 space-y-2">
              <li>
                <a
                  className="inline-flex items-center gap-2 text-sm text-slate-700 hover:underline break-words"
                  href="https://www.linkedin.com/company/pharmgtn"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="PharmGtN op LinkedIn (opent in nieuw tabblad)"
                >
                  <LinkedInIcon className="h-4 w-4" />
                  LinkedIn
                </a>
              </li>
            </ul>
          </details>
        </div>
      </div>

      {/* Tablet/desktop: vaste kolomgrid */}
      <div className="hidden md:block mt-10 border-t bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 grid gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand + badges (2 kolommen op lg) */}
          <div className="md:col-span-1 lg:col-span-2">
            <a href="/" className="text-lg font-semibold">PharmGtN</a>
            <p className="mt-3 text-sm text-slate-600 max-w-md">
              Helder inzicht in Gross-to-Net, scenario’s en governance — gebouwd voor farma.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-700">
              <span className="rounded-full border px-3 py-1">EU-hosting</span>
              <span className="rounded-full border px-3 py-1">Dataminimalisatie</span>
              <span className="rounded-full border px-3 py-1">Audit logging</span>
            </div>
          </div>

          <FooterCol title="Product">
            <FooterLink href="/features">Features</FooterLink>
            <FooterLink href="/pricing">Pricing</FooterLink>
            <FooterLink href="/templates">Templates</FooterLink>
            <FooterLink href="/login">Portal login</FooterLink>
          </FooterCol>

          <FooterCol title="Bedrijf">
            <FooterLink href="/about">Over ons</FooterLink>
            <FooterLink href="/security">Security</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
          </FooterCol>

          <FooterCol title="Volg ons">
            <li>
              <a
                className="inline-flex items-center gap-2 text-sm text-slate-700 hover:underline break-words"
                href="https://www.linkedin.com/company/pharmgtn"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="PharmGtN op LinkedIn (opent in nieuw tabblad)"
              >
                <LinkedInIcon className="h-4 w-4" />
                LinkedIn
              </a>
            </li>
          </FooterCol>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="text-center md:text-left">
            © {year} PharmGtN. Alle rechten voorbehouden.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="/terms" className="hover:underline">Voorwaarden</a>
            <span className="hidden md:inline">•</span>
            <a href="/privacy" className="hover:underline">Privacy</a>
            <span className="hidden md:inline">•</span>
            <a href="/cookies" className="hover:underline">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-medium">{title}</div>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a href={href} className="text-sm text-slate-700 hover:underline break-words">
        {children}
      </a>
    </li>
  );
}

function LinkedInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.05-1.86-3.05-1.86 0-2.15 1.45-2.15 2.95v5.67H9.32V9h3.41v1.56h.05c.47-.9 1.62-1.85 3.34-1.85 3.57 0 4.23 2.35 4.23 5.4v6.34zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45z"
      />
    </svg>
  );
}
