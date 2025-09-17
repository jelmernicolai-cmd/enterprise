"use client";
import { useState } from "react";

export default function Page() {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("filename", f.name);

      const res = await fetch("/api/nda/sign", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error || "Upload mislukt");
      setUrl(data.url);
    } catch (e: any) {
      alert(e?.message || "Upload mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">NDA uploaden</h1>
      <input type="file" accept="application/pdf" onChange={onChange} />
      {busy && <p className="mt-2 text-sm text-slate-600">Bezig met uploaden…</p>}
      {url && (
        <p className="mt-3 text-sm">
          Opgeslagen:{" "}
          <a className="text-sky-700 underline" href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </p>
      )}
    </div>
  );
}
