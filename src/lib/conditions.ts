export type ConditionStatus = "active" | "remission" | "resolved";

export const STATUSES: {
  value: ConditionStatus;
  label: string;
  badge: string;
  dot: string;
}[] = [
  { value: "active", label: "Активно", badge: "border-rose-500/40 bg-rose-500/10 text-rose-300", dot: "bg-rose-400" },
  { value: "remission", label: "Ремиссия", badge: "border-amber-500/40 bg-amber-500/10 text-amber-300", dot: "bg-amber-400" },
  { value: "resolved", label: "Вылечено", badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
];

export const STATUS_MAP = Object.fromEntries(
  STATUSES.map((s) => [s.value, s]),
) as Record<ConditionStatus, (typeof STATUSES)[number]>;

export function isConditionStatus(value: string): value is ConditionStatus {
  return value in STATUS_MAP;
}

/** Длительность состояния: от начала до конца (или до сегодня). */
export function durationLabel(
  onsetAt: Date | null,
  resolvedAt: Date | null,
): string | null {
  if (!onsetAt) return null;
  const end = resolvedAt ?? new Date();
  const days = Math.max(0, Math.round((end.getTime() - onsetAt.getTime()) / 86_400_000));

  if (days < 1) return "менее суток";
  if (days < 31) return `${days} дн.`;

  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} мес.`;

  const years = Math.round(days / 365.25);
  return `${years} г.`;
}

/** Свежесть записи для сортировки: resolved/новые сверху. */
export function sortKey(c: { onsetAt: Date | null; createdAt: Date }): number {
  return (c.onsetAt ?? c.createdAt).getTime();
}

/** Хроническое состояние: активно и не является сезонной инфекцией. */
export function isChronicActive(c: { status: string; seasonalKind?: string | null }): boolean {
  return c.status === "active" && !c.seasonalKind;
}
