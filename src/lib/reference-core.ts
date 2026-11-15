import type { Conversion, RefRule } from "@/lib/reference-data";

export type LabFlagResult = "low" | "normal" | "high" | "critical" | "unknown";

export function ageInDays(birthDate: Date | null, at: Date): number | null {
  if (!birthDate) return null;
  const ms = at.getTime() - birthDate.getTime();
  if (ms < 0) return null;
  return Math.floor(ms / 86_400_000);
}

export function contextState(input: {
  sex: string | null;
  pregnant: boolean | null;
  trimester: number | null;
  menopause: boolean | null;
  cyclePhase: string | null;
}): string {
  if (input.sex !== "female") return "none";
  if (input.pregnant) {
    const t = input.trimester ?? 1;
    return t === 2 ? "pregnant_t2" : t === 3 ? "pregnant_t3" : "pregnant_t1";
  }
  if (input.menopause) return "menopause";
  if (input.cyclePhase === "luteal") return "luteal";
  if (input.cyclePhase === "follicular") return "follicular";
  if (input.cyclePhase === "ovulation") return "ovulation";
  return "none";
}

export type MatchContext = {
  sex: string | null;
  ageDays: number | null;
  specimen: string | null;
  state: string;
};

/** null — правило не подходит; иначе балл специфичности. */
export function scoreRule(rule: RefRule, ctx: MatchContext): number | null {
  const sex = ctx.sex ?? "any";
  const specimen = ctx.specimen ?? "any";

  if (rule.sex !== "any" && rule.sex !== sex) return null;
  if (rule.state !== "none" && rule.state !== ctx.state) return null;
  if (rule.specimen !== "any" && specimen !== "any" && rule.specimen !== specimen) return null;

  if (ctx.ageDays != null && (ctx.ageDays < rule.ageMinDays || ctx.ageDays > rule.ageMaxDays)) {
    return null;
  }
  if (ctx.ageDays == null && rule.ageMaxDays < 36500) return null;

  return (
    (rule.sex !== "any" ? 3 : 0) +
    (rule.state !== "none" ? 3 : 0) +
    (rule.specimen !== "any" ? 2 : 0) +
    (rule.ageMaxDays - rule.ageMinDays < 36500 ? 2 : 0)
  );
}

/** Побеждает более специфичное правило; при равенстве — более узкий возраст. */
export function pickRule(rules: RefRule[], ctx: MatchContext): RefRule | null {
  let best: { rule: RefRule; score: number; width: number } | null = null;

  for (const rule of rules) {
    const score = scoreRule(rule, ctx);
    if (score == null) continue;
    const width = rule.ageMaxDays - rule.ageMinDays;
    if (
      !best ||
      score > best.score ||
      (score === best.score && width < best.width)
    ) {
      best = { rule, score, width };
    }
  }

  return best?.rule ?? null;
}

function normUnit(unit: string | null | undefined): string {
  return (unit ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

export function convertValue(
  conversions: Conversion[],
  value: number,
  fromUnit: string | null | undefined,
  toUnit: string,
): { value: number; ok: boolean } {
  if (!fromUnit || normUnit(fromUnit) === normUnit(toUnit)) return { value, ok: true };

  const direct = conversions.find(
    (c) => c.testCode && normUnit(c.fromUnit) === normUnit(fromUnit) && normUnit(c.toUnit) === normUnit(toUnit),
  );
  if (direct) return { value: value * direct.factor + (direct.offset ?? 0), ok: true };

  const inverse = conversions.find(
    (c) => normUnit(c.fromUnit) === normUnit(toUnit) && normUnit(c.toUnit) === normUnit(fromUnit),
  );
  if (inverse && inverse.factor !== 0) {
    return { value: (value - (inverse.offset ?? 0)) / inverse.factor, ok: true };
  }

  return { value, ok: false };
}

export function evaluate(rule: RefRule, value: number): LabFlagResult {
  if (rule.panicLow != null && value < rule.panicLow) return "critical";
  if (rule.panicHigh != null && value > rule.panicHigh) return "critical";
  if (rule.min != null && value < rule.min) return "low";
  if (rule.max != null && value > rule.max) return "high";
  if (rule.min == null && rule.max == null) return "unknown";
  return "normal";
}

export function sexLabel(sex: string): string {
  if (sex === "male") return "муж.";
  if (sex === "female") return "жен.";
  return "любой пол";
}

export function ageLabel(minDays: number, maxDays: number): string {
  if (maxDays >= 36500) return "взрослые";
  if (maxDays <= 30) return "0–1 мес";
  if (maxDays <= 365) return "до 1 года";
  return `${Math.floor(minDays / 365.25)}–${Math.floor(maxDays / 365.25)} лет`;
}

export function stateLabel(state: string): string | null {
  switch (state) {
    case "pregnant_t1":
      return "беременность, 1 триместр";
    case "pregnant_t2":
      return "беременность, 2 триместр";
    case "pregnant_t3":
      return "беременность, 3 триместр";
    case "menopause":
      return "менопауза";
    case "follicular":
      return "фолликулярная фаза";
    case "luteal":
      return "лютеиновая фаза";
    case "ovulation":
      return "овуляция";
    default:
      return null;
  }
}

export function rangeNote(rule: RefRule): string {
  const parts: string[] = [];
  const st = stateLabel(rule.state);
  if (st) parts.push(st);
  if (rule.sex !== "any") parts.push(sexLabel(rule.sex));
  parts.push(ageLabel(rule.ageMinDays, rule.ageMaxDays));
  if (rule.specimen !== "any") parts.push(rule.specimen === "urine" ? "моча" : "кровь");
  // note не дублируем, когда состояние и так описано (беременность, фаза цикла)
  if (rule.note && rule.state === "none") parts.push(rule.note);

  const range =
    rule.min != null && rule.max != null
      ? `${rule.min}–${rule.max} ${rule.unit}`
      : rule.min != null
        ? `≥ ${rule.min} ${rule.unit}`
        : rule.max != null
          ? `≤ ${rule.max} ${rule.unit}`
          : "без числовых границ";

  return `${range} (${parts.join(", ")})`;
}

export function flagFromManual(
  value: number | null,
  refMin: number | null,
  refMax: number | null,
): LabFlagResult {
  if (value == null) return "unknown";
  if (refMin != null && value < refMin) return "low";
  if (refMax != null && value > refMax) return "high";
  if (refMin == null && refMax == null) return "unknown";
  return "normal";
}

/** Оценка по границам (ручным или из правила) с учётом panic-порогов правила. */
export function evaluateWithPanic(
  value: number | null,
  refMin: number | null,
  refMax: number | null,
  panicLow: number | null,
  panicHigh: number | null,
): LabFlagResult {
  if (value == null) return "unknown";
  if (panicLow != null && value < panicLow) return "critical";
  if (panicHigh != null && value > panicHigh) return "critical";
  if (refMin != null && value < refMin) return "low";
  if (refMax != null && value > refMax) return "high";
  if (refMin == null && refMax == null) return "unknown";
  return "normal";
}

/** Отличаются ли границы от правила (с допуском на округление). */
export function rangesDiffer(
  refMin: number | null,
  refMax: number | null,
  ruleMin: number | null,
  ruleMax: number | null,
): boolean {
  const near = (a: number | null, b: number | null) => {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return Math.abs(a - b) <= 0.005;
  };
  return !near(refMin, ruleMin) || !near(refMax, ruleMax);
}
