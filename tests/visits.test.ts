import { describe, expect, it } from "vitest";
import { visitSchema } from "@/lib/validation";

describe("visitSchema", () => {
  it("принимает визит с минимумом данных", () => {
    const r = visitSchema.safeParse({ visitedAt: "2026-11-01", doctorName: "Иванов" });
    expect(r.success).toBe(true);
  });

  it("требует дату", () => {
    expect(visitSchema.safeParse({ doctorName: "Иванов" }).success).toBe(false);
    expect(visitSchema.safeParse({ visitedAt: "01.11.2026", doctorName: "Иванов" }).success).toBe(false);
  });

  it("не пропускает пустой визит", () => {
    expect(visitSchema.safeParse({ visitedAt: "2026-11-01" }).success).toBe(false);
  });

  it("очищает пустые строки", () => {
    const r = visitSchema.safeParse({
      visitedAt: "2026-11-01",
      doctorName: "",
      clinic: "Поликлиника 1",
      reason: "",
      conditionId: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.doctorName).toBeUndefined();
      expect(r.data.reason).toBeUndefined();
      expect(r.data.conditionId).toBeUndefined();
    }
  });

  it("принимает связь с состоянием", () => {
    const r = visitSchema.safeParse({
      visitedAt: "2026-11-01",
      doctorName: "Петров",
      conditionId: "abc123",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.conditionId).toBe("abc123");
  });
});
