export type LabFlag = "low" | "normal" | "high" | "critical" | "unknown";

/** Число из строки: "4,5" → 4.5; "отрицательно" → null. */
export function parseNumeric(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function computeFlag(
  numeric: number | null | undefined,
  refMin?: number | null,
  refMax?: number | null,
): LabFlag {
  if (numeric == null) return "unknown";
  if (refMin != null && numeric < refMin) return "low";
  if (refMax != null && numeric > refMax) return "high";
  if (refMin == null && refMax == null) return "unknown";
  return "normal";
}

export const FLAG_META: Record<LabFlag, { label: string; text: string; badge: string }> = {
  low: { label: "ниже нормы", text: "text-sky-300", badge: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  normal: { label: "норма", text: "text-emerald-300", badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  high: { label: "выше нормы", text: "text-rose-300", badge: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
  critical: {
    label: "критично",
    text: "text-rose-200 font-semibold",
    badge: "border-rose-400 bg-rose-500/25 text-rose-100",
  },
  unknown: { label: "без оценки", text: "text-slate-400", badge: "border-ink-700 text-slate-400" },
};

export function isAbnormal(flag: string): boolean {
  return flag === "low" || flag === "high" || flag === "critical";
}

export function isCritical(flag: string): boolean {
  return flag === "critical";
}

export function formatRef(
  refMin: number | null,
  refMax: number | null,
  unit?: string | null,
): string {
  const suffix = unit ? ` ${unit}` : "";
  if (refMin != null && refMax != null) return `${refMin}–${refMax}${suffix}`;
  if (refMin != null) return `≥ ${refMin}${suffix}`;
  if (refMax != null) return `≤ ${refMax}${suffix}`;
  return "—";
}

export const COMMON_TESTS = [
  "Гемоглобин",
  "Эритроциты",
  "Лейкоциты",
  "Тромбоциты",
  "СОЭ",
  "Гематокрит",
  "Глюкоза",
  "Холестерин общий",
  "ЛПНП",
  "ЛПВП",
  "Триглицериды",
  "АЛТ",
  "АСТ",
  "Билирубин общий",
  "Креатинин",
  "Мочевина",
  "ТТГ",
  "Т4 свободный",
  "Ферритин",
  "Витамин D",
  "С-реактивный белок",
  "Мочевая кислота",
];
