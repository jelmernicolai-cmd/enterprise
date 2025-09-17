'use client';

import React from 'react';
import { parseWorkbook } from '@/lib/ingest';
import { usePortal } from './PortalProvider';

export default function Uploader() {
  const { setRows } = usePortal();

  async function handleFile(file: File) {
    const buf = await file.arrayBuffer();
    const parsed = parseWorkbook(buf);
    setRows(parsed);
  }

  return (
    <div className="rounded-xl border p-4 bg-white">
      <p className="text-sm text-gray-600">Upload je data (Excel .xlsx/.xls of .csv). Eerste tab wordt gelezen. Kolomnamen mogen NL/EN varianten zijn.</p>
      <label className="mt-3 inline-block cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-lg">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        Bestand kiezen
      </label>
    </div>
  );
}
