"use client";
import React from "react";

export function FieldRow({children}:{children:React.ReactNode}) {
  return <div className="grid sm:grid-cols-[160px_1fr] gap-3 items-center">{children}</div>;
}

export function Label({children}:{children:React.ReactNode}) {
  return <div className="text-sm text-gray-600">{children}</div>;
}
