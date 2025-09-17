"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** ---------- utils ---------- */
function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}
const iconBase = "h-4 w-4 shrink-0";
const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  vectorEffect: "non-scaling-stroke" as const,
};

/** ---------- icon components (losse functies, stabieler voor SWC) ---------- */
type IconProps = { className?: string };

function IconDashboard({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${iconBase} ${className || ""}`}>
      <path d="M4 14a8 8 0 1 1 16 0v3a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-3Z" {...common} />
      <path d="M12 12l4.5-2.5" {...common} />
      <circle cx="12" cy="14.5" r="1.2" {...common} />
    </svg>
  );
}
function IconWaterfall({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${iconBase} ${className || ""}`}>
      <path d="M3 20.5H21" {...common} />
      <path d="M5 16.5h6v-4h5v-5h3" {...common} />
    </svg>
  );
}
function IconScatter({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${iconBase} ${className || ""}`}>
      <path d="M3.5 20.5H20.5M3.5 20.5V3.5" {...common} />
      <path d="M5 18.5L19 6.5" strokeDasharray="4 4" {...common} />
      <circle cx="8" cy="15" r="2.2" {...common} />
      <circle cx="12.5" cy="10" r="2.2" {...common} />
      <circle cx="17" cy="7" r="2.2" {...common} />
    </svg>
  );
}
function IconArrows({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${iconBase} ${className || ""}`}>
      <path d="M7 8h9" {...common} />
      <path d="M16 8l-3-3" {...common} />
      <path d="M16 8l-3 3" {...common} />
      <path d="M17 16H8" {...common} />
      <path d="M9 16l3-3" {...common} />
      <path d="M9 16l3 3" {...common} />
    </svg>
  );
}
function IconBoxes({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${iconBase} ${className || ""}`}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" {...common} />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="2" {...common} />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="2" {...common} />
      <rect x="13" y="13" width="7.5" height="7.5" rx="2" {...common} />
    </svg>
  );
}
function IconLoe({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${iconBase} ${className || ""}`}>
      <rect x="4.5" y="6.5" width="9" height="5" rx="2.5" {...common} />
      <path d="M14 14.5v4M14 18.5l2-2M14 18.5l-2-2" {...common} />
    </svg>
  );
}
function IconMonitor({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${iconBase} ${className || ""}`}>
      <rect x="3.5" y="4.5" width="17" height="12" rx="2" {...common} />
      <path d="M9 19.5h6M12 16.5v3" {...common} />
    </svg>
  );
}
function IconTagPercent({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${iconBase} ${className || ""}`}>
      <path d="M3.5 12l8-8h6l3 3v6l-8 8-9-9Z" {...common} />
      <path d="M9 15l6-6" {...common} />
      <circle cx="14.5" cy="9.5" r="0.8" {...common} />
      <circle cx="9.5" cy="14.5" r="0.8" {...common} />
    </svg>
  );
}
function IconBenchmark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${iconBase} ${className || ""}`}>
      <path d="M3.5 20.5H20.5" {...common} />
      <rect x="6" y="11" width="2.8" height="6.5" rx="0.8" {...common} />
      <rect x="10.6" y="8.5" width="2.8" height="9" rx="0.8" {...common} />
      <rect x="15.2" y="13" width="2.8" height="4.5" rx="0.8" {...common} />
      <path d="M5 9.5H19" strokeDasharray="4 3" {...common} />
    </svg>
  );
}
function IconUpload({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${iconBase} ${className || ""}`}>
      <path d="M12 16V6" {...common} />
      <path d="M8.5 9.5L12 6l3.5 3.5" {...common} />
      <path d="M4 18.5h16" {...common} />
    </svg>
  );
}
function IconTemplate({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${iconBase} ${className || ""}`}>
      <rect x="4" y="4" width="16" height="16" rx="3" {...common} />
      <path d="M8 9h8M8 12h8M8 15h6" {...common} />
    </svg>
  );
}
function IconSettings({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${iconBase} ${className || ""}`}>
      <circle cx="12" cy="12" r="3.2" {...common} />
      <path d="M19 13.5a7.5 7.5 0 0 0 0-3l1.5-1a1 1 0 0 0 .3-1.3l-1.1-1.9a1 1 0 0 0-1.2-.4l-1.7.6a7.5 7.5 0 0 0-2.6-1.5l-.3-1.7a1 1 0 0 0-1-.8h-2.2a1 1 0 0 0-1 .8l-.3 1.7a7.5 7.5 0 0 0-2.6 1.5l-1.7-.6a1 1 0 0 0-1.2.4L3.2 8.2a1 1 0 0 0 .3 1.3L5 10.5a7.5 7.5 0 0 0 0 3l-1.5 1a1 1 0 0 0-.3 1.3l1.1 1.9a1 1 0 0 0 1.2.4l1.7-.6a7.5 7.5 0 0 0 2.6 1.5l.3 1.7a1 1 0 0 0 1 .8h2.2a1 1 0 0 0 1-.8l.3-1.7a7.5 7.5 0 0 0 2.6-1.5l1.7.6a1 1 0 0 0 1.2-.4l1.1-1.9a1 1 0 0 0-.3-1.3L19 13.5Z" {...common} />
    </svg>
  );
}
function IconSupport({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${iconBase} ${className || ""}`}>
      <path d="M6 10a6 6 0 1 1 12 0v5a4 4 0 0 1-4 4" {...common} />
      <path d="M6 12v3M18 12v3M11 20h2" {...common} />
    </svg>
  );
}
function IconExternal({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${className || ""}`}>
      <path d="M14 4h6M20 4v6M20 4l-9 9" {...common} />
      <path d="M20 14v4a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2h4" {...common} />
    </svg>
  );
}

