import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

describe("rate limit", () => {
  beforeEach(() => resetRateLimit());

  it("пропускает в пределах лимита", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit("k", 3, 1000).ok).toBe(true);
    }
  });

  it("блокирует сверх лимита", () => {
    rateLimit("k", 2, 1000);
    rateLimit("k", 2, 1000);
    const third = rateLimit("k", 2, 1000);
    expect(third.ok).toBe(false);
    expect(third.retryAfterSec).toBeGreaterThan(0);
  });

  it("независим для разных ключей", () => {
    rateLimit("a", 1, 1000);
    expect(rateLimit("b", 1, 1000).ok).toBe(true);
  });
});
