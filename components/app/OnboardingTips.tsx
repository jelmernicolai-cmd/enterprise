"use client";
import { useEffect, useState } from "react";

const steps = [
  { t: "Upload je sales & discounts", d: "Gebruik de templates in de bibliotheek voor een vliegende start." },
  { t: "Bekijk de Gross-to-Net waterfall", d: "Zie per stap waar marge weglekt en waar je kunt sturen." },
  { t: "Maak 2 scenario’s", d: "Vergelijk direct de impact op ROI en compliance." },
];

export default function OnboardingTips() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("pgtn_onboarded")) setShow(true);
  }, []);
  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border bg-white shadow-lg">
      <div className="p-4">
        <h4 className="font-semibold mb-2">Snel starten</h4>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-700">
          {steps.map(s => <li key={s.t}><span className="font-medium">{s.t}:</span> {s.d}</li>)}
        </ol>
        <button
          className="mt-3 rounded-xl border px-3 py-1.5 text-sm"
          onClick={() => localStorage.setItem("pgtn_onboarded", "1")}
        >
          Begrepen
        </button>
      </div>
    </div>
  );
}
