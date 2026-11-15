import { describe, expect, it } from "vitest";
import { matchPatterns, type ResultLite } from "@/lib/lab-patterns";

const r = (code: string, flag: string, value: number | null = null, unit: string | null = null): ResultLite => ({
  code,
  flag,
  value,
  unit,
});

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe("паттерны анализов", () => {
  it("железодефицит: HGB↓ + MCV↓", () => {
    const m = matchPatterns([r("HGB", "low", 110, "г/л"), r("MCV", "low", 74, "фл")]);
    expect(ids(m)).toContain("iron_deficiency");
    expect(m.find((x) => x.id === "iron_deficiency")!.missing).toContain("FERR");
  });

  it("B12: HGB↓ + MCV↑", () => {
    expect(ids(matchPatterns([r("HGB", "low", 105), r("MCV", "high", 108)]))).toContain("b12_folate");
  });

  it("не путает железодефицит и B12", () => {
    const iron = matchPatterns([r("HGB", "low"), r("MCV", "low")]);
    const b12 = matchPatterns([r("HGB", "low"), r("MCV", "high")]);
    expect(ids(iron)).not.toContain("b12_folate");
    expect(ids(b12)).not.toContain("iron_deficiency");
  });

  it("бактериальное воспаление требует WBC и CRP одновременно", () => {
    expect(ids(matchPatterns([r("WBC", "high", 14)]))).not.toContain("bacterial_inflammation");
    expect(
      ids(matchPatterns([r("WBC", "high", 14), r("CRP", "high", 45), r("NEUT", "high", 80)])),
    ).toContain("bacterial_inflammation");
  });

  it("вирусный паттерн не срабатывает при высоких лейкоцитах", () => {
    expect(ids(matchPatterns([r("WBC", "high", 15), r("LYMPH", "high", 45)]))).not.toContain(
      "viral_pattern",
    );
    expect(ids(matchPatterns([r("WBC", "normal", 6), r("LYMPH", "high", 45)]))).toContain(
      "viral_pattern",
    );
  });

  it("дислипидемия: ЛПНП↑ + ЛПВП↓", () => {
    expect(
      ids(matchPatterns([r("LDL", "high", 4.5), r("HDL", "low", 0.8)])),
    ).toContain("dyslipidemia");
  });

  it("предиабет по числу HbA1c, а не только по флагу", () => {
    expect(ids(matchPatterns([r("HBA1C", "normal", 6.1)]))).toContain("prediabetes");
    expect(ids(matchPatterns([r("HBA1C", "high", 7.2)]))).not.toContain("prediabetes");
  });

  it("гипо- и гипертиреоз взаимоисключающие", () => {
    const hypo = matchPatterns([r("TSH", "high"), r("FT4", "low")]);
    const hyper = matchPatterns([r("TSH", "low"), r("FT4", "high")]);
    expect(ids(hypo)).toContain("hypothyroid");
    expect(ids(hyper)).toContain("hyperthyroid");
    expect(ids(hypo)).not.toContain("hyperthyroid");
  });

  it("почечный паттерн учитывает СКФ", () => {
    expect(ids(matchPatterns([r("CREA", "high", 140), r("EGFR", "low", 45)]))).toContain("kidney");
    expect(ids(matchPatterns([r("CREA", "high", 140)]))).toContain("kidney");
  });

  it("нормальные значения не дают паттернов", () => {
    const normal = [
      r("HGB", "normal", 140), r("MCV", "normal", 88), r("WBC", "normal", 6),
      r("CRP", "normal", 1), r("LDL", "normal", 2.5), r("HDL", "normal", 1.4),
      r("TSH", "normal", 2), r("FT4", "normal", 14), r("CREA", "normal", 80),
      r("HBA1C", "normal", 5.2),
    ];
    expect(matchPatterns(normal)).toEqual([]);
  });

  it("критические флаги тоже ловятся", () => {
    expect(ids(matchPatterns([r("K", "critical", 6.9)]))).toContain("hyperkalemia");
    expect(ids(matchPatterns([r("PLT", "critical", 30)]))).toContain("thrombocytopenia");
  });

  it("сортировка: attention раньше info", () => {
    const m = matchPatterns([
      r("HGB", "low", 110), r("MCV", "low", 74),
      r("VITD", "low", 18),
    ]);
    expect(m[0].severity).toBe("attention");
  });
});
