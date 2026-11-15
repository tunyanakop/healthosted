import { describe, expect, it } from "vitest";
import { expiry, typeLabel, urgencyRank } from "@/lib/medbook";
import { medbookSchema } from "@/lib/validation";

const NOW = new Date("2026-11-14T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("expiry", () => {
  it("считает просрочку", () => {
    const e = expiry(day(-5), NOW);
    expect(e.state).toBe("expired");
    expect(e.label).toBe("просрочено на 5 дн.");
  });

  it("ловит истечение сегодня", () => {
    const e = expiry(day(0), NOW);
    expect(e.state).toBe("soon");
    expect(e.label).toBe("истекает сегодня");
  });

  it("предупреждает заранее", () => {
    expect(expiry(day(10), NOW).state).toBe("soon");
    expect(expiry(day(30), NOW).state).toBe("soon");
  });

  it("действует, если срок далеко", () => {
    const e = expiry(day(120), NOW);
    expect(e.state).toBe("valid");
    expect(e.label).toBe("действует ещё 120 дн.");
  });

  it("без срока", () => {
    expect(expiry(null, NOW).state).toBe("none");
  });
});

describe("urgencyRank", () => {
  it("ставит просроченные первыми", () => {
    expect(urgencyRank(day(-1), NOW)).toBeLessThan(urgencyRank(day(5), NOW));
    expect(urgencyRank(day(5), NOW)).toBeLessThan(urgencyRank(day(100), NOW));
    expect(urgencyRank(day(100), NOW)).toBeLessThan(urgencyRank(null, NOW));
  });
});

describe("typeLabel", () => {
  it("переводит известные типы", () => {
    expect(typeLabel("fluorography")).toBe("Флюорография");
    expect(typeLabel("custom-thing")).toBe("custom-thing");
  });
});

describe("medbookSchema", () => {
  it("принимает запись без срока", () => {
    expect(medbookSchema.safeParse({ type: "vaccination" }).success).toBe(true);
  });

  it("ловит срок раньше выдачи", () => {
    const r = medbookSchema.safeParse({
      type: "checkup",
      issuedAt: "2026-05-01",
      validUntil: "2026-04-01",
    });
    expect(r.success).toBe(false);
  });

  it("отвергает неизвестный тип", () => {
    expect(medbookSchema.safeParse({ type: "sticker" }).success).toBe(false);
  });
});
