import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, resetRateLimiter } from "@/lib/rate-limit";

beforeEach(() => resetRateLimiter());

describe("rateLimit", () => {
  it("allows up to the limit then refuses", () => {
    const t = 1_000_000;
    expect(rateLimit("k", 3, 60_000, t)).toBe(true);
    expect(rateLimit("k", 3, 60_000, t + 1)).toBe(true);
    expect(rateLimit("k", 3, 60_000, t + 2)).toBe(true);
    expect(rateLimit("k", 3, 60_000, t + 3)).toBe(false);
  });

  it("window slides: old hits expire", () => {
    const t = 1_000_000;
    rateLimit("k", 2, 1_000, t);
    rateLimit("k", 2, 1_000, t + 10);
    expect(rateLimit("k", 2, 1_000, t + 20)).toBe(false);
    expect(rateLimit("k", 2, 1_000, t + 1_011)).toBe(true);
  });

  it("keys are independent", () => {
    const t = 1_000_000;
    expect(rateLimit("a", 1, 60_000, t)).toBe(true);
    expect(rateLimit("b", 1, 60_000, t)).toBe(true);
    expect(rateLimit("a", 1, 60_000, t + 1)).toBe(false);
  });

  it("a refused call does not consume quota", () => {
    const t = 1_000_000;
    rateLimit("k", 1, 1_000, t);
    rateLimit("k", 1, 1_000, t + 1); // refused
    expect(rateLimit("k", 1, 1_000, t + 1_001)).toBe(true);
  });
});
