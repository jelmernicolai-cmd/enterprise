// lib/contract-time.ts
export type PeriodKind = "M" | "Q";
export type NormPeriod = {
  kind: PeriodKind;      // "M" of "Q"
  key: string;           // "YYYY-MM" of "YYYY-Qn"
  label: string;         // "MM-YYYY" of "Qn-YYYY"
  sortKey: number;       // 202402, 202401, of 2024*10 + q
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export function normalizePeriodFlexible(raw: string): NormPeriod | null {
  const s = String(raw || "").trim();

  // Maand: MM-YYYY
  let m = /^(\d{2})-(\d{4})$/.exec(s);
  if (m) {
    const mm = parseInt(m[1], 10), yyyy = parseInt(m[2], 10);
    if (mm >= 1 && mm <= 12) {
      return {
        kind: "M",
        key: `${yyyy}-${pad2(mm)}`,         // canonical
        label: `${pad2(mm)}-${yyyy}`,
        sortKey: yyyy * 100 + mm,
      };
    }
  }

  // Maand: YYYY-MM
  m = /^(\d{4})-(\d{2})$/.exec(s);
  if (m) {
    const yyyy = parseInt(m[1], 10), mm = parseInt(m[2], 10);
    if (mm >= 1 && mm <= 12) {
      return {
        kind: "M",
        key: `${yyyy}-${pad2(mm)}`,
        label: `${pad2(mm)}-${yyyy}`,
        sortKey: yyyy * 100 + mm,
      };
    }
  }

  // Kwartaal: Qn-YYYY
  m = /^Q([1-4])-(\d{4})$/.exec(s);
  if (m) {
    const q = parseInt(m[1], 10), yyyy = parseInt(m[2], 10);
    return {
      kind: "Q",
      key: `${yyyy}-Q${q}`,
      label: `Q${q}-${yyyy}`,
      sortKey: yyyy * 10 + q,
    };
  }

  // Kwartaal: YYYY-Qn
  m = /^(\d{4})-Q([1-4])$/.exec(s);
  if (m) {
    const yyyy = parseInt(m[1], 10), q = parseInt(m[2], 10);
    return {
      kind: "Q",
      key: `${yyyy}-Q${q}`,
      label: `Q${q}-${yyyy}`,
      sortKey: yyyy * 10 + q,
    };
  }

  return null;
}

/** Maand → kwartaal (canoniek) */
export function monthToQuarter(keyYYYYMM: string): string {
  const [y, m] = keyYYYYMM.split("-").map(Number);
  const q = Math.ceil(m / 3);
  return `${y}-Q${q}`;
}
