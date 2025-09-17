"use client";

import { BenchmarksProvider } from "@/components/consistency/BenchmarksContext";

export default function ConsistencyLayout({ children }: { children: React.ReactNode }) {
  return <BenchmarksProvider>{children}</BenchmarksProvider>;
}
