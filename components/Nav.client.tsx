// components/Nav.client.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

type LeftItemProps = { href: string; label: string; onClick?: () => void };
function LeftItem({ href, label, onClick }: LeftItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="px-3 py-2 rounded hover:underline focus:outline-none focus:ring-2 focus:ring-sky-400/40"
    >
      {label}
    </Link>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const { data: session, status } = useSession();
  const pathname = usePathname() || "/";
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const items = useMemo(
    () => [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/about", label: "Over ons" },
      { href: "/contact", label: "Contact" },
      { href: "/portal", label: "Portal" },
    ],
    []
  );

  // Sluit bij routewissel
  useEffect(() => { setOpen(false); }, [pathname]);

  // Klik-buiten + Escape
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      const insidePanel = panelRef.current?.contains(t);
      const onButton = btnRef.current?.contains(t);
      if (!insidePanel && !onButton) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Scroll lock op mobiel
  useEffect(() => {
    const b = document.body;
    const prev = b.style.overflow;
    if (open) b.style.overflow = "hidden";
    return () => { b.style.overflow = prev; };
  }, [open]);

  return (
    <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
        {/* Logo links */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo/logo-full.png"
            alt="PharmGtN"
            width={140}
            height={40}
            priority
          />
        </Link>

        {/* Desktop menu */}
        <nav className="hidden md:flex items-center gap-1">
          {items.map((it) => (
            <LeftItem key={it.href} href={it.href} label={it.label} />
          ))}
        </nav>

        <div className="ml-auto" />

        {/* Rechts: login status (desktop) */}
        <div className="hidden md:flex items-center gap-3">
          {status === "authenticated" ? (
            <>
              <span className="text-sm text-gray-600">{session?.user?.email}</span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="inline-flex items-center rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Log uit
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg bg-sky-600 text-white text-sm px-4 py-2 hover:bg-sky-700"
            >
              Login
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          ref={btnRef}
          type="button"
          className="md:hidden inline-flex items-center justify-center rounded-lg border px-3 py-2"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Open menu</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {/* Mobile panel */}
      <div
        id="mobile-nav"
        ref={panelRef}
        className={`md:hidden overflow-hidden border-t transition-[max-height] duration-300 ease-in-out ${
          open ? "max-h-[70vh]" : "max-h-0"
        }`}
        aria-hidden={!open}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-2">
          {items.map((it) => (
            <LeftItem
              key={it.href}
              href={it.href}
              label={it.label}
              onClick={() => setOpen(false)}
            />
          ))}

          {status === "authenticated" ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/" });
              }}
              className="mt-2 inline-flex items-center w-fit rounded-lg border px-4 py-2 hover:bg-gray-50"
            >
              Log uit
            </button>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center w-fit rounded-lg bg-sky-600 text-white text-sm px-4 py-2 hover:bg-sky-700"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
