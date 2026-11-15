import "server-only";
import { prisma } from "@/lib/db";
import { CONVERSIONS, RANGES, TESTS, type Conversion, type RefRule } from "@/lib/reference-data";
import {
  ageInDays,
  contextState,
  convertValue,
  evaluate,
  flagFromManual,
  pickRule,
  rangeNote,
  type LabFlagResult,
} from "@/lib/reference-core";

export { ageInDays, contextState, flagFromManual };
export type { LabFlagResult };

export type Resolution = {
  flag: LabFlagResult;
  note: string;
  appliedUnit: string | null;
  appliedMin: number | null;
  appliedMax: number | null;
  panicLow: number | null;
  panicHigh: number | null;
  matched: boolean;
  valueInRangeUnit: number | null;
  converted: boolean;
};

let seedPromise: Promise<void> | null = null;

/** Справочник заполняется при первом обращении и дальше не трогается. */
export function ensureReferenceData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const count = await prisma.referenceRange.count();
      if (count > 0) return;

      await prisma.testDefinition.createMany({
        data: TESTS.map((t) => ({ code: t.code, name: t.name, defaultUnit: t.defaultUnit ?? null })),
      });

      await prisma.referenceRange.createMany({
        data: RANGES.map((r) => ({
          testCode: r.testCode,
          specimen: r.specimen,
          sex: r.sex,
          ageMinDays: r.ageMinDays,
          ageMaxDays: r.ageMaxDays,
          state: r.state,
          min: r.min,
          max: r.max,
          unit: r.unit,
          panicLow: r.panicLow,
          panicHigh: r.panicHigh,
          note: r.note,
        })),
      });

      await prisma.unitConversion.createMany({
        data: CONVERSIONS.map((c) => ({
          testCode: c.testCode,
          fromUnit: c.fromUnit,
          toUnit: c.toUnit,
          factor: c.factor,
          offset: c.offset ?? 0,
        })),
      });
    })().catch(() => {
      seedPromise = null;
    });
  }
  return seedPromise;
}

export type ResolveInput = {
  testCode: string | null;
  value: number | null;
  unit: string | null;
  sex: string | null;
  birthDate: Date | null;
  takenAt: Date;
  specimen: string | null;
  pregnant: boolean | null;
  trimester: number | null;
  menopause: boolean | null;
  cyclePhase: string | null;
};

/**
 * Каскад подбора: тест → биоматериал → пол → возраст в днях → состояние.
 */
export async function resolveReference(input: ResolveInput): Promise<Resolution> {
  const empty: Resolution = {
    flag: "unknown",
    note: "нет референса",
    appliedUnit: null,
    appliedMin: null,
    appliedMax: null,
    panicLow: null,
    panicHigh: null,
    matched: false,
    valueInRangeUnit: input.value,
    converted: false,
  };

  if (!input.testCode) return empty;
  if (input.value == null) {
    return { ...empty, note: "значение не числовое — оценка не ставится" };
  }

  await ensureReferenceData();

  const [rows, conversions] = await Promise.all([
    prisma.referenceRange.findMany({ where: { testCode: input.testCode } }),
    prisma.unitConversion.findMany({ where: { testCode: input.testCode } }),
  ]);
  if (rows.length === 0) return empty;

  const rules: RefRule[] = rows.map((r) => ({
    testCode: r.testCode,
    specimen: r.specimen as RefRule["specimen"],
    sex: r.sex as RefRule["sex"],
    ageMinDays: r.ageMinDays,
    ageMaxDays: r.ageMaxDays,
    state: r.state as RefRule["state"],
    min: r.min,
    max: r.max,
    unit: r.unit,
    panicLow: r.panicLow,
    panicHigh: r.panicHigh,
    note: r.note,
  }));

  const ctx = {
    sex: input.sex,
    ageDays: ageInDays(input.birthDate, input.takenAt),
    specimen: input.specimen,
    state: contextState(input),
  };

  const rule = pickRule(rules, ctx);
  if (!rule) {
    return { ...empty, note: "нет референса для этих пола/возраста/состояния" };
  }

  const conversionsTyped: Conversion[] = conversions.map((c) => ({
    testCode: c.testCode,
    fromUnit: c.fromUnit,
    toUnit: c.toUnit,
    factor: c.factor,
    offset: c.offset,
  }));

  const converted = convertValue(conversionsTyped, input.value, input.unit, rule.unit);
  if (!converted.ok) {
    return {
      ...empty,
      note: `не знаю, как пересчитать «${input.unit ?? "?"}» в «${rule.unit}»`,
    };
  }

  return {
    flag: evaluate(rule, converted.value),
    note: rangeNote(rule),
    appliedUnit: rule.unit,
    appliedMin: rule.min,
    appliedMax: rule.max,
    panicLow: rule.panicLow,
    panicHigh: rule.panicHigh,
    matched: true,
    valueInRangeUnit: converted.value,
    converted: (input.unit ?? "").trim().toLowerCase() !== rule.unit.trim().toLowerCase(),
  };
}

