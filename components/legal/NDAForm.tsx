"use client";

import { useEffect, useRef, useState } from "react";

type State = {
  busy: boolean;
  error: string | null;
  signatureUrl?: string;
  metadataUrl?: string;
};

export default function NDAForm() {
  const [state, setState] = useState<State>({ busy: false, error: null });
  const [agreed, setAgreed] = useState(false);
  const [hasSig, setHasSig] = useState(false);

  const sigRef = useRef<HTMLCanvasElement>(null);

  // Init canvas (retina / DPR-safe)
  useEffect(() => {
    const c = sigRef.current;
    if (!c) return;
    resizeCanvasForDpr(c);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.strokeStyle = "#0f172a";
  }, []);

  // Tekenen met pointer events (muis + touch)
  useEffect(() => {
    const c = sigRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let drawing = false;
    let lastX = 0, lastY = 0;

    const getXY = (e: PointerEvent) => {
      const rect = c.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * devicePixelRatio,
        y: (e.clientY - rect.top) * devicePixelRatio,
      };
    };

    const down = (e: PointerEvent) => {
      drawing = true;
      const { x, y } = getXY(e);
      lastX = x; lastY = y;
      setHasSig(true);
    };
    const move = (e: PointerEvent) => {
      if (!drawing) return;
      const { x, y } = getXY(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastX = x; lastY = y;
    };
    const up = () => { drawing = false; };

    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointerleave", up);
    c.addEventListener("pointercancel", up);

    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointerleave", up);
      c.removeEventListener("pointercancel", up);
    };
  }, []);

  function clearSig() {
    const c = sigRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    setHasSig(false);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ busy: true, error: null });

    try {
      const fd = new FormData(e.currentTarget);

      // ✅ checkbox ook in FormData zetten
      fd.set("agreed", agreed ? "on" : "");

      const name = String(fd.get("name") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const org = String(fd.get("org") || "").trim();

      if (!name || !email || !org) throw new Error("Vul naam, e-mail en organisatie in.");
      if (!agreed) throw new Error("Vink akkoord met voorwaarden aan.");
      if (!hasSig) throw new Error("Zet eerst je handtekening.");

      // Canvas → PNG dataURL meesturen
      const sigDataUrl = sigRef.current!.toDataURL("image/png");
      fd.set("sigDataUrl", sigDataUrl);

      const res = await fetch("/api/nda/sign", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || "Opslaan mislukt.");

      setState({ busy: false, error: null, signatureUrl: data.signatureUrl, metadataUrl: data.metadataUrl });
    } catch (err: any) {
      setState({ busy: false, error: err?.message || "Er ging iets mis." });
    }
  }

  return (
    <form onSubmit={onSubmit} className="p-5 md:p-6 space-y-6">
      {/* Gegevens */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field name="name" label="Naam" placeholder="Voornaam Achternaam" required />
        <Field name="email" type="email" label="E-mail" placeholder="jij@bedrijf.nl" required />
        <Field name="org" label="Organisatie" placeholder="Bedrijfsnaam B.V." required />
      </div>

      {/* Voorwaarden (inklapbaar) */}
      <details className="rounded-2xl border bg-slate-50 open:bg-slate-50">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">Bekijk de NDA-voorwaarden</summary>
        <div className="px-4 pb-4 text-sm text-slate-700 space-y-3">
          <p>
            Deze NDA tussen <b>PharmGtN</b> en ondertekenaar beschermt vertrouwelijke informatie die in het kader van een (potentiële) samenwerking wordt gedeeld.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Gebruik uitsluitend voor evaluatie/samenwerking;</li>
            <li>Geen deling met derden zonder schriftelijke toestemming;</li>
            <li>Passende technische en organisatorische beveiliging;</li>
            <li>Duur: 3 jaar vanaf ondertekening.</li>
          </ul>
          <p className="text-xs text-slate-500">* Generieke template. Gebruik je eigen tekst indien gewenst.</p>
        </div>
      </details>

      {/* Handtekening */}
      <div className="rounded-2xl border p-4 bg-white">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-sm font-medium text-slate-700">Zet hier je handtekening</div>
          <button type="button" onClick={clearSig} className="text-xs rounded-lg border px-3 py-1.5 hover:bg-slate-50">
            Wissen
          </button>
        </div>
        <div className="rounded-xl border bg-white">
          <canvas
            ref={sigRef}
            style={{ width: "100%", height: 200, touchAction: "none", display: "block", borderRadius: 12 }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">Gebruik je muis of vinger (op mobiel). Klik “Wissen” om opnieuw te tekenen.</p>
      </div>

      {/* Akkoord */}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="agreed"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span className="text-slate-700">
          Ik ga akkoord met bovenstaande voorwaarden namens mijn organisatie.
        </span>
      </label>

      {/* Acties & status */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="submit"
          disabled={state.busy || !agreed}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {state.busy ? "Opslaan…" : "Ondertekenen & opslaan"}
        </button>

        {state.error && <span className="text-sm text-red-700">{state.error}</span>}
        {state.signatureUrl && (
          <span className="text-sm text-emerald-700">
            ✅ Opgeslagen —{" "}
            <a className="underline" href={state.signatureUrl} target="_blank" rel="noreferrer">handtekening</a>
            {" "}·{" "}
            <a className="underline" href={state.metadataUrl} target="_blank" rel="noreferrer">metadata</a>
          </span>
        )}
      </div>
    </form>
  );
}

function resizeCanvasForDpr(canvas: HTMLCanvasElement) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 600;
  const cssHeight = 200;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = cssWidth + "px";
  canvas.style.height = cssHeight + "px";
}

function Field(props: { name: string; label: string; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={props.name} className="text-sm font-medium text-slate-700">{props.label}</label>
      <input
        id={props.name}
        name={props.name}
        type={props.type || "text"}
        required={props.required}
        placeholder={props.placeholder}
        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/40"
      />
    </div>
  );
}
