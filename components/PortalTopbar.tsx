// components/PortalTopbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function prettify(segment: string) {
  const s = decodeURIComponent(segment).replace(/-/g, " ");
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function PortalTopbar() {
  const pathname = usePathname() || "/app";
  // bv. "/app/waterfall/details" -> ["app","waterfall","details"]
  const all = pathname.split("/").filter(Boolean);
  const afterApp = all[0] === "app" ? all.slice(1) : all;

  const crumbs = [
    { href: "/app", label: "Dashboard" },
    ...afterApp.map((seg, i) => {
      const href = "/app/" + afterApp.slice(0, i + 1).join("/");
      return { href, label: prettify(seg) };
    }),
  ];

  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3 text-sm">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-gray-600">
          <ol className="flex items-center gap-2">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <li key={c.href} className="flex items-center gap-2">
                  {isLast ? (
                    <span className="font-medium text-gray-900" aria-current="page">
                      {c.label}
                    </span>
                  ) : (
                    <Link
                      href={c.href}
                      className="hover:underline focus:outline-none focus:ring-2 focus:ring-sky-300 rounded"
                    >
                      {c.label}
                    </Link>
                  )}
                  {!isLast && <span className="text-gray-400">/</span>}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="ml-auto" />

        <Link
          href="/"
          className="rounded border px-3 py-1.5 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sky-300"
          title="Naar website"
        >
          ← Terug naar website
        </Link>
      </div>
    </div>
  );
}
