// components/portal/AppShell.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import Sidebar from "./Sidebar";

type Props = {
  email: string;
  hasActiveSub: boolean;
  children: React.ReactNode;
};

export default function AppShell({ email, hasActiveSub, children }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  /* ---- Mount flag voor portals (voorkomt SSR mismatch) ---- */
  useEffect(() => setMounted(true), []);

  /* ---- Sluit drawer bij route wissel ---- */
  useEffect(() => { setOpen(false); }, [pathname]);

  /* ---- Body scroll lock bij open drawer (iOS-vriendelijk: html) ---- */
  useEffect(() => {
    const el = document.documentElement;
    const prevOverflow = el.style.overflow;
    const prevTouch = el.style.touchAction;
    if (open) {
      el.style.overflow = "hidden";
      el.style.touchAction = "none";
    }
    return () => {
      el.style.overflow = prevOverflow;
      el.style.touchAction = prevTouch;
    };
  }, [open]);

  /* ---- ESC sluit drawer + focus verplaatsen naar eerste focusable ---- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    if (open) {
      document.addEventListener("keydown", onKey);
      // kleine delay zodat het paneel in DOM staat
      const t = setTimeout(() => {
        const first = panelRef.current?.querySelector<HTMLElement>(
          'a[href],button,select,input,textarea,[tabindex]:not([tabindex="-1"])'
        );
        first?.focus();
      }, 15);
      return () => { document.removeEventListener("keydown", onKey); clearTimeout(t); };
    }
  }, [open]);

  /* ---- Alleen sluiten bij échte navigatie (links), NIET bij toggles ---- */
  function onSidebarClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;

    // expliciete opt-out: alles met data-drawer-close sluit altijd
    if (target.closest("[data-drawer-close]")) { setOpen(false); return; }

    const a = target.closest("a[href]") as HTMLAnchorElement | null;
    if (!a) return;

    const href = a.getAttribute("href") || "";
    if (href === "#" || href.startsWith("#")) return;                  // ankers/toggles
    if (a.target === "_blank") return;                                 // nieuw tabblad
    if ((e as any).metaKey || (e as any).ctrlKey || (e as any).shiftKey || (e as any).altKey) return;

    // alleen same-origin navigaties sluiten de drawer
    try {
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
    } catch { /* ignore parse issues */ }

    setOpen(false);
  }

  /* ---- Drawer via portal (betere stacking, geen z-index issues) ---- */
  const Drawer = () => (
    <div className={`fixed inset-0 z-50 md:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={() => setOpen(false)}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigatie"
        className={[
          "absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white border-r shadow-xl",
          "overflow-y-auto will-change-transform",
          "transition-transform duration-300 motion-reduce:transition-none",
          open ? "translate-x-0" : "-translate-x-full",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        ].join(" ")}
        onClick={onSidebarClick}
      >
        <div className="p-3">
          {/* Tip: wil je secties standaard open op mobiel? <Sidebar forceExpandAll /> */}
          <Sidebar />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen grid md:grid-cols-[240px_1fr] bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex border-r bg-white">
        <div className="w-[240px] p-3 overflow-y-auto">
          <Sidebar />
        </div>
      </aside>

      {/* Main kolom */}
      <section className="flex flex-col min-h-screen">
        {/* Topbar */}
        <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
          <div className="px-4 md:px-6 h-12 flex items-center gap-3">
            {/* Mobile menu knop */}
            <button
              className="md:hidden inline-flex items-center justify-center rounded-md border px-2 py-1.5 hover:bg-gray-50"
              onClick={() => setOpen(true)}
              aria-controls="mobile-drawer"
              aria-expanded={open}
              aria-label="Open menu"
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M3 5h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2z"/>
              </svg>
            </button>

            <div className="font-semibold tracking-tight text-sm sm:text-[15px]">PharmaGtN</div>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                <span>Ingelogd als</span>
                <span className="font-medium text-gray-900 truncate max-w-[220px]">{email}</span>
              </div>
              <span
                className={[
                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs border",
                  hasActiveSub
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-amber-50 text-amber-800 border-amber-200",
                ].join(" ")}
              >
                {hasActiveSub ? "Actief abonnement" : "Geen actief abonnement"}
              </span>
            </div>
          </div>
        </div>

        {/* Content scrollcontainer */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </section>

      {/* Mobile drawer */}
      {mounted && createPortal(<Drawer />, document.body)}
    </div>
  );
}
