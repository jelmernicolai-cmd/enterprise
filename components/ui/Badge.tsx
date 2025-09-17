"use client";
import React from "react";

export default function Badge({ children, tone = "info" }:{
  children: React.ReactNode; tone?: "info"|"success"|"warn";
}) {
  const cls =
    tone === "success" ? "bg-green-50 text-green-700 border-green-200" :
    tone === "warn"    ? "bg-amber-50 text-amber-800 border-amber-200" :
                         "bg-sky-50 text-sky-700 border-sky-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs border ${cls}`}>
      {children}
    </span>
  );
}
