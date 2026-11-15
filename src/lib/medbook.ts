export type MedBookType =
  | "fluorography"
  | "checkup"
  | "sanminimum"
  | "vaccination"
  | "other";

export const MEDBOOK_TYPES: { value: MedBookType; label: string }[] = [
  { value: "fluorography", label: "Флюорография" },
  { value: "checkup", label: "Медосмотр" },
  { value: "sanminimum", label: "Санминимум" },
  { value: "vaccination", label: "Прививка" },
  { value: "other", label: "Другое" },
];

export const MEDBOOK_TYPE_MAP = Object.fromEntries(
  MEDBOOK_TYPES.map((t) => [t.value, t.label]),
) as Record<MedBookType, string>;

export function typeLabel(value: string): string {
  return MEDBOOK_TYPE_MAP[value as MedBookType] ?? value;
}

export type ExpiryState = "expired" | "soon" | "valid" | "none";

export type Expiry = {
  state: ExpiryState;
  days: number | null;
  label: string;
  badge: string;
  dot: string;
};

const DAY = 86_400_000;
export const SOON_DAYS = 30;

export function expiry(validUntil: Date | null, now: Date = new Date()): Expiry {
  if (!validUntil) {
    return {
      state: "none",
      days: null,
      label: "без срока",
      badge: "border-ink-700 text-slate-400",
      dot: "bg-slate-500",
    };
  }

  const days = Math.ceil(
    (new Date(validUntil).setUTCHours(0, 0, 0, 0) -
      new Date(now).setUTCHours(0, 0, 0, 0)) /
      DAY,
  );

  if (days < 0) {
    return {
      state: "expired",
      days,
      label: `просрочено на ${Math.abs(days)} дн.`,
      badge: "border-rose-500/40 bg-rose-500/10 text-rose-300",
      dot: "bg-rose-400",
    };
  }
  if (days === 0) {
    return {
      state: "soon",
      days,
      label: "истекает сегодня",
      badge: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      dot: "bg-amber-400",
    };
  }
  if (days <= SOON_DAYS) {
    return {
      state: "soon",
      days,
      label: `истекает через ${days} дн.`,
      badge: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      dot: "bg-amber-400",
    };
  }
  return {
    state: "valid",
    days,
    label: `действует ещё ${days} дн.`,
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  };
}

/** Сортировка: сначала просроченные и истекающие, потом по сроку. */
export function urgencyRank(validUntil: Date | null, now: Date = new Date()): number {
  const e = expiry(validUntil, now);
  if (e.state === "expired") return 0;
  if (e.state === "soon") return 1;
  if (e.state === "valid") return 2;
  return 3;
}
