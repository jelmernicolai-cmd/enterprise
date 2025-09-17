// components/PortalSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type Item = { href: string; label: string };

const SECTIONS: Item[] = [
  { href: "/app/waterfall", label: "Waterfall" },
  { href: "/app/consistency", label: "Consistency" },
  { href: "/app/parallel", label: "Parallel" },
  { href: "/app/gtn", label: "GtN" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function PortalSidebar() {
  const pathname = usePathname() || "/app";
  const [open, setOpen] = useState(false);

  const crumb = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return (parts[1] ?? "Dashboard")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }, [pathname]);

  const Sections = (
    <ul className="space-y-1">
      {SECTIONS.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              className={`block rounded px-3 py-2 text-sm hover:bg-gray-50 ${
                active
                  ? "bg-gray-100 text-gray-900 border-l-2 border-sky-600"
                  : "text-gray-700"
              }`}
            >
              {it.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className="bg-white border-r md:min-h-[calc(100vh-56px)] flex flex-col">
      {/* Topbar (altijd zichtbaar, bovenaan in de sidebar) */}
      <div className="flex items-center gap-3 p-3 border-b sticky top-0 bg-white z-30">
        <Link href="/" className="text-sm text-gray-600 hover:underline">
          ← Terug naar website
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden md:inline text-xs text-gray-400">Sectie:</span>
          <span className="text-xs font-medium text-gray-700">{crumb}</span>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-xs px-2 py-1 border rounded"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="portal-mobile-menu"
            aria-label="Zijbalk tonen/verbergen"
          >
            Menu
          </button>
        </div>
      </div>

      {/* Desktop navigatie */}
      <nav className="hidden md:block p-3 space-y-6">{Sections}</nav>

      {/* Mobiele navigatie (collapsible) */}
      <nav
        id="portal-mobile-menu"
        className={`md:hidden border-t overflow-hidden transition-[max-height] duration-300 ease-in-out ${
          open ? "max-h-[1000px]" : "max-h-0"
        }`}
      >
        <div className="p-3 space-y-6">{Sections}</div>
      </nav>

      {/* Footer */}
      <div className="mt-auto p-3 border-t text-[11px] text-gray-500">
        Ingelogd via GtN Portal •{" "}
        <Link className="underline hover:no-underline" href="/pricing">
          Licentiebeheer
        </Link>
      </div>
    </aside>
  );
}