/** ---------- icon registry ---------- */
const Icons = {
  dashboard: IconDashboard,
  waterfall: IconWaterfall,
  scatter: IconScatter,
  arrows: IconArrows,
  boxes: IconBoxes,
  loe: IconLoe,
  monitor: IconMonitor,
  tagPercent: IconTagPercent,
  benchmark: IconBenchmark,
  upload: IconUpload,
  template: IconTemplate,
  settings: IconSettings,
  support: IconSupport,
  external: IconExternal,
} as const;

type IconKey = keyof typeof Icons;
type Item = { href: string; label: string; icon?: IconKey; external?: boolean; badge?: string };

/** ---------- helpers ---------- */
function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app" || pathname === "/app/";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavList({
  pathname,
  items,
  onItemClick,
}: {
  pathname: string;
  items: Item[];
  onItemClick?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((it) => {
        const active = isActive(pathname, it.href);
        const Icon = it.icon ? Icons[it.icon] : null;
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              onClick={onItemClick}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group flex items-center gap-2 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/40",
                active
                  ? "bg-sky-50 text-sky-900 border-l-2 border-sky-600"
                  : "text-gray-700 hover:bg-gray-50 border-l-2 border-transparent"
              )}
            >
              {Icon ? (
                <Icon className={cx(active ? "text-sky-700" : "text-gray-500 group-hover:text-gray-700")} />
              ) : null}
              <span className="flex-1 truncate">{it.label}</span>
              {it.badge ? (
                <span className="ml-2 rounded-full bg-sky-100 text-sky-800 text-[10px] px-2 py-0.5">
                  {it.badge}
                </span>
              ) : null}
              {it.external ? <Icons.external className="text-gray-400" /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** ---------- inklapbare sectie met persistente status (v2 keys) ---------- */
function CollapsibleSection({
  id,
  title,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const key = `sidebar.sec.v2.${id}`;

  // load persisted state
  useEffect(() => {
    try {
      const val = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      if (val === "0") setOpen(false);
      if (val === "1") setOpen(true);
    } catch {}
  }, [key]);

  // persist on change
  useEffect(() => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(key, open ? "1" : "0");
    } catch {}
  }, [key, open]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx(
          "w-full flex items-center justify-between gap-2 px-3 pt-4 text-[11px] font-semibold tracking-wide uppercase",
          "text-gray-400 hover:text-gray-600"
        )}
      >
        <span>{title}</span>
        <span className={cx("transition-transform duration-200", open ? "rotate-90" : "rotate-0")} aria-hidden>
          ▸
        </span>
      </button>
      <div
        className={cx(
          "overflow-hidden transition-[max-height] duration-300 ease-in-out",
          open ? "max-h-[800px]" : "max-h-0"
        )}
      >
        <div className="px-1 pb-2">{children}</div>
      </div>
    </div>
  );
}

