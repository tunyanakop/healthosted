import { describe, expect, it } from "vitest";
import { bmi, bmiCategory, formatValue, isKind } from "@/lib/measurements";
import { measurementSchema } from "@/lib/validation";

describe("bmi", () => {
  it("считает ИМТ", () => {
    expect(bmi(80, 180)).toBeCloseTo(24.7, 1);
    expect(bmi(60, 170)).toBeCloseTo(20.8, 1);
  });

  it("возвращает null без данных", () => {
    expect(bmi(null, 180)).toBeNull();
    expect(bmi(80, null)).toBeNull();
    expect(bmi(0, 180)).toBeNull();
  });

  it("категории по границам", () => {
    expect(bmiCategory(17).label).toBe("недостаточный вес");
    expect(bmiCategory(22).label).toBe("норма");
    expect(bmiCategory(27).label).toBe("избыточный вес");
    expect(bmiCategory(33).label).toBe("ожирение");
  });
});

describe("formatValue", () => {
  it("форматирует давление парой", () => {
    expect(formatValue("bp", 120, 80)).toBe("120/80 мм рт.ст.");
  });

  it("форматирует вес и пульс", () => {
    expect(formatValue("weight", 80.5)).toBe("80.5 кг");
    expect(formatValue("pulse", 72)).toBe("72 уд/мин");
  });
});

describe("measurementSchema", () => {
  it("принимает нормальный вес", () => {
    const r = measurementSchema.safeParse({
      kind: "weight",
      value: "80.5",
      measuredAt: "2026-11-14",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.value).toBe(80.5);
  });

  it("требует диастолическое для давления", () => {
    const missing = measurementSchema.safeParse({
      kind: "bp",
      value: 120,
      measuredAt: "2026-11-14",
    });
    expect(missing.success).toBe(false);

    const inverted = measurementSchema.safeParse({
      kind: "bp",
      value: 80,
      value2: 120,
      measuredAt: "2026-11-14",
    });
    expect(inverted.success).toBe(false);

    const ok = measurementSchema.safeParse({
      kind: "bp",
      value: 120,
      value2: 80,
      measuredAt: "2026-11-14",
    });
    expect(ok.success).toBe(true);
  });

  it("отсекает значения вне диапазона", () => {
    expect(
      measurementSchema.safeParse({ kind: "spo2", value: 120, measuredAt: "2026-11-14" }).success,
    ).toBe(false);
    expect(
      measurementSchema.safeParse({ kind: "temp", value: 36.6, measuredAt: "2026-11-14" }).success,
    ).toBe(true);
  });

  it("отвергает неизвестный показатель", () => {
    expect(isKind("blood-magic")).toBe(false);
    expect(
      measurementSchema.safeParse({ kind: "blood-magic", value: 1, measuredAt: "2026-11-14" })
        .success,
    ).toBe(false);
  });
});
