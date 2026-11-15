import { describe, expect, it } from "vitest";
import { durationLabel, isChronicActive, isConditionStatus } from "@/lib/conditions";
import { conditionSchema } from "@/lib/validation";

describe("conditionSchema", () => {
  it("принимает минимальную запись", () => {
    const r = conditionSchema.safeParse({ title: "Мигрень" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("active");
  });

  it("проверяет формат МКБ-10", () => {
    expect(conditionSchema.safeParse({ title: "Гастрит", icd10: "K29.7" }).success).toBe(true);
    expect(conditionSchema.safeParse({ title: "Гастрит", icd10: "К29" }).success).toBe(false);
    expect(conditionSchema.safeParse({ title: "Гастрит", icd10: "K297" }).success).toBe(false);
  });

  it("ловит окончание раньше начала", () => {
    const r = conditionSchema.safeParse({
      title: "Перелом",
      onsetAt: "2026-05-10",
      resolvedAt: "2026-04-01",
    });
    expect(r.success).toBe(false);
  });

  it("требует дату окончания при статусе «вылечено»", () => {
    expect(conditionSchema.safeParse({ title: "Ангина", status: "resolved" }).success).toBe(false);
    expect(
      conditionSchema.safeParse({
        title: "Ангина",
        status: "resolved",
        resolvedAt: "2026-03-01",
      }).success,
    ).toBe(true);
  });

  it("очищает пустые строки в необязательных полях", () => {
    const r = conditionSchema.safeParse({ title: "Отит", icd10: "", notes: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.icd10).toBeUndefined();
      expect(r.data.notes).toBeUndefined();
    }
  });
});

describe("durationLabel", () => {
  it("считает дни, месяцы и годы", () => {
    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

    expect(durationLabel(daysAgo(5), null)).toBe("5 дн.");
    expect(durationLabel(daysAgo(120), null)).toBe("4 мес.");
    expect(
      durationLabel(new Date("2020-01-01T00:00:00Z"), new Date("2023-01-01T00:00:00Z")),
    ).toMatch(/г\./);
  });

  it("возвращает null без даты начала", () => {
    expect(durationLabel(null, null)).toBeNull();
  });
});

describe("isConditionStatus", () => {
  it("распознаёт только известные статусы", () => {
    expect(isConditionStatus("active")).toBe(true);
    expect(isConditionStatus("cured")).toBe(false);
  });
});

describe("isChronicActive", () => {
  it("сезонная инфекция не считается хронической", () => {
    expect(isChronicActive({ status: "active" })).toBe(true);
    expect(isChronicActive({ status: "active", seasonalKind: "arvi" })).toBe(false);
    expect(isChronicActive({ status: "resolved" })).toBe(false);
  });
});

describe("conditionSchema: сезонные поля", () => {
  it("принимает ОРВИ с тяжестью", () => {
    const r = conditionSchema.safeParse({
      title: "ОРВИ",
      status: "resolved",
      onsetAt: "2026-10-20",
      resolvedAt: "2026-10-27",
      seasonalKind: "arvi",
      severity: "moderate",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.seasonalKind).toBe("arvi");
  });

  it("не пропускает неизвестный тип инфекции", () => {
    expect(conditionSchema.safeParse({ title: "ОРВИ", seasonalKind: "ebola" }).success).toBe(false);
  });

  it("пустые сезонные поля допустимы", () => {
    const r = conditionSchema.safeParse({ title: "Гастрит", seasonalKind: "", severity: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.seasonalKind).toBeUndefined();
      expect(r.data.severity).toBeUndefined();
    }
  });
});