/** Пересчёт произвольного значения в целевую единицу по таблице теста. */
export async function convertToUnit(
  testCode: string,
  value: number,
  fromUnit: string | null | undefined,
  toUnit: string,
): Promise<{ value: number; ok: boolean }> {
  await ensureReferenceData();
  const [direct, inverse] = await Promise.all([
    prisma.unitConversion.findFirst({
      where: { testCode, fromUnit: { equals: fromUnit?.trim() ?? "" }, toUnit: toUnit.trim() },
    }),
    prisma.unitConversion.findFirst({
      where: { testCode, fromUnit: toUnit.trim(), toUnit: { equals: fromUnit?.trim() ?? "" } },
    }),
  ]);

  const conversions: Conversion[] = [];
  if (direct) conversions.push({ testCode, fromUnit: direct.fromUnit, toUnit: direct.toUnit, factor: direct.factor, offset: direct.offset });
  if (inverse) conversions.push({ testCode, fromUnit: inverse.fromUnit, toUnit: inverse.toUnit, factor: inverse.factor, offset: inverse.offset });

  return convertValue(conversions, value, fromUnit, toUnit);
}

export type RangePreview = {
  min: number | null;
  max: number | null;
  unit: string;
  note: string;
} | null;

/** Пакетный подбор правил без значения — чтобы показать персональные нормы до ввода. */
export async function resolveRangesBatch(input: {
  codes: string[];
  sex: string | null;
  birthDate: Date | null;
  takenAt: Date;
  specimen: string | null;
  pregnant: boolean | null;
  trimester: number | null;
  menopause: boolean | null;
  cyclePhase: string | null;
}): Promise<Record<string, RangePreview>> {
  const unique = [...new Set(input.codes)].slice(0, 80);
  if (unique.length === 0) return {};

  await ensureReferenceData();

  const rows = await prisma.referenceRange.findMany({ where: { testCode: { in: unique } } });

  const ctx = {
    sex: input.sex,
    ageDays: ageInDays(input.birthDate, input.takenAt),
    specimen: input.specimen,
    state: contextState(input),
  };

  const result: Record<string, RangePreview> = {};

  for (const code of unique) {
    const rules: RefRule[] = rows
      .filter((r) => r.testCode === code)
      .map((r) => ({
        testCode: r.testCode,
        specimen: r.specimen as RefRule["specimen"],
        sex: r.sex as RefRule["sex"],
        ageMinDays: r.ageMinDays,
        ageMaxDays: r.ageMaxDays,
        state: r.state as RefRule["state"],
        min: r.min,
        max: r.max,
        unit: r.unit,
        panicLow: r.panicLow,
        panicHigh: r.panicHigh,
        note: r.note,
      }));

    const rule = pickRule(rules, ctx);
    result[code] = rule
      ? { min: rule.min, max: rule.max, unit: rule.unit, note: rangeNote(rule) }
      : null;
  }

  return result;
}
