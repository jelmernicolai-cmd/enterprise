'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean); // ["app","waterfall"]

  const crumbs = parts.map((part, idx) => {
    const href = "/" + parts.slice(0, idx + 1).join("/");
    const label = part === "app" ? "Overzicht" : part.charAt(0).toUpperCase() + part.slice(1);
    const last = idx === parts.length - 1;
    return last ? (
      <span key={href} className="text-gray-900">{label}</span>
    ) : (
      <Link key={href} href={href} className="text-sky-700 hover:underline">
        {label}
      </Link>
    );
  });

  return (
    <nav aria-label="Breadcrumbs" className="text-sm text-gray-600">
      <div className="flex items-center gap-1">
        <Link href="/" className="text-sky-700 hover:underline">Home</Link>
        {crumbs.length > 0 && <span>/</span>}
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {c}
            {i < crumbs.length - 1 && <span>/</span>}
          </span>
        ))}
      </div>
    </nav>
  );
}