/** ---------- component ---------- */
export default function Sidebar() {
  const pathname = usePathname() || "/app";
  const [open, setOpen] = useState(true); // standaard UITGEKLAPT op mobiel
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // open houden bij route change (verwijder dit als je wilt dat 'ie sluit bij navigatie)
  useEffect(() => {
    setOpen(true);
  }, [pathname]);

  // click-outside + esc
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(t) && btnRef.current && !btnRef.current.contains(t)) {
        setOpen(false);
      }
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

  const crumb = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return (parts[1] ?? "Dashboard").replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  }, [pathname]);

  const ANALYSES: Item[] = [
    { href: "/app", label: "Dashboard", icon: "dashboard" },
    { href: "/app/waterfall", label: "Waterfall", icon: "waterfall" },
    { href: "/app/consistency", label: "Consistency", icon: "scatter" },
    { href: "/app/parallel", label: "Parallel", icon: "arrows" },
    { href: "/app/supply", label: "Stock Management", icon: "boxes" },
    { href: "/app/loe", label: "LoE Scenario's", icon: "loe" },
    { href: "/app/contracts", label: "Contract Performance", icon: "monitor" },
  ];
  const PRICING: Item[] = [
    { href: "/app/pricing", label: "Prijsbeheer", icon: "tagPercent" },
    { href: "/app/benchmark", label: "Kortingsbenchmark (NL)", icon: "benchmark", badge: "nieuw" },
  ];
  const DATA_UPLOAD: Item[] = [
    { href: "/app/upload", label: "Upload masterfile", icon: "upload" },
    { href: "/templates", label: "Templates", icon: "template" },
  ];
  const SETTINGS_SUPPORT: Item[] = [
    { href: "/app/settings", label: "Instellingen", icon: "settings" },
    { href: "/contact", label: "Contact & Support", icon: "support" },
  ];

  return (
    <aside className="bg-white md:min-h-[calc(100vh-56px)] flex flex-col">
      {/* top-bar */}
      <div className="flex items-center gap-3 p-3 border-b sticky top-0 z-20 bg-white">
        <Link
  href="/"
  className="inline-flex items-center justify-center rounded p-1.5 hover:bg-gray-50"
  aria-label="Terug naar website"
  title="Terug naar website"
>
  <Image src="/images/icon.png" alt="" width={16} height={16} className="h-4 w-4" />
</Link>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden md:inline text-xs text-gray-400">Sectie:</span>
          <span className="text-xs font-medium text-gray-700">{crumb}</span>
          <button
            ref={btnRef}
            className="md:hidden text-xs px-2 py-1 border rounded hover:bg-gray-50"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="portal-mobile-menu"
            aria-label="Zijbalk tonen/verbergen"
          >
            Menu
          </button>
        </div>
      </div>

      {/* scrollbare content tussen topbar en footer */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Desktop menu */}
        <div className="hidden md:block p-3 space-y-2">
          <CollapsibleSection id="analyses" title="Analyses" defaultOpen>
            <NavList pathname={pathname} items={ANALYSES} />
          </CollapsibleSection>
          <CollapsibleSection id="pricing" title="Pricing" defaultOpen>
            <NavList pathname={pathname} items={PRICING} />
          </CollapsibleSection>
          <CollapsibleSection id="data" title="Data & Upload" defaultOpen>
            <NavList pathname={pathname} items={DATA_UPLOAD} />
          </CollapsibleSection>
          <CollapsibleSection id="settings" title="Instellingen & Support" defaultOpen>
            <NavList pathname={pathname} items={SETTINGS_SUPPORT} />
          </CollapsibleSection>
        </div>

        {/* Mobiel menu */}
        <nav
          id="portal-mobile-menu"
          ref={panelRef}
          className={cx(
            "md:hidden border-t transition-[max-height] duration-300 ease-in-out",
            open ? "max-h-[80vh]" : "max-h-0"
          )}
          aria-hidden={!open}
        >
          {/* eigen scroll in panel zodat lange lijsten bereikbaar zijn */}
          <div className="p-3 space-y-2 overflow-y-auto max-h-[80vh]">
            <CollapsibleSection id="m-analyses" title="Analyses" defaultOpen>
              <NavList pathname={pathname} items={ANALYSES} onItemClick={() => setOpen(false)} />
            </CollapsibleSection>
            <CollapsibleSection id="m-pricing" title="Pricing" defaultOpen>
              <NavList pathname={pathname} items={PRICING} onItemClick={() => setOpen(false)} />
            </CollapsibleSection>
            <CollapsibleSection id="m-data" title="Data & Upload" defaultOpen>
              <NavList pathname={pathname} items={DATA_UPLOAD} onItemClick={() => setOpen(false)} />
            </CollapsibleSection>
            <CollapsibleSection id="m-settings" title="Instellingen & Support" defaultOpen>
              <NavList pathname={pathname} items={SETTINGS_SUPPORT} onItemClick={() => setOpen(false)} />
            </CollapsibleSection>
          </div>
        </nav>
      </div>

      {/* footer */}
      <div className="mt-auto p-3 border-t text-[11px] text-gray-500">
        Ingelogd via GtN Portal •{" "}
        <Link className="underline hover:no-underline" href="/pricing">
          Licentiebeheer
        </Link>
      </div>
    </aside>
  );
}
