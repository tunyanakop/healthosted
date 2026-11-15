import { describe, expect, it } from "vitest";
import { TESTS } from "@/lib/reference-data";
import { TEST_INFO, infoFor, tooltipText } from "@/lib/test-descriptions";
import { interpretResults } from "@/lib/lab-interpretation";

describe("справочник пояснений", () => {
  it("есть описание для каждого теста из справочника", () => {
    const missing = TESTS.filter((t) => !TEST_INFO[t.code]).map((t) => t.code);
    expect(missing).toEqual([]);
  });

  it("нет описаний для несуществующих кодов", () => {
    const codes = new Set(TESTS.map((t) => t.code));
    const extra = Object.keys(TEST_INFO).filter((code) => !codes.has(code));
    expect(extra).toEqual([]);
  });

  it("tooltipText собирает смысл и причины", () => {
    const text = tooltipText("HGB");
    expect(text).toContain("переносит кислород");
    expect(text).toContain("анемия");
    expect(text).toContain("Повышено");
  });

  it("infoFor спокойно переживает мусор", () => {
    expect(infoFor(null)).toBeNull();
    expect(infoFor("NOPE")).toBeNull();
    expect(tooltipText(null)).toBeNull();
  });

  it("все описания непустые", () => {
    for (const [code, info] of Object.entries(TEST_INFO)) {
      expect(info.what.length, code).toBeGreaterThan(20);
    }
  });
});

describe("расшифровка", () => {
  const base = {
    testCode: "HGB",
    value: "118",
    unit: "г/л",
    appliedNote: "130–160 г/л (муж., взрослые)",
  };

  it("раскладывает по группам", () => {
    const result = interpretResults([
      { ...base, name: "Гемоглобин", flag: "low" },
      { ...base, name: "Гемоглобин", flag: "critical", value: "65" },
      { ...base, testCode: "GLU", name: "Глюкоза", value: "4.5", flag: "normal" },
      { ...base, testCode: "CRP", name: "СРБ", value: "12", flag: "high" },
      { ...base, testCode: null, name: "Свой тест", value: "1", flag: "unknown" },
    ]);

    expect(result.critical).toHaveLength(1);
    expect(result.low).toHaveLength(1);
    expect(result.high).toHaveLength(1);
    expect(result.normalCount).toBe(1);
    expect(result.empty).toBe(false);
  });

  it("в тексте отклонения есть причина", () => {
    const result = interpretResults([{ ...base, name: "Гемоглобин", flag: "low" }]);
    expect(result.low[0].text).toContain("Ниже нормы");
    expect(result.low[0].text).toContain("анемия");
  });

  it("критическое значение просит врача", () => {
    const result = interpretResults([{ ...base, name: "Гемоглобин", flag: "critical" }]);
    expect(result.critical[0].text).toContain("быстрой оценки врача");
  });

  it("пустой набор", () => {
    expect(interpretResults([]).empty).toBe(true);
  });

  it("неизвестный код не ломает расшифровку", () => {
    const result = interpretResults([
      { ...base, testCode: "NOPE", name: "Загадка", value: "1", flag: "high" },
    ]);
    expect(result.high[0].text).toContain("Пояснение");
  });
});
