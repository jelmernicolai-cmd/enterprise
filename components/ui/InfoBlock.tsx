"use client";
import React from "react";

export default function InfoBlock({ summary, children }:{
  summary: string; children: React.ReactNode;
}) {
  return (
    <details className="rounded-xl border bg-white p-4 open:shadow-sm">
      <summary className="cursor-pointer list-none font-medium flex items-center gap-2">
        <span className="inline-block w-5 h-5 rounded-full border text-xs flex items-center justify-center">i</span>
        {summary}
      </summary>
      <div className="mt-3 text-sm text-gray-700">{children}</div>
    </details>
  );
}
