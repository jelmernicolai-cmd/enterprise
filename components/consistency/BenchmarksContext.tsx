"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Method = "median" | "overall";

type BenchmarksState = {
  method: Method;          // welke benchmark-methode
  majorPP: number;         // drempel voor “grote afwijking” (pp)
  minorPP: number;         // drempel voor “lichte afwijking” (pp)
  setMethod: (m: Method) => void;
  setMajorPP: (v: number) => void;
  setMinorPP: (v: number) => void;
};

const Ctx = createContext<BenchmarksState | null>(null);
const LS_KEY = "consistency_benchmarks_v1";

export function BenchmarksProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // Defaults
  const [method, setMethod] = useState<Method>("median");
  const [majorPP, setMajorPP] = useState<number>(5);
  const [minorPP, setMinorPP] = useState<number>(2);

  // 1) Init vanuit URL of localStorage
  useEffect(() => {
    // URL > LS > defaults
    const spMethod = (search.get("bm") as Method) || null;      // bm=median|overall
    const spMaj = search.get("maj");
    const spMin = search.get("min");

    let nextMethod = method;
    let nextMaj = majorPP;
    let nextMin = minorPP;

    if (spMethod === "median" || spMethod === "overall") nextMethod = spMethod;
    if (spMaj && !isNaN(Number(spMaj))) nextMaj = Number(spMaj);
    if (spMin && !isNaN(Number(spMin))) nextMin = Number(spMin);

    if (!spMethod && !spMaj && !spMin) {
      // geen URL params → probeer LS
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.method === "median" || parsed.method === "overall") nextMethod = parsed.method;
          if (typeof parsed.majorPP === "number") nextMaj = parsed.majorPP;
          if (typeof parsed.minorPP === "number") nextMin = parsed.minorPP;
        }
      } catch {}
    }

    setMethod(nextMethod);
    setMajorPP(nextMaj);
    setMinorPP(nextMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init slechts 1x

  // 2) Schrijf door naar URL (shallow) + LS zodra verandert
  useEffect(() => {
    // URL updaten zonder navigatie
    const params = new URLSearchParams(search?.toString() || "");
    params.set("bm", method);
    params.set("maj", String(majorPP));
    params.set("min", String(minorPP));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    // LS
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ method, majorPP, minorPP })
      );
    } catch {}
  }, [method, majorPP, minorPP, pathname, router, search]);

  const value = useMemo<BenchmarksState>(() => ({
    method, majorPP, minorPP,
    setMethod, setMajorPP, setMinorPP
  }), [method, majorPP, minorPP]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBenchmarks() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useBenchmarks must be used within <BenchmarksProvider>");
  }
  return ctx;
}
