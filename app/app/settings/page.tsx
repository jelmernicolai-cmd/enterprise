// app/app/settings/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** ================= Types ================= */
type Locale = "nl-NL" | "en-GB";
type DateFormat = "YYYY-MM" | "DD-MM-YYYY";
type Decimals = 0 | 1 | 2;
type Theme = "system" | "light" | "dark";
type DefaultDash = "waterfall" | "consistency" | "parallel";

type Settings = {
  _v: number;
  locale: Locale;
  dateFormat: DateFormat;
  decimals: Decimals;
  theme: Theme;
  defaultDash: DefaultDash;
  dataMin: boolean;
  notifyUploadOk: boolean;
  notifyUploadFail: boolean;
};

const KEY = "pgtn_settings_v2"; // v2: nieuwe key zodat oude state je defaults niet overschrijft
const VERSION = 2;

const DEFAULTS: Settings = {
  _v: VERSION,
  locale: "nl-NL",
  dateFormat: "YYYY-MM",
  decimals: 0,
  theme: "system",
  defaultDash: "waterfall",
  dataMin: true,
  notifyUploadOk: true,
  notifyUploadFail: true,
};

/** ================= Utils ================= */
const isBrowser = () => typeof window !== "undefined";
const cx = (...cls: (string | false | null | undefined)[]) => cls.filter(Boolean).join(" ");

function migrateSettings(s: any): Settings {
  const merged = { ...DEFAULTS, ...(s || {}) };
  merged._v = VERSION;
  return merged as Settings;
}
function loadSettings(): Settings {
  if (!isBrowser()) return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return migrateSettings(JSON.parse(raw));
  } catch {
    return DEFAULTS;
  }
}
function saveSettings(s: Settings) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}
function broadcastSettings(s: Settings) {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent<Settings>("pgtn:settings", { detail: s }));
}
function applyTheme(theme: Theme) {
  if (!isBrowser()) return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
}

// datum/getal previews (zonder externe lib)
function fmtDate(d: Date, f: DateFormat) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return f === "YYYY-MM" ? `${yyyy}-${mm}` : `${dd}-${mm}-${yyyy}`;
}
function fmtNumber(n: number, locale: Locale, decimals: Decimals) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

