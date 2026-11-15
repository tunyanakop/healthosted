import { describe, expect, it } from "vitest";
import {
  CUSTOM_TEMPLATE,
  LAB_TEMPLATES,
  kindLabel,
  rowKey,
  templateFor,
} from "@/lib/lab-templates";

describe("lab templates", () => {
  it("идентификаторы уникальны", () => {
    const ids = LAB_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("внутри панели нет дублей показателей", () => {
    for (const template of LAB_TEMPLATES) {
      const keys = template.rows.map((r) => rowKey(r.name));
      expect(new Set(keys).size, template.id).toBe(keys.length);
    }
  });

  it("референсы не перевёрнуты", () => {
    for (const template of LAB_TEMPLATES) {
      for (const row of template.rows) {
        if (row.refMin != null && row.refMax != null) {
          expect(row.refMin, `${template.id}: ${row.name}`).toBeLessThanOrEqual(row.refMax);
        }
      }
    }
  });

  it("у каждого показателя есть имя и единица либо осознанно нет", () => {
    for (const template of LAB_TEMPLATES) {
      for (const row of template.rows) {
        expect(row.name.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("основные панели наполнены", () => {
    const expected: Record<string, number> = {
      cbc: 16,
      biochem: 20,
      lipid: 5,
      thyroid: 4,
      coag: 6,
      urine: 14,
      tumor: 6,
    };
    for (const [id, min] of Object.entries(expected)) {
      const template = templateFor(id);
      expect(template, id).not.toBeNull();
      expect(template!.rows.length, id).toBeGreaterThanOrEqual(min);
    }
  });

  it("свой набор пуст, но помечен как custom", () => {
    expect(templateFor(CUSTOM_TEMPLATE)?.rows.length).toBe(0);
    expect(kindLabel(CUSTOM_TEMPLATE)).toBe("Свой набор");
  });

  it("kindLabel не падает на неизвестном типе", () => {
    expect(kindLabel("unknown-kind")).toBe("unknown-kind");
    expect(kindLabel(null)).toBe("без типа");
  });

  it("rowKey нормализует регистр и пробелы", () => {
    expect(rowKey("  Гемоглобин  ")).toBe("гемоглобин");
    expect(rowKey("25-OH  витамин D")).toBe("25-oh витамин d");
  });
});
