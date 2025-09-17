// components/ui/Page.tsx
"use client";
import * as React from "react";

function cn(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

/** Buitenste shell: uniforme breedte, spacing en responsieve paddings */
export function PageShell({
  children,
  className,
  max = "max-w-screen-xl", // of "max-w-7xl"
}: {
  children: React.ReactNode;
  className?: string;
  max?: "max-w-screen-xl" | "max-w-7xl" | "max-w-6xl";
}) {
  return (
    <main className={cn(max, "mx-auto px-3 sm:px-4 lg:px-6 py-4 space-y-6", className)}>
      {children}
    </main>
  );
}

/** Headerrij met titel + acties rechts; houdt zich aan jouw look & feel */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("rounded-2xl border bg-white p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="text-sm text-gray-700 mt-1">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Sectiekaart: standaard kaart met border/white, consistent met Waterfall/Consistency */
export function SectionCard({
  title,
  subtitle,
  children,
  className,
  headerRight,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border bg-white p-4 md:p-5", className)}>
      {(title || headerRight) && (
        <div className="flex items-center justify-between gap-3">
          <div>
            {title ? <h2 className="text-base md:text-lg font-semibold">{title}</h2> : null}
            {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
          </div>
          {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
        </div>
      )}
      <div className={cn(title || subtitle || headerRight ? "mt-3" : "")}>{children}</div>
    </section>
  );
}

/** KPI-tegel: compact, bondig; kleurtoon optioneel */
export function KpiTile({
  label,
  value,
  help,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  help?: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
  className?: string;
}) {
  const toneCls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50"
      : tone === "bad"
      ? "border-rose-200 bg-rose-50"
      : "border-gray-200 bg-white";
  return (
    <div className={cn("rounded-2xl border p-3 sm:p-4", toneCls, className)}>
      <div className="text-[12px] text-gray-600">{label}</div>
      <div className="text-lg sm:text-xl font-semibold mt-1">{value}</div>
      {help ? <div className="text-[11px] sm:text-xs text-gray-600 mt-1">{help}</div> : null}
    </div>
  );
}

/** Grid hulpen (optioneel) — zo houd je code kort en consistent */
export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">{children}</div>;
}
export function TwoCol({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>;
}
export function ThreeCol({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-3">{children}</div>;
}