/** ================= Page ================= */
export default function SettingsPage() {
  const router = useRouter();
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const importRef = useRef<HTMLTextAreaElement>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Initial load
  useEffect(() => {
    const init = loadSettings();
    setS(init);
    applyTheme(init.theme);
    broadcastSettings(init);
  }, []);

  // Autosave + broadcast + theme (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      saveSettings(s);
      broadcastSettings(s);
      applyTheme(s.theme);
    }, 150);
    return () => clearTimeout(t);
  }, [s]);

  function save() {
    saveSettings(s);
    broadcastSettings(s);
    applyTheme(s.theme);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  function reset() {
    setS(DEFAULTS);
    saveSettings(DEFAULTS);
    broadcastSettings(DEFAULTS);
    applyTheme(DEFAULTS.theme);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  function gotoDefaultDash() {
    router.push(`/app/${s.defaultDash}`);
  }

  // Live preview
  const now = useMemo(() => new Date(), []);
  const previewDate = fmtDate(now, s.dateFormat);
  const previewNumber = fmtNumber(12345.678, s.locale, s.decimals);

  // Import/export
  function doExport() {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pharmgtn-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  function doImport() {
    try {
      const raw = importRef.current?.value?.trim();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const merged = migrateSettings(parsed);
      setS(merged);
      saveSettings(merged);
      broadcastSettings(merged);
      applyTheme(merged.theme);
      setImportOpen(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      alert("Kon de JSON niet lezen. Controleer het bestand.");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Instellingen</h1>
          <p className="mt-1 text-sm text-gray-600">
            Voorkeuren voor weergave en notificaties. Lokaal opgeslagen in je browser en direct actief in de portal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={gotoDefaultDash} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            Ga naar standaarddashboard
          </button>
          <Link href="/app" className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            Terug naar Portal
          </Link>
        </div>
      </div>

      {/* Saved toast */}
      {saved && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          Opgeslagen ✅
        </div>
      )}

      <div className="grid gap-6">
        {/* Weergave */}
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Weergave</h2>
          <p className="mt-1 text-sm text-gray-600">Taal, datum- en getalnotatie, thema en standaard dashboard.</p>

          <div className="mt-4 grid gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Taal">
                <select
                  value={s.locale}
                  onChange={(e) => setS({ ...s, locale: e.target.value as Settings["locale"] })}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="nl-NL">Nederlands (NL)</option>
                  <option value="en-GB">English (UK)</option>
                </select>
              </Field>

              <Field label="Datumnotatie">
                <select
                  value={s.dateFormat}
                  onChange={(e) => setS({ ...s, dateFormat: e.target.value as Settings["dateFormat"] })}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="YYYY-MM">YYYY-MM</option>
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                </select>
              </Field>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Decimalen">
                <select
                  value={s.decimals}
                  onChange={(e) => setS({ ...s, decimals: Number(e.target.value) as Settings["decimals"] })}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </Field>

              <Field label="Thema">
                <select
                  value={s.theme}
                  onChange={(e) => setS({ ...s, theme: e.target.value as Settings["theme"] })}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="system">Systeem</option>
                  <option value="light">Licht</option>
                  <option value="dark">Donker</option>
                </select>
              </Field>

              <Field label="Standaard dashboard">
                <select
                  value={s.defaultDash}
                  onChange={(e) => setS({ ...s, defaultDash: e.target.value as Settings["defaultDash"] })}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="waterfall">Waterfall</option>
                  <option value="consistency">Consistency</option>
                  <option value="parallel">Parallel</option>
                </select>
              </Field>
            </div>

            {/* Live preview */}
            <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-700">
              <div className="flex flex-wrap gap-4">
                <div><span className="font-medium">Datum:</span> {previewDate}</div>
                <div><span className="font-medium">Getal:</span> {previewNumber}</div>
                <div><span className="font-medium">Thema:</span> {s.theme}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & notificaties */}
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Privacy & notificaties</h2>
          <p className="mt-1 text-sm text-gray-600">Alleen wat nodig is.</p>

          <div className="mt-4 grid gap-3">
            <Toggle
              label="Dataminimalisatie (aanbevolen)"
              checked={s.dataMin}
              onChange={(v) => setS({ ...s, dataMin: v })}
            />
            <div className="grid md:grid-cols-2 gap-3">
              <Toggle
                label="E-mail bij geslaagde upload"
                checked={s.notifyUploadOk}
                onChange={(v) => setS({ ...s, notifyUploadOk: v })}
              />
              <Toggle
                label="E-mail bij uploadfout/validatie"
                checked={s.notifyUploadFail}
                onChange={(v) => setS({ ...s, notifyUploadFail: v })}
              />
            </div>
          </div>
        </section>

        {/* Acties */}
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Acties</h2>
          <p className="mt-1 text-sm text-gray-600">Autosave is actief. Je kunt ook handmatig opslaan of resetten.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={save} className="rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
              Opslaan
            </button>
            <button onClick={reset} className="rounded-lg border px-4 py-2 hover:bg-gray-50">
              Reset naar standaard
            </button>
            <button onClick={doExport} className="rounded-lg border px-4 py-2 hover:bg-gray-50">
              Exporteer JSON
            </button>
            <button onClick={() => setImportOpen((v) => !v)} className="rounded-lg border px-4 py-2 hover:bg-gray-50">
              {importOpen ? "Sluit import" : "Importeer JSON"}
            </button>
          </div>

          {importOpen && (
            <div className="mt-3 grid gap-2">
              <textarea
                ref={importRef}
                placeholder='Plak hier je JSON ({"locale":"nl-NL", ...})'
                className="min-h-[120px] w-full rounded-lg border px-3 py-2 font-mono text-xs"
              />
              <div className="flex gap-2">
                <button onClick={doImport} className="rounded-lg bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700">
                  Importeren
                </button>
                <button onClick={() => setImportOpen(false)} className="rounded-lg border px-3 py-2 hover:bg-gray-50">
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Hint voor integratie */}
        <p className="text-xs text-gray-500">
          Tip: luister elders in de app naar <code>window.addEventListener("pgtn:settings", (e) =&gt; e.detail)</code>.
          Lees initiale waarden met <code>localStorage.getItem("{KEY}")</code>.
        </p>
      </div>
    </main>
  );
}

/** ================= Kleine UI helpers ================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        className="rounded"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
