import { describe, expect, it } from "vitest";
import {
  ageInDays,
  contextState,
  convertValue,
  evaluate,
  flagFromManual,
  evaluateWithPanic,
  pickRule,
  rangeNote,
  rangesDiffer,
  scoreRule,
} from "@/lib/reference-core";
import { CONVERSIONS, RANGES, TESTS, codeForName, type RefRule } from "@/lib/reference-data";

const DAY = 86_400_000;
const at = new Date("2026-11-15T00:00:00Z");
const birth = (days: number) => new Date(at.getTime() - days * DAY);

const rules = (code: string): RefRule[] => RANGES.filter((r) => r.testCode === code);

describe("справочник", () => {
  it("все правила ссылаются на существующие тесты", () => {
    const codes = new Set(TESTS.map((t) => t.code));
    for (const r of RANGES) {
      expect(codes.has(r.testCode), r.testCode).toBe(true);
    }
  });

  it("нет перевёрнутых границ и корректных panic-порогов", () => {
    for (const r of RANGES) {
      if (r.min != null && r.max != null) expect(r.min).toBeLessThanOrEqual(r.max);
      if (r.panicLow != null && r.panicHigh != null) expect(r.panicLow).toBeLessThan(r.panicHigh);
      expect(r.ageMinDays).toBeLessThanOrEqual(r.ageMaxDays);
    }
  });

  it("коды тестов уникальны", () => {
    const codes = TESTS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("codeForName знает имена из шаблонов", () => {
    expect(codeForName("Гемоглобин")).toBe("HGB");
    expect(codeForName("глюкоза")).toBe("GLU");
    expect(codeForName("Лейкоциты")).toBe("WBC");
    expect(codeForName("Лейкоциты", "urine")).toBe("ULEU");
    expect(codeForName("Белок", "urine")).toBe("UPROT");
    expect(codeForName("Белок")).toBeNull();
  });
});

describe("возраст и состояние", () => {
  it("считает дни", () => {
    expect(ageInDays(birth(30), at)).toBe(30);
    expect(ageInDays(birth(0), at)).toBe(0);
    expect(ageInDays(null, at)).toBeNull();
    expect(ageInDays(new Date("2027-01-01T00:00:00Z"), at)).toBeNull();
  });

  it("определяет состояние", () => {
    const base = { sex: "female", pregnant: false, trimester: null, menopause: false, cyclePhase: null };
    expect(contextState(base)).toBe("none");
    expect(contextState({ ...base, pregnant: true, trimester: 2 })).toBe("pregnant_t2");
    expect(contextState({ ...base, menopause: true })).toBe("menopause");
    expect(contextState({ ...base, cyclePhase: "luteal" })).toBe("luteal");
    expect(contextState({ ...base, sex: "male", pregnant: true })).toBe("none");
  });
});

describe("каскад подбора", () => {
  it("пол важнее общего правила", () => {
    const male = pickRule(rules("HGB"), { sex: "male", ageDays: 12000, specimen: "venous_blood", state: "none" });
    const female = pickRule(rules("HGB"), { sex: "female", ageDays: 12000, specimen: "venous_blood", state: "none" });
    expect(male?.sex).toBe("male");
    expect(male?.min).toBe(130);
    expect(female?.sex).toBe("female");
    expect(female?.min).toBe(120);
  });

  it("возраст в днях выбирает педиатрический референс", () => {
    const newborn = pickRule(rules("HGB"), { sex: "female", ageDays: 10, specimen: "any", state: "none" });
    expect(newborn?.note).toBe("новорождённые");
    expect(newborn?.min).toBe(145);

    const adult = pickRule(rules("HGB"), { sex: "female", ageDays: 12000, specimen: "any", state: "none" });
    expect(adult?.ageMaxDays).toBe(36500);
  });

  it("беременность перекрывает обычный женский диапазон", () => {
    const pregnant = pickRule(rules("HGB"), {
      sex: "female", ageDays: 12000, specimen: "venous_blood", state: "pregnant_t2",
    });
    expect(pregnant?.state).toBe("pregnant_t2");
    expect(pregnant?.min).toBe(105);
  });

  it("фаза цикла выбирается для гормонов", () => {
    const luteal = pickRule(rules("PROG"), {
      sex: "female", ageDays: 12000, specimen: "serum", state: "luteal",
    });
    expect(luteal?.state).toBe("luteal");
    expect(luteal?.min).toBe(5.5);

    const follicular = pickRule(rules("PROG"), {
      sex: "female", ageDays: 12000, specimen: "serum", state: "follicular",
    });
    expect(follicular?.min).toBe(0.3);
  });

  it("возвращает null, если правил нет", () => {
    expect(pickRule([], { sex: "male", ageDays: 100, specimen: null, state: "none" })).toBeNull();
    expect(
      pickRule(rules("PSA"), { sex: "female", ageDays: 12000, specimen: null, state: "none" }),
    ).toBeNull();
  });

  it("scoreRule даёт больший балл специфичному правилу", () => {
    const specific = rules("HGB").find((r) => r.sex === "female" && r.state === "pregnant_t2")!;
    const broad = rules("HGB").find((r) => r.sex === "female" && r.state === "none")!;
    const ctx = { sex: "female", ageDays: 12000, specimen: "venous_blood", state: "pregnant_t2" };
    expect(scoreRule(specific, ctx)!).toBeGreaterThan(scoreRule(broad, ctx)!);
  });
});

describe("единицы и оценка", () => {
  it("пересчитывает гемоглобин г/дл → г/л", () => {
    const result = convertValue(CONVERSIONS, 14, "г/дл", "г/л");
    expect(result.ok).toBe(true);
    expect(result.value).toBeCloseTo(140, 5);
  });

  it("пересчитывает глюкозу мг/дл → ммоль/л", () => {
    const result = convertValue(CONVERSIONS, 90, "мг/дл", "ммоль/л");
    expect(result.value).toBeCloseTo(4.995, 2);
  });

  it("обратный пересчёт тоже работает", () => {
    const result = convertValue(CONVERSIONS, 5, "ммоль/л", "мг/дл");
    expect(result.value).toBeCloseTo(90.09, 1);
  });

  it("неизвестная единица — честный отказ", () => {
    expect(convertValue(CONVERSIONS, 1, "попугаи", "г/л").ok).toBe(false);
  });

  it("флаги: норма, низко, высоко, критично", () => {
    const hgb = rules("HGB").find((r) => r.sex === "male")!;
    expect(evaluate(hgb, 140)).toBe("normal");
    expect(evaluate(hgb, 120)).toBe("low");
    expect(evaluate(hgb, 180)).toBe("high");
    expect(evaluate(hgb, 65)).toBe("critical");
  });

  it("ручные границы работают без справочника", () => {
    expect(flagFromManual(5, 1, 10)).toBe("normal");
    expect(flagFromManual(0.5, 1, 10)).toBe("low");
    expect(flagFromManual(11, 1, 10)).toBe("high");
    expect(flagFromManual(null, 1, 10)).toBe("unknown");
    expect(flagFromManual(5, null, null)).toBe("unknown");
  });

  it("описание правила читаемое", () => {
    const rule = rules("HGB").find((r) => r.sex === "female" && r.state === "pregnant_t2")!;
    const note = rangeNote(rule);
    expect(note).toContain("105–140 г/л");
    expect(note).toContain("беременность, 2 триместр");
    expect(note).toContain("жен.");
  });
});

describe("ручные границы и panic", () => {
  it("критическое значение срабатывает даже при своих границах", () => {
    // пользователь поставил мягкие границы 100–120, но panic для HGB — ниже 70
    expect(evaluateWithPanic(65, 100, 120, 70, 200)).toBe("critical");
    expect(evaluateWithPanic(110, 100, 120, 70, 200)).toBe("normal");
    expect(evaluateWithPanic(95, 100, 120, 70, 200)).toBe("low");
    expect(evaluateWithPanic(130, 100, 120, 70, 200)).toBe("high");
  });

  it("без значения — unknown", () => {
    expect(evaluateWithPanic(null, 1, 10, null, null)).toBe("unknown");
  });

  it("определяет, что границы изменены", () => {
    expect(rangesDiffer(110, 150, 130, 160)).toBe(true);
    expect(rangesDiffer(130, 160, 130, 160)).toBe(false);
    expect(rangesDiffer(130.001, 160, 130, 160)).toBe(false);
    expect(rangesDiffer(null, null, null, null)).toBe(false);
    expect(rangesDiffer(null, 160, 130, 160)).toBe(true);
  });
});
