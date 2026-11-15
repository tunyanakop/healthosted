import { describe, expect, it } from "vitest";
import { computeFlag, formatRef, isAbnormal, parseNumeric } from "@/lib/labs";
import { labResultSchema } from "@/lib/validation";

describe("parseNumeric", () => {
  it("понимает точку и запятую", () => {
    expect(parseNumeric("4.5")).toBe(4.5);
    expect(parseNumeric("4,5")).toBe(4.5);
    expect(parseNumeric(" -12 ")).toBe(-12);
  });

  it("не превращает текст в число", () => {
    expect(parseNumeric("отрицательно")).toBeNull();
    expect(parseNumeric("")).toBeNull();
    expect(parseNumeric("12 мг")).toBeNull();
  });
});

describe("computeFlag", () => {
  it("ловит низ и верх", () => {
    expect(computeFlag(120, 130, 160)).toBe("low");
    expect(computeFlag(180, 130, 160)).toBe("high");
    expect(computeFlag(145, 130, 160)).toBe("normal");
  });

  it("работает с одной границей", () => {
    expect(computeFlag(5, null, 10)).toBe("normal");
    expect(computeFlag(15, null, 10)).toBe("high");
    expect(computeFlag(3, 5, null)).toBe("low");
  });

  it("без референса оценки нет", () => {
    expect(computeFlag(42, null, null)).toBe("unknown");
    expect(computeFlag(null, 1, 2)).toBe("unknown");
  });

  it("границы включаются в норму", () => {
    expect(computeFlag(130, 130, 160)).toBe("normal");
    expect(computeFlag(160, 130, 160)).toBe("normal");
  });
});

describe("formatRef", () => {
  it("рисует интервалы", () => {
    expect(formatRef(130, 160, "г/л")).toBe("130–160 г/л");
    expect(formatRef(5, null, "ммоль/л")).toBe("≥ 5 ммоль/л");
    expect(formatRef(null, 10, null)).toBe("≤ 10");
    expect(formatRef(null, null, "г/л")).toBe("—");
  });
});

describe("isAbnormal", () => {
  it("только low и high", () => {
    expect(isAbnormal("low")).toBe(true);
    expect(isAbnormal("high")).toBe(true);
    expect(isAbnormal("normal")).toBe(false);
    expect(isAbnormal("unknown")).toBe(false);
  });
});

describe("labResultSchema", () => {
  it("принимает числовые референсы строками", () => {
    const r = labResultSchema.safeParse({
      name: "Гемоглобин",
      value: "145",
      unit: "г/л",
      refMin: "130",
      refMax: "160",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.refMin).toBe(130);
      expect(r.data.refMax).toBe(160);
    }
  });

  it("пустые границы = undefined", () => {
    const r = labResultSchema.safeParse({ name: "СОЭ", value: "5", refMin: "", refMax: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.refMin).toBeUndefined();
      expect(r.data.refMax).toBeUndefined();
    }
  });

  it("ловит перевёрнутые границы", () => {
    expect(
      labResultSchema.safeParse({ name: "X", value: "1", refMin: 10, refMax: 2 }).success,
    ).toBe(false);
  });

  it("требует имя и значение", () => {
    expect(labResultSchema.safeParse({ name: "", value: "1" }).success).toBe(false);
    expect(labResultSchema.safeParse({ name: "X", value: "" }).success).toBe(false);
  });
});
