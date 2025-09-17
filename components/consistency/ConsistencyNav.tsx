// components/consistency/ConsistencyNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/app/consistency", label: "Overzicht" },
  { href: "/app/consistency/customers", label: "Klanten" },
  { href: "/app/consistency/trend", label: "Trend & Lekkages" },
  { href: "/app/consistency/upload", label: "Upload" },
];

export default function ConsistencyNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b -mt-1">
      <ul className="flex gap-6 px-1">
        {links.map((l) => {
          const active =
            pathname === l.href ||
            (l.href !== "/app/consistency" && pathname?.startsWith(l.href + "/"));
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={[
                  "block py-2 border-b-2",
                  active
                    ? "border-sky-600 text-sky-600 font-medium"
                    : "border-transparent text-gray-600 hover:text-gray-900",
                ].join(" ")}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
